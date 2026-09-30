<?php

namespace App\Http\Controllers\Api\Content;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Content\ReorderAnnouncementsRequest;
use App\Http\Requests\Content\StoreAnnouncementRequest;
use App\Http\Requests\Content\UpdateAnnouncementRequest;
use App\Models\Content\Announcement;
use App\Services\Content\AnnouncementNotice;
use App\Services\Content\LandingCache;
use App\Support\PublicUpload;
use Illuminate\Http\Request;

/**
 * Staff-side post management (public reads happen in the public controllers).
 *
 * A barangay posts five different things and a resident wants them for five
 * different reasons — see Announcement::KINDS. Which fields a given kind is
 * allowed to carry is decided by Announcement::onlyFieldsForKind().
 */
class AnnouncementController extends BaseController
{
    public function index(Request $request)
    {
        $query = Announcement::with('creator:id,name');

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        /*
         * Counted BEFORE the status filter, so the chips keep saying how many
         * are in each pile while one of them is open.
         */
        $counts = $this->statusCounts(
            Announcement::query()->when(
                $request->filled('category'),
                fn ($q) => $q->where('category', $request->category)
            )
        );

        $page = $query->orderBy('sort_order')->latest('published_at')->latest('id')->paginate(15);

        return $this->success(
            $page->toArray() + ['status_counts' => $counts, 'kinds' => Announcement::KINDS],
            'Announcements retrieved'
        );
    }

    /** Reorder posts (first id = shown first). */
    public function reorder(ReorderAnnouncementsRequest $request)
    {
        foreach ($request->validated()['ids'] as $index => $id) {
            Announcement::where('id', $id)->update(['sort_order' => $index]);
        }
        LandingCache::clearAnnouncements();

        return $this->success(null, 'Order updated');
    }

    public function store(StoreAnnouncementRequest $request, AnnouncementNotice $notice)
    {
        $validated = $request->validated();

        if ($request->hasFile('image')) {
            $validated['image_path'] = PublicUpload::store($request->file('image'), 'news');
        }
        unset($validated['image']);

        $announcement = Announcement::create(
            Announcement::onlyFieldsForKind($validated) + [
                'created_by' => auth()->id(),
                'published_at' => ($validated['status'] ?? 'Draft') === 'Published' ? now() : null,
            ]
        );
        LandingCache::clearAnnouncements();

        /* Published straight away: it goes to every resident's bell now. */
        $told = $announcement->published_at ? $notice->toResidents($announcement) : 0;

        return $this->success(
            $announcement,
            $told > 0 ? "Post published — sent to {$told} resident account(s)." : 'Post created',
            201
        );
    }

    public function update(UpdateAnnouncementRequest $request, Announcement $announcement, AnnouncementNotice $notice)
    {
        $validated = $request->validated();

        if ($request->hasFile('image')) {
            $validated['image_path'] = PublicUpload::replace($announcement->image_path, $request->file('image'), 'news');
        }
        unset($validated['image']);

        $validated = Announcement::onlyFieldsForKind($validated, $announcement->category);

        /*
         * published_at is stamped the FIRST time a post goes out and never
         * again. It is the date on the post, and a correction two months
         * later does not make it new.
         */
        $firstRelease = ($validated['status'] ?? null) === 'Published' && ! $announcement->published_at;

        if ($firstRelease) {
            $validated['published_at'] = now();
        }

        $announcement->update($validated);
        LandingCache::clearAnnouncements();

        /* The first time it goes out, and only then, it reaches the bells. */
        $told = $firstRelease ? $notice->toResidents($announcement->fresh()) : 0;

        return $this->success(
            $announcement->fresh(),
            $told > 0 ? "Post published — sent to {$told} resident account(s)." : 'Post updated'
        );
    }

    public function destroy(Announcement $announcement, AnnouncementNotice $notice)
    {
        PublicUpload::delete($announcement->image_path);

        $notice->withdraw($announcement);

        $announcement->delete();
        LandingCache::clearAnnouncements();

        return $this->success(null, 'Post deleted');
    }
}
