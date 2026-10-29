<?php

namespace App\Console\Commands;

use App\Models\Content\Announcement;
use App\Models\Content\HeroSlide;
use App\Models\Council\Official;
use App\Models\Service\Certificate;
use App\Services\Cloudinary\CloudinaryService;
use App\Services\Content\LandingCache;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class MigrateImagesToCloudinary extends Command
{
    protected $signature = 'cloudinary:migrate-existing';
    protected $description = 'Migrate existing locally-stored images to Cloudinary and update database links';

    public function handle(CloudinaryService $cloudinary): int
    {
        $this->info('Starting migration of local images to Cloudinary...');

        // 1. Announcements
        $announcements = Announcement::whereNotNull('image_path')
            ->where('image_path', 'not like', 'http%')
            ->get();

        $this->info("Found {$announcements->count()} announcement(s) with local images.");

        foreach ($announcements as $ann) {
            $localPath = Storage::disk('public')->path($ann->image_path);
            if (file_exists($localPath)) {
                $this->line("Uploading Announcement #{$ann->id}: {$ann->image_path}");
                $url = $cloudinary->upload($localPath, 'news');
                if ($url) {
                    $ann->update(['image_path' => $url]);
                    $this->info(" -> Success: {$url}");
                } else {
                    $this->error(" -> Failed to upload: {$ann->image_path}");
                }
            } else {
                $this->warn(" -> Local file not found: {$localPath}");
            }
        }

        // 2. Hero Slides
        $slides = HeroSlide::whereNotNull('image_path')
            ->where('image_path', 'not like', 'http%')
            ->get();

        $this->info("Found {$slides->count()} hero slide(s) with local images.");

        foreach ($slides as $slide) {
            $localPath = Storage::disk('public')->path($slide->image_path);
            if (file_exists($localPath)) {
                $this->line("Uploading HeroSlide #{$slide->id}: {$slide->image_path}");
                $url = $cloudinary->upload($localPath, 'heroes');
                if ($url) {
                    $slide->update(['image_path' => $url]);
                    $this->info(" -> Success: {$url}");
                } else {
                    $this->error(" -> Failed to upload: {$slide->image_path}");
                }
            } else {
                $this->warn(" -> Local file not found: {$localPath}");
            }
        }

        // 3. Officials
        $officials = Official::whereNotNull('photo_path')
            ->where('photo_path', 'not like', 'http%')
            ->get();

        $this->info("Found {$officials->count()} official(s) with local photos.");

        foreach ($officials as $official) {
            $localPath = Storage::disk('public')->path($official->photo_path);
            if (file_exists($localPath)) {
                $this->line("Uploading Official #{$official->id}: {$official->photo_path}");
                $url = $cloudinary->upload($localPath, 'officials');
                if ($url) {
                    $official->update(['photo_path' => $url]);
                    $this->info(" -> Success: {$url}");
                } else {
                    $this->error(" -> Failed to upload: {$official->photo_path}");
                }
            } else {
                $this->warn(" -> Local file not found: {$localPath}");
            }
        }

        // 4. Certificates
        $certificates = Certificate::whereNotNull('photo_path')
            ->where('photo_path', 'not like', 'http%')
            ->get();

        $this->info("Found {$certificates->count()} certificate(s) with local photos.");

        foreach ($certificates as $cert) {
            $localPath = Storage::disk('public')->path($cert->photo_path);
            if (file_exists($localPath)) {
                $this->line("Uploading Certificate #{$cert->id}: {$cert->photo_path}");
                $url = $cloudinary->upload($localPath, 'certificate-photos');
                if ($url) {
                    $cert->update(['photo_path' => $url]);
                    $this->info(" -> Success: {$url}");
                } else {
                    $this->error(" -> Failed to upload: {$cert->photo_path}");
                }
            } else {
                $this->warn(" -> Local file not found: {$localPath}");
            }
        }

        // Clear cached landing responses
        LandingCache::clearHeroSlides();
        LandingCache::clearOfficials();

        $this->info('Image migration to Cloudinary complete!');

        return Command::SUCCESS;
    }
}
