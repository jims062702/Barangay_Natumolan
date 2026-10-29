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

$configuredOrigins = array_filter(array_map('trim', explode(',', (string) env('FRONTEND_URL', ''))));
$origins = array_values(array_filter(array_merge([
    env('APP_URL'),
], $configuredOrigins)));

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
     * Development and local preview builds: this machine and dev tunnels.
     *
     * In non-production environments, allow localhost, local LAN IPs,
     * and dev tunnels (e.g. devtunnels.ms, ngrok, cloudflare tunnels)
     * so mobile and remote browser testing through tunnels works smoothly.
     */
    'allowed_origins_patterns' => env('APP_ENV') === 'production'
        ? []
        : [
            '#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#',
            '#^https?://.*\.devtunnels\.ms(:\d+)?$#',
            '#^https?://.*\.ngrok(-free)?\.(app|io)(:\d+)?$#',
            '#^https?://.*\.trycloudflare\.com(:\d+)?$#',
            '#^https?://(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$#',
        ],

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
