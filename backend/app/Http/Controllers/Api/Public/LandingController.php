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

        return $this->success($slides, 'Hero slides retrieved');
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

        return $this->success($grouped, 'Officials retrieved');
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
                    ->upcoming()->limit(6)->get(),
                'counts' => Announcement::public()
                    ->selectRaw('category, COUNT(*) as total')
                    ->groupBy('category')->pluck('total', 'category'),
            ];
        });

        return $this->success($result, 'Announcements retrieved');
    }

    /** One published announcement + up to 3 related posts (same category first). */
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
            ->limit(3)
            ->get();

        return $this->success([
            'announcement' => $announcement,
            'related' => $related,
        ], 'Announcement retrieved');
    }
}
