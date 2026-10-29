<?php

namespace Tests\Unit;

use App\Services\Cloudinary\CloudinaryService;
use Tests\TestCase;

class CloudinaryServiceTest extends TestCase
{
    public function test_cloudinary_configuration(): void
    {
        $this->assertEquals('dwauqhrdx', config('cloudinary.cloud_name'));
        $this->assertEquals('673695719246775', config('cloudinary.api_key'));
        $this->assertEquals('TkkOEHrQfQZYbJPLWT9fGKxzatQ', config('cloudinary.api_secret'));
    }

    public function test_is_cloudinary_url_detection(): void
    {
        $service = app(CloudinaryService::class);

        $this->assertTrue($service->isCloudinaryUrl('https://res.cloudinary.com/dwauqhrdx/image/upload/v1234/test.jpg'));
        $this->assertFalse($service->isCloudinaryUrl('news/OZkg6KVBMwEplo8SI8UwCKJPMLw8W9PWp8h8TB7J.jpg'));
        $this->assertFalse($service->isCloudinaryUrl(null));
    }

    public function test_extract_public_id(): void
    {
        $service = app(CloudinaryService::class);

        $urlWithVersion = 'https://res.cloudinary.com/dwauqhrdx/image/upload/v1793175544/barangay_natumolan/news/xyz123.jpg';
        $this->assertEquals('barangay_natumolan/news/xyz123', $service->extractPublicId($urlWithVersion));

        $urlWithoutVersion = 'https://res.cloudinary.com/dwauqhrdx/image/upload/barangay_natumolan/officials/official_1.png';
        $this->assertEquals('barangay_natumolan/officials/official_1', $service->extractPublicId($urlWithoutVersion));
    }

    public function test_live_upload_and_delete_on_cloudinary(): void
    {
        $service = app(CloudinaryService::class);

        // 1x1 transparent png
        $testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

        $uploadedUrl = $service->upload($testDataUrl, 'unit_tests');

        $this->assertNotNull($uploadedUrl);
        $this->assertTrue(str_starts_with($uploadedUrl, 'https://res.cloudinary.com/dwauqhrdx/'));
        $this->assertStringContainsString('barangay_natumolan/unit_tests', $uploadedUrl);

        // Clean up test image
        $deleted = $service->delete($uploadedUrl);
        $this->assertTrue($deleted);
    }
}

