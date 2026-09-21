<?php

namespace App\Http\Controllers\Api\Population;

use App\Http\Controllers\Api\BaseController;
use App\Models\Population\Bhw;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The barangay health workers, kept by the Population Office.
 *
 * Their AREAS are not edited here. A BHW's zones are the zones pointing at
 * her, so an assignment is made on the zone — one place to change it, and no
 * way for the two sides to disagree about who covers Zone 5.
 */
class BhwController extends BaseController
{
    public function store(Request $request)
    {
        $validated = $request->validate($this->rules(), $this->messages());

        $bhw = Bhw::create($validated + ['is_active' => true]);

        return $this->success($bhw, "{$bhw->name} was added.");
    }

    public function update(Request $request, Bhw $bhw)
    {
        $validated = $request->validate($this->rules($bhw), $this->messages());

        $bhw->update($validated);

        return $this->success($bhw, "{$bhw->name} was updated.");
    }

    /**
     * Removes a health worker who covers nothing.
     *
     * One who still holds zones is refused rather than quietly unassigned:
     * deleting her would leave those zones with nobody covering them and
     * nothing on screen to say it had happened. Move her zones first, or
     * switch her off — a retired worker keeps her name on the visits she
     * already made.
     */
    public function destroy(Bhw $bhw)
    {
        $zones = $bhw->zones()->count();

        if ($zones > 0) {
            return $this->error(
                "{$bhw->name} still covers {$zones} zone(s). Assign them to somebody else "
                . 'first, or switch her off instead of removing her.',
                422
            );
        }

        $name = $bhw->name;
        $bhw->delete();

        return $this->success(null, "{$name} was removed.");
    }

    private function rules(?Bhw $bhw = null): array
    {
        return [
            'name' => [
                'required', 'string', 'max:120',
                Rule::unique('bhws', 'name')->ignore($bhw?->id),
            ],
            'contact_number' => ['nullable', 'string', 'max:20'],
            'is_active' => ['boolean'],
        ];
    }

    private function messages(): array
    {
        return [
            'name.unique' => 'There is already a health worker with that name.',
        ];
    }
}
