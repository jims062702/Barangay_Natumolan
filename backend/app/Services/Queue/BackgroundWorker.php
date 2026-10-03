<?php

namespace App\Services\Queue;

use Illuminate\Support\Facades\Log;

class BackgroundWorker
{
    /**
     * Spawns a background queue worker to process pending jobs if one is not already processing.
     * Never blocks the HTTP request.
     */
    public static function dispatch(): void
    {
        try {
            $php = PHP_BINARY ?: 'C:\\xampp\\php\\php.exe';
            $artisan = base_path('artisan');
            $vbs = base_path('run_bg.vbs');

            if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
                if (file_exists($vbs)) {
                    $cmd = sprintf('wscript //B "%s" "%s" "%s" "queue:work" "--stop-when-empty"', $vbs, $php, $artisan);
                    pclose(popen($cmd, 'r'));
                } else {
                    $cmd = sprintf('cmd /c start /B "" "%s" "%s" queue:work --stop-when-empty > NUL 2>&1', $php, $artisan);
                    pclose(popen($cmd, 'r'));
                }
            } else {
                $cmd = sprintf('"%s" "%s" queue:work --stop-when-empty > /dev/null 2>&1 &', $php, $artisan);
                exec($cmd);
            }
        } catch (\Throwable $e) {
            Log::debug('Background worker dispatch error: ' . $e->getMessage());
        }
    }
}
