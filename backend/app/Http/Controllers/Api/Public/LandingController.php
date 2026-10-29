<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Api\BaseController;
use App\Models\Content\Announcement;
use App\Models\Content\HeroSlide;
use App\Models\Council\Official;
use App\Models\Household\Household;
use App\Models\Resident\Resident;
use App\Services\Content\LandingCache;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/** What the landing page shows every visitor, cached until the office changes it. */
class LandingController extends BaseController
{
    /**
     * Active home-section carousel pictures (SK-managed).
     * Cached until the SK office changes them — this endpoint is hit by
     * every landing-page visitor.
     */
    public function heroSlides()
    {
        $slides = Cache::remember(LandingCache::HERO_KEY, now()->addDay(), fn () =>
            HeroSlide::where('is_active', true)
                ->orderBy('sort_order')->orderBy('id')
                ->get()->toArray()
        );

        return $this->success(self::pictures($slides, 'image_path', 'image_url'), 'Hero slides retrieved');
    }

    /** Active officials grouped Barangay / SK (SK-managed). Cached. */
    public function officials()
    {
        $grouped = Cache::remember(LandingCache::OFFICIALS_KEY, now()->addDay(), function () {
            $officials = Official::where('is_active', true)->ordered()->get();

            return [
                'barangay' => $officials->where('group', 'Barangay')->values()->toArray(),
                'sk' => $officials->where('group', 'SK')->values()->toArray(),
            ];
        });

        return $this->success([
            'barangay' => self::pictures($grouped['barangay'] ?? [], 'photo_path', 'photo_url'),
            'sk' => self::pictures($grouped['sk'] ?? [], 'photo_path', 'photo_url'),
        ], 'Officials retrieved');
    }

    /**
     * Public "barangay at a glance" counts, sourced from the Population
     * Office registry. Aggregate numbers only — no personal data. Cached and
     * refreshed whenever the registry changes (see LandingCache::clearStats).
     */
    public function stats()
    {
        $stats = Cache::remember(LandingCache::STATS_KEY, now()->addHour(), fn () => [
            // `bonafide` matters here: relatives who live outside the
            // barangay are on the register so families can be recorded, and
            // counting them would overstate the population publicly.
            'registered_residents' => Resident::bonafide()->where('is_active', true)->count(),
            'households' => Household::count(),
            'puroks' => Resident::bonafide()->where('is_active', true)
                ->whereNotNull('zone_purok')
                ->distinct()
                ->count('zone_purok'),
        ]);

        return $this->success($stats, 'Barangay statistics');
    }

    /**
     * Everything the public news page needs, in one call.
     *
     * The page shows three things at once — the chips with their counts, the
     * posts of whichever kind is chosen, and the events still to come. Three
     * requests for one screen is three chances for it to arrive in pieces.
     *
     * Cached for six hours and cleared the moment a post is saved, so the
     * office never has to wait for a page they have just published.
     */
    public function announcements(Request $request)
    {
        $page = max(1, (int) $request->query('page', 1));
        $category = (string) $request->query('category', '');
        $key = LandingCache::announcementsKey($page, $category);

        $result = Cache::remember($key, now()->addHours(6), function () use ($category) {
            $query = Announcement::public()->with('creator:id,name');

            if ($category !== '') {
                $query->where('category', $category);
            }

            $posts = $query->orderBy('sort_order')->orderByDesc('published_at')
                /* A tiebreaker, or two posts saved in the same minute swap
                   places in the grid on every reload. */
                ->orderByDesc('id')
                ->paginate(12)->toArray();

            return $posts + [
                'upcoming' => Announcement::public()->with('creator:id,name')
                    ->upcoming()->limit(6)->get()->toArray(),
                'counts' => Announcement::public()
                    ->selectRaw('category, COUNT(*) as total')
                    ->groupBy('category')->pluck('total', 'category'),
            ];
        });

        $result['data'] = self::pictures($result['data'] ?? [], 'image_path', 'image_url');
        $result['upcoming'] = self::pictures($result['upcoming'] ?? [], 'image_path', 'image_url');

        return $this->success($result, 'Announcements retrieved');
    }

    /**
     * The pictures' addresses, made for THIS request — never taken from the cache.
     *
     * A picture's address carries the host it was asked through
     * (asset()). Kept in the cache, the list carried the address of
     * whoever happened to fill it: once that was a test server on
     * 127.0.0.1:8197, and for the next six hours every visitor was sent
     * there for the pictures — which showed broken under "All" and fine
     * under "Announcements", a list cached by somebody else. The same
     * happens the day the first visitor after a post reaches the site by
     * the office's LAN address and everybody else by its name.
     *
     * So the cache keeps the stored path, and the address is made here from
     * it, for the host this visitor used.
     */
    private static function pictures(iterable $rows, string $pathKey, string $urlKey): array
    {
        /* A list cached before this change holds models, not arrays. */
        $rows = $rows instanceof \Illuminate\Contracts\Support\Arrayable ? $rows->toArray() : (array) $rows;

        return array_map(function ($row) use ($pathKey, $urlKey) {
            if ($row instanceof \Illuminate\Contracts\Support\Arrayable) {
                $row = $row->toArray();
            }
            if (is_array($row) && array_key_exists($pathKey, $row)) {
                $val = $row[$pathKey];
                $row[$urlKey] = $val
                    ? ((str_starts_with($val, 'http://') || str_starts_with($val, 'https://')) ? $val : asset(Storage::url($val)))
                    : null;
            }

            return $row;
        }, array_values($rows));
    }

    /** One published announcement + related posts (same category first). */
    public function announcement(Announcement $announcement)
    {
        if ($announcement->status !== 'Published') {
            return $this->error('Announcement not found', 404);
        }

        $announcement->load('creator:id,name');

        $related = Announcement::public()->with('creator:id,name')
            ->where('id', '!=', $announcement->id)
            ->orderByRaw('CASE WHEN category = ? THEN 0 ELSE 1 END', [$announcement->category])
            ->orderBy('sort_order')
            ->orderByDesc('published_at')
            ->limit(6)
            ->get();

        return $this->success([
            'announcement' => $announcement,
            'related' => $related,
        ], 'Announcement retrieved');
    }
}
