<?php

namespace App\Support;

use App\Services\Cloudinary\CloudinaryService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Pictures uploaded to Cloudinary: officials' photos, post images, the
 * landing carousel. Replacing one removes the file it replaces from Cloudinary.
 * Falls back to local public disk if Cloudinary is temporarily unreachable.
 */
final class PublicUpload
{
    private const DISK = 'public';

    public static function store(UploadedFile|string $file, string $directory): string
    {
        $cloudinary = app(CloudinaryService::class);
        $url = $cloudinary->upload($file, $directory);

        if ($url) {
            return $url;
        }

        // Fallback to local storage if Cloudinary fails
        if ($file instanceof UploadedFile) {
            return $file->store($directory, self::DISK);
        }

        return '';
    }

    public static function replace(?string $currentPath, UploadedFile|string $file, string $directory): string
    {
        self::delete($currentPath);

        return self::store($file, $directory);
    }

    public static function delete(?string $path): void
    {
        if (! $path) {
            return;
        }

        $cloudinary = app(CloudinaryService::class);

        if ($cloudinary->isCloudinaryUrl($path)) {
            $cloudinary->delete($path);
        } else {
            Storage::disk(self::DISK)->delete($path);
        }
    }
}
