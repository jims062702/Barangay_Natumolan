<?php

/*
|--------------------------------------------------------------------------
| Which origins may call this API
|--------------------------------------------------------------------------
|
| A browser will not hand a cross-origin response to the page unless this
| list names the page's origin. When it is not named, the request itself
| still leaves and the server still answers — the browser simply refuses to
| pass the answer on, and the page sees a bare "Network Error" with no
| status and no message.
|
| That failure looks exactly like a dead server, which is why it cost an
| afternoon: the frontend was hard-coded to the Vite DEV port (5173), so the
| moment anybody ran a production build — `vite preview`, on 4173 or 4174 —
| logging in failed with an error that says nothing about CORS.
|
| So the ports are no longer guessed at. Locally, anything on this machine
| is allowed, whichever port a tool happens to pick. In production, only the
| real site is, and it is named in .env rather than here.
*/

$origins = array_values(array_filter([
    env('FRONTEND_URL'),
    env('APP_URL'),
]));

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    /*
     * Production: only what .env names. An empty list here is not an
     * oversight — it means FRONTEND_URL was never set for the deployment,
     * and every browser call will fail until somebody sets it. Failing
     * loudly is the point; a wildcard in production would let any site on
     * the internet make calls with a resident's session attached.
     */
    'allowed_origins' => $origins,

    /*
     * Development and the local preview build: this machine, any port.
     *
     * `vite dev` takes 5173, `vite preview` takes 4173 — or 4174, or 4175,
     * whichever is free when it starts. Listing them is a losing game, and
     * the one that is missing is always the one being used.
     *
     * Only ever localhost and 127.0.0.1, and only when the app is not in
     * production. Nothing off this machine matches.
     */
    'allowed_origins_patterns' => env('APP_ENV') === 'production'
        ? []
        : ['#^http://(localhost|127\.0\.0\.1)(:\d+)?$#'],

    'allowed_headers' => ['*'],

    'exposed_headers' => [
        /*
         * The filename the office sees on a downloaded export. Without this
         * the browser hides the header from the page and every export saves
         * under the fallback name the client guessed.
         */
        'Content-Disposition',
    ],

    'max_age' => 0,

    'supports_credentials' => true,

];
