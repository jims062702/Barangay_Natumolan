<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Work sent from a device that was offline, applied exactly once.
 *
 * THE FAILURE THIS EXISTS FOR. A clerk files a certificate with the line
 * down. The device keeps it and sends it when the line returns. The request
 * arrives, the certificate is created — and the reply is lost on the way
 * back. The device has no way to tell that from a request that never
 * landed, so it sends again, and the barangay now holds two certificates,
 * two numbers, for one resident. Nothing on either side notices.
 *
 * The device therefore stamps each queued job with an id of its own making
 * and sends it in `X-Offline-Job`. The FIRST time an id is seen the request
 * runs normally and its reply is recorded. Every later request carrying the
 * same id is answered from that record, with the work not run again.
 *
 * WHY THE FIRST WRITE IS A ROW AND NOT A CHECK. Two retries can arrive at
 * the same moment — a flaky line often produces exactly that — and "look,
 * then insert" leaves a gap between the two in which both see nothing.
 * The unique index on `job_id` is what actually decides, and the loser is
 * told so by the database rather than by a check it could have raced past.
 *
 * Requests with no header pass straight through. This is for the queue, not
 * for ordinary online use, and making every write carry an id would be a
 * change to every form in the app for a guarantee they do not need.
 */
class ApplyOfflineJobOnce
{
    public function handle(Request $request, Closure $next): Response
    {
        $jobId = trim((string) $request->header('X-Offline-Job'));

        if ($jobId === '' || ! in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return $next($request);
        }

        /* An id long enough to be a UUID and no longer; the column is 64. */
        if (strlen($jobId) > 64) {
            return response()->json([
                'success' => false,
                'message' => 'The offline job id is not valid.',
            ], 422);
        }

        $userId = $request->user()?->id;

        $seen = DB::table('offline_jobs')->where('job_id', $jobId)->first();

        if ($seen) {
            return $this->replay($seen, $userId);
        }

        /*
         * Claimed BEFORE the work runs, so a second copy of this request
         * arriving mid-flight loses the insert and waits for the answer
         * rather than doing the work a second time. The status is filled in
         * afterwards; a row with 0 means "in progress".
         */
        try {
            DB::table('offline_jobs')->insert([
                'job_id' => $jobId,
                'user_id' => $userId,
                'method' => $request->method(),
                'path' => substr($request->path(), 0, 255),
                'status_code' => 0,
                'response' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (UniqueConstraintViolationException) {
            /* Lost the race. The other copy is doing the work; answer from
               whatever it has recorded. */
            $seen = DB::table('offline_jobs')->where('job_id', $jobId)->first();

            return $seen
                ? $this->replay($seen, $userId)
                : response()->json([
                    'success' => false,
                    'message' => 'This job is already being processed. Try again in a moment.',
                ], 409);
        }

        $response = $next($request);

        /*
         * Only a SUCCESSFUL reply is worth remembering.
         *
         * A refusal must be allowed to happen again: the office may fix the
         * row and retry, and replaying the old rejection would tell them
         * their correction changed nothing. So the claim is released and
         * the next attempt runs for real.
         */
        if ($response->getStatusCode() >= 200 && $response->getStatusCode() < 300) {
            DB::table('offline_jobs')->where('job_id', $jobId)->update([
                'status_code' => $response->getStatusCode(),
                'response' => $response->getContent(),
                'updated_at' => now(),
            ]);
        } else {
            DB::table('offline_jobs')->where('job_id', $jobId)->delete();
        }

        return $response;
    }

    /**
     * Answers a repeat with what the first attempt produced.
     */
    private function replay(object $seen, ?int $userId): Response
    {
        /*
         * One account cannot collect another's answer. The id is made on a
         * device and travels in a header, so it is guessable in principle,
         * and a reply can carry a resident's details.
         */
        if ($seen->user_id !== null && $seen->user_id !== $userId) {
            return response()->json([
                'success' => false,
                'message' => 'This job belongs to another account.',
            ], 403);
        }

        /* Still running. Not an error — the device should ask again. */
        if ((int) $seen->status_code === 0) {
            return response()->json([
                'success' => false,
                'message' => 'This job is already being processed. Try again in a moment.',
            ], 409);
        }

        return response(
            $seen->response,
            (int) $seen->status_code,
        )->header('Content-Type', 'application/json')
            /* So a reply that came from here can be told apart in a log
               from one that did the work. */
            ->header('X-Offline-Job-Replayed', '1');
    }
}
