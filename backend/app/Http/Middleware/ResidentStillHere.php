<?php

namespace App\Http\Middleware;

use App\Models\Resident\Resident;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The portal is for residents who still live here, and are still alive.
 *
 * A death and a move out both switch the account off, so this is the second
 * lock rather than the first: an account left on by an older record, or one
 * switched off between signing in and pressing Send, gets a plain answer
 * instead of quietly filing a request on behalf of somebody the barangay no
 * longer serves.
 *
 * It is a refusal, not a redirect: the person is told to go to the barangay
 * hall, where a record can actually be put right.
 */
class ResidentStillHere
{
    public function handle(Request $request, Closure $next): Response
    {
        $resident = Resident::find($request->user()?->resident_id);

        if (! $resident) {
            return response()->json([
                'success' => false,
                'message' => 'No resident record is linked to this account.',
            ], 403);
        }

        if ($resident->life_status === Resident::DECEASED) {
            return response()->json([
                'success' => false,
                'message' => 'This record is marked deceased, so the portal is closed on it. '
                    . 'If that is wrong, please go to the Population Office at the barangay hall.',
            ], 403);
        }

        if (! $resident->is_active || $resident->isNonResident()) {
            return response()->json([
                'success' => false,
                'message' => 'This record is no longer an active resident of Barangay Natumolan, '
                    . 'so online requests are closed on it. If you have moved back, please go to the '
                    . 'Population Office at the barangay hall.',
            ], 403);
        }

        $age = $resident->birthdate?->age;
        if ($age === null || $age < 18) {
            return response()->json([
                'success' => false,
                'message' => 'The resident portal is available only to residents aged 18 and above. Accounts cannot be accessed by residents aged 17 and below.',
            ], 403);
        }

        return $next($request);
    }
}
