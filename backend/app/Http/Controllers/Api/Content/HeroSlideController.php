<?php

namespace App\Http\Controllers\Api\Content;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Content\ReorderHeroSlidesRequest;
use App\Http\Requests\Content\StoreHeroSlideRequest;
use App\Http\Requests\Content\UpdateHeroSlideRequest;
use App\Models\Content\HeroSlide;
use App\Services\Content\LandingCache;
use App\Support\PublicUpload;

/**
 * Home-section carousel pictures — managed by the SK office.
 */
class HeroSlideController extends BaseController
{
    public function index()
    {
        return $this->success(
            HeroSlide::orderBy('sort_order')->orderBy('id')->get(),
            'Hero slides retrieved'
        );
    }

    /** Reorder slides (first id = shown first). */
    public function reorder(ReorderHeroSlidesRequest $request)
    {
        foreach ($request->validated()['ids'] as $index => $id) {
            HeroSlide::where('id', $id)->update(['sort_order' => $index]);
        }
        LandingCache::clearHeroSlides();

        return $this->success(null, 'Order updated');
    }

    public function store(StoreHeroSlideRequest $request)
    {
        $validated = $request->validated();

        $path = PublicUpload::store($request->file('image'), 'heroes');

        $slide = HeroSlide::create([
            'title' => $validated['title'] ?? null,
            'subtitle' => $validated['subtitle'] ?? null,
            'image_path' => $path,
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_active' => $request->boolean('is_active', true),
            'created_by' => auth()->id(),
        ]);
        LandingCache::clearHeroSlides();

        return $this->success($slide, 'Hero slide added', 201);
    }

    public function update(UpdateHeroSlideRequest $request, HeroSlide $heroSlide)
    {
        $validated = $request->validated();

        if ($request->hasFile('image')) {
            $validated['image_path'] = PublicUpload::replace($heroSlide->image_path, $request->file('image'), 'heroes');
        }
        unset($validated['image']);

        if ($request->has('is_active')) {
            $validated['is_active'] = $request->boolean('is_active');
        }

        $heroSlide->update($validated);
        LandingCache::clearHeroSlides();

        return $this->success($heroSlide, 'Hero slide updated');
    }

    public function destroy(HeroSlide $heroSlide)
    {
        PublicUpload::delete($heroSlide->image_path);
        $heroSlide->delete();
        LandingCache::clearHeroSlides();

        return $this->success(null, 'Hero slide deleted');
    }
}
