<?php

namespace App\Services\Service;

use App\Models\Service\Certificate;
use App\Services\Cloudinary\CloudinaryService;
use Illuminate\Support\Facades\Storage;

/**
 * The counter photograph on a Barangay Clearance with Picture.
 * Stored in Cloudinary with local public disk fallback.
 */
final class CertificatePhoto
{
    public const DIRECTORY = 'certificate-photos';

    /**
     * A data URL, decoded, checked to be a real image, and written to Cloudinary storage.
     *
     * Returns null for anything that is not a genuine JPEG, PNG or WebP within
     * the same 5 MB limit a normal upload has.
     */
    public function storeDataUrl(string $dataUrl): ?string
    {
        if (! preg_match('/^data:image\/(jpeg|png|webp);base64,(.+)$/s', $dataUrl, $parts)) {
            return null;
        }

        $bytes = base64_decode($parts[2], true);

        if ($bytes === false || strlen($bytes) === 0 || strlen($bytes) > 5 * 1024 * 1024) {
            return null;
        }

        $info = @getimagesizefromstring($bytes);

        if ($info === false || ! in_array($info['mime'] ?? '', ['image/jpeg', 'image/png', 'image/webp'], true)) {
            return null;
        }

        $cloudinary = app(CloudinaryService::class);
        $url = $cloudinary->upload($dataUrl, self::DIRECTORY);
        if ($url) {
            return $url;
        }

        $extension = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$info['mime']];
        $path = self::DIRECTORY . '/' . bin2hex(random_bytes(20)) . '.' . $extension;

        Storage::disk('public')->put($path, $bytes);

        return $path;
    }

    /** Swaps in a new photograph; the one it replaces goes, rather than accumulating. */
    public function attach(Certificate $certificate, string $path): void
    {
        if ($certificate->photo_path) {
            $cloudinary = app(CloudinaryService::class);
            if ($cloudinary->isCloudinaryUrl($certificate->photo_path)) {
                $cloudinary->delete($certificate->photo_path);
            } else {
                Storage::disk('public')->delete($certificate->photo_path);
            }
        }

        $certificate->update(['photo_path' => $path]);
    }
}
