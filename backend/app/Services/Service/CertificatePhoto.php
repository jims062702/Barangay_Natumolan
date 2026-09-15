<?php

namespace App\Services\Service;

use App\Models\Service\Certificate;
use Illuminate\Support\Facades\Storage;

/**
 * The counter photograph on a Barangay Clearance with Picture.
 *
 * The two thumbmarks are NOT captured. They are inked onto the printed
 * sheet, and a system that offered to capture them would be claiming to
 * have witnessed something it did not.
 */
final class CertificatePhoto
{
    public const DIRECTORY = 'certificate-photos';

    /**
     * A data URL, decoded, checked to be a real image, and written to storage.
     *
     * Returns null for anything that is not a genuine JPEG, PNG or WebP within
     * the same 5 MB limit a normal upload has. The data arrives from a device
     * and is decoded here, so it is treated as untrusted: the declared type is
     * not believed until the bytes themselves say they are an image.
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

        $extension = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$info['mime']];
        $path = self::DIRECTORY . '/' . bin2hex(random_bytes(20)) . '.' . $extension;

        Storage::disk('public')->put($path, $bytes);

        return $path;
    }

    /** Swaps in a new photograph; the one it replaces goes, rather than accumulating. */
    public function attach(Certificate $certificate, string $path): void
    {
        if ($certificate->photo_path) {
            Storage::disk('public')->delete($certificate->photo_path);
        }

        $certificate->update(['photo_path' => $path]);
    }
}
