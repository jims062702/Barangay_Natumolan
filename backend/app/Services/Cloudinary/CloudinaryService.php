<?php

namespace App\Services\Cloudinary;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

/**
 * Cloudinary image storage service.
 * Handles uploading and removing images from Cloudinary directly via REST API.
 */
class CloudinaryService
{
    private string $cloudName;
    private string $apiKey;
    private string $apiSecret;
    private string $baseFolder;

    public function __construct()
    {
        $this->cloudName = (string) config('cloudinary.cloud_name', env('CLOUDINARY_CLOUD_NAME', 'dwauqhrdx'));
        $this->apiKey = (string) config('cloudinary.api_key', env('CLOUDINARY_API_KEY', '673695719246775'));
        $this->apiSecret = (string) config('cloudinary.api_secret', env('CLOUDINARY_API_SECRET', 'TkkOEHrQfQZYbJPLWT9fGKxzatQ'));
        $this->baseFolder = (string) config('cloudinary.folder', env('CLOUDINARY_FOLDER', 'barangay_natumolan'));
    }

    /**
     * Upload an image to Cloudinary.
     *
     * @param UploadedFile|string $file File instance, base64 data URL, or local file path
     * @param string $subfolder Optional folder under baseFolder (e.g. 'news', 'officials')
     * @return string|null The Cloudinary secure_url on success, or null on failure
     */
    public function upload(UploadedFile|string $file, string $subfolder = 'general'): ?string
    {
        if (empty($this->cloudName) || empty($this->apiKey) || empty($this->apiSecret)) {
            Log::error('Cloudinary credentials are not configured.');
            return null;
        }

        $folder = trim($this->baseFolder . '/' . trim($subfolder, '/'), '/');
        $timestamp = time();

        $paramsToSign = [
            'folder' => $folder,
            'timestamp' => $timestamp,
        ];

        $signature = $this->generateSignature($paramsToSign);

        $postFields = [
            'timestamp' => $timestamp,
            'api_key' => $this->apiKey,
            'signature' => $signature,
            'folder' => $folder,
        ];

        if ($file instanceof UploadedFile) {
            $postFields['file'] = new \CURLFile($file->getRealPath(), $file->getMimeType(), $file->getClientOriginalName());
        } elseif (is_string($file)) {
            if (str_starts_with($file, 'data:image/') || filter_var($file, FILTER_VALIDATE_URL)) {
                $postFields['file'] = $file;
            } elseif (file_exists($file)) {
                $mime = mime_content_type($file) ?: 'image/jpeg';
                $postFields['file'] = new \CURLFile($file, $mime, basename($file));
            } else {
                // If it's a raw base64 string without data prefix
                $postFields['file'] = 'data:image/jpeg;base64,' . $file;
            }
        } else {
            return null;
        }

        $url = "https://api.cloudinary.com/v1_1/{$this->cloudName}/image/upload";

        $response = $this->executeCurl($url, $postFields);

        if ($response && isset($response['secure_url'])) {
            return $response['secure_url'];
        }

        Log::error('Cloudinary upload failed', ['response' => $response]);
        return null;
    }

    /**
     * Delete an image from Cloudinary by its URL or public ID.
     */
    public function delete(?string $urlOrPublicId): bool
    {
        if (empty($urlOrPublicId)) {
            return false;
        }

        $publicId = $this->isCloudinaryUrl($urlOrPublicId)
            ? $this->extractPublicId($urlOrPublicId)
            : $urlOrPublicId;

        if (empty($publicId)) {
            return false;
        }

        $timestamp = time();
        $paramsToSign = [
            'public_id' => $publicId,
            'timestamp' => $timestamp,
        ];

        $signature = $this->generateSignature($paramsToSign);

        $postFields = [
            'public_id' => $publicId,
            'timestamp' => $timestamp,
            'api_key' => $this->apiKey,
            'signature' => $signature,
        ];

        $url = "https://api.cloudinary.com/v1_1/{$this->cloudName}/image/destroy";

        $response = $this->executeCurl($url, $postFields);

        return ($response['result'] ?? '') === 'ok';
    }

    /**
     * Checks if a string is a Cloudinary URL.
     */
    public function isCloudinaryUrl(?string $url): bool
    {
        if (! $url) {
            return false;
        }

        return str_contains($url, 'res.cloudinary.com') || str_starts_with($url, 'https://res.cloudinary.com');
    }

    /**
     * Extracts public_id from a Cloudinary URL.
     */
    public function extractPublicId(string $url): ?string
    {
        // Example: https://res.cloudinary.com/dwauqhrdx/image/upload/v1793175544/barangay_natumolan/news/xyz.jpg
        $parsed = parse_url($url, PHP_URL_PATH);
        if (! $parsed) {
            return null;
        }

        // Find position after /upload/
        $pos = strpos($parsed, '/image/upload/');
        if ($pos !== false) {
            $path = substr($parsed, $pos + strlen('/image/upload/'));
        } else {
            $pos = strpos($parsed, '/upload/');
            if ($pos === false) {
                return null;
            }
            $path = substr($parsed, $pos + strlen('/upload/'));
        }

        // Remove version number if present (e.g. v1234567890/)
        $path = preg_replace('#^v\d+/#', '', $path);

        // Remove extension (e.g. .jpg, .png)
        return preg_replace('/\.[^.]+$/', '', $path);
    }

    /**
     * Generate Cloudinary signature for parameters.
     */
    private function generateSignature(array $params): string
    {
        ksort($params);
        $parts = [];
        foreach ($params as $k => $v) {
            $parts[] = "{$k}={$v}";
        }

        return sha1(implode('&', $parts) . $this->apiSecret);
    }

    /**
     * Execute a cURL POST request and parse JSON response.
     */
    private function executeCurl(string $url, array $fields): ?array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $fields,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $raw = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err) {
            Log::error('Cloudinary cURL error: ' . $err);
            return null;
        }

        return json_decode($raw, true);
    }
}

