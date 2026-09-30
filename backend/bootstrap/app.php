<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
            'office' => \App\Http\Middleware\OfficeMiddleware::class,
            'staff' => \App\Http\Middleware\StaffMiddleware::class,
            'deny_role' => \App\Http\Middleware\DenyRoleMiddleware::class,
            /* The portal is for residents who still live here, and are
               still alive — see ResidentStillHere. */
            'resident_still_here' => \App\Http\Middleware\ResidentStillHere::class,
        ]);

        /*
         * Work sent from a device that was offline, applied exactly once.
         *
         * On the API group rather than named routes, because the queue can
         * carry ANY write the office made while the line was down, and a
         * list of which ones are protected is a list somebody will forget
         * to add to. Requests with no X-Offline-Job header pass straight
         * through, so ordinary online use is untouched.
         */
        $middleware->appendToGroup('api', \App\Http\Middleware\ApplyOfflineJobOnce::class);

        /* Age brackets true to today — see AgeSectors for why not the scheduler. */
        $middleware->appendToGroup('api', \App\Http\Middleware\KeepAgeSectorsCurrent::class);

        /* A Lupon case whose three days to pay the filing fee ran out is
           closed unpaid — see FilingFeeDeadlines for why not the scheduler. */
        $middleware->appendToGroup('api', \App\Http\Middleware\CloseUnpaidLuponCases::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
