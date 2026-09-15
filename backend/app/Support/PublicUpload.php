<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Pictures kept on the public disk: officials' photos, post images, the
 * landing carousel. Replacing one removes the file it replaces, so an edited
 * post does not leave its old picture behind on the server.
 */
final class PublicUpload
{
    private const DISK = 'public';

    public static function store(UploadedFile $file, string $directory): string
    {
        return $file->store($directory, self::DISK);
    }

    public static function replace(?string $currentPath, UploadedFile $file, string $directory): string
    {
        self::delete($currentPath);

        return self::store($file, $directory);
    }

    public static function delete(?string $path): void
    {
        if ($path) {
            Storage::disk(self::DISK)->delete($path);
        }
    }
}
