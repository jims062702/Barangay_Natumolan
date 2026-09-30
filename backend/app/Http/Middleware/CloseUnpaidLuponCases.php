<?php

namespace App\Http\Middleware;

use App\Services\Lupon\FilingFeeDeadlines;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Closes any Lupon case whose three days to pay the filing fee have run out,
 * before the request is answered — so the docket a clerk opens is already
 * right. At most once a minute; see FilingFeeDeadlines for why this is not
 * the scheduler's job. A failure here is reported and never stands in the
 * way of the request.
 */
class CloseUnpaidLuponCases
{
    public function handle(Request $request, Closure $next): Response
    {
        try {
            FilingFeeDeadlines::sweep();
        } catch (\Throwable $failure) {
            report($failure);
        }

        return $next($request);
    }
}
