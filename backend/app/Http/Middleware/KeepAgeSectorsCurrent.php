<?php

namespace App\Http\Middleware;

use App\Services\Resident\AgeSectors;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Brings the age brackets up to today before the day's first answer.
 *
 * See AgeSectors for why this cannot be left to the scheduler. A failure here
 * is reported and never stands in the way of the request: yesterday's
 * brackets are a better answer than an error page.
 */
class KeepAgeSectorsCurrent
{
    public function handle(Request $request, Closure $next): Response
    {
        try {
            AgeSectors::keepCurrent();
        } catch (\Throwable $failure) {
            report($failure);
        }

        return $next($request);
    }
}
