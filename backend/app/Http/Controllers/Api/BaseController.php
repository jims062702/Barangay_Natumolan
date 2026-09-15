<?php

namespace App\Http\Controllers\Api;

use Illuminate\Routing\Controller;

/**
 * What every API controller answers with: one JSON envelope for success and
 * for refusal, and the status counts the list screens put on their chips.
 */
class BaseController extends Controller
{
    /**
     * How many rows sit under each status, for the chips above a list.
     *
     * The chips are read to decide where to go next — "is there anything in
     * Rejected?" — so the number has to be the whole list's, not the page's.
     *
     * Counted from the query WITHOUT its own status filter, which is the
     * whole trick: filter first and every chip but the chosen one reports
     * zero, which is precisely the question the chips exist to answer. Every
     * OTHER filter still applies, so the counts describe the list actually
     * being looked at.
     *
     * Pass the query BEFORE the status `where` is added.
     */
    protected function statusCounts($query, string $column = 'status'): array
    {
        return (clone $query)
            // A paginator's ORDER BY has no place in a GROUP BY, and MySQL in
            // strict mode refuses the combination outright.
            ->reorder()
            ->getQuery()
            ->select($column, \Illuminate\Support\Facades\DB::raw('COUNT(*) as total'))
            ->groupBy($column)
            ->pluck('total', $column)
            ->map(fn ($n) => (int) $n)
            ->all();
    }
    public function success($data = null, $message = 'Success', $code = 200)
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], $code);
    }

    /**
     * Send error response
     */
    public function error($message = 'Error', $code = 400, $errors = null)
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors' => $errors,
        ], $code);
    }

    /**
     * Send unauthorized response
     */
    public function unauthorized($message = 'Unauthorized')
    {
        return $this->error($message, 401);
    }

    /**
     * Send forbidden response
     */
    public function forbidden($message = 'Forbidden')
    {
        return $this->error($message, 403);
    }

    /**
     * Send not found response
     */
    public function notFound($message = 'Resource not found')
    {
        return $this->error($message, 404);
    }
}
