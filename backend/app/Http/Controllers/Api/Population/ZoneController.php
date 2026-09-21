<?php

namespace App\Http\Controllers\Api\Population;

use App\Http\Controllers\Api\BaseController;
use App\Models\Population\Bhw;
use App\Models\Population\Zone;
use App\Models\Resident\Resident;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The zones of the barangay, and which BHW covers each.
 *
 * READING is open to any signed-in staff account, because every form that
 * asks where somebody lives needs the list — the registry intake, the census,
 * the household record. WRITING is the Population Office's alone: they are
 * the office that knows when a zone splits, and a list every desk could edit
 * is a list that disagrees with itself by Friday.
 */
class ZoneController extends BaseController
{
    /** Every zone in order, with its worker. Read by every office. */
    public function index(Request $request)
    {
        $zones = Zone::with('bhw:id,name,contact_number,is_active')
            ->when(
                /* Forms ask for the ones still in use; the management screen
                   asks for all of them, retired ones included. */
                ! $request->boolean('include_inactive'),
                fn ($query) => $query->where('is_active', true)
            )
            ->inOrder()
            ->get();

        return $this->success([
            'zones' => $zones,
            'bhws' => Bhw::orderBy('name')->get(),
        ], 'Zones retrieved');
    }

    public function store(Request $request)
    {
        $validated = $request->validate($this->rules(), $this->messages());

        $zone = Zone::create($validated + ['is_active' => true]);

        return $this->success($zone->load('bhw'), "{$zone->name} was added.");
    }

    public function update(Request $request, Zone $zone)
    {
        $validated = $request->validate($this->rules($zone), $this->messages());

        $zone->update($validated);

        return $this->success($zone->load('bhw'), "{$zone->name} was updated.");
    }

    /**
     * Removes a zone, but never one people are recorded in.
     *
     * Deleting it would leave those residents and households holding the
     * name of a place that no longer exists — readable, but no longer
     * choosable, so the next person to edit one of those records could not
     * save it without moving them somewhere they do not live.
     *
     * The office is told to retire it instead: it stops being offered on
     * forms and everybody already in it stays where they are.
     */
    public function destroy(Zone $zone)
    {
        $residents = Resident::where('zone_purok', $zone->name)->count();
        $households = DB::table('households')->where('zone_purok', $zone->name)->count();

        if ($residents > 0 || $households > 0) {
            return $this->error(
                "{$zone->name} still has {$residents} resident(s) and {$households} household(s) "
                . 'recorded in it, so it cannot be deleted. Switch it off instead — it stops '
                . 'appearing on forms and everybody already recorded there stays as they are.',
                422
            );
        }

        $name = $zone->name;
        $zone->delete();

        return $this->success(null, "{$name} was removed.");
    }

    private function rules(?Zone $zone = null): array
    {
        return [
            'name' => [
                'required', 'string', 'max:40',
                Rule::unique('zones', 'name')->ignore($zone?->id),
            ],
            'bhw_id' => ['nullable', 'integer', 'exists:bhws,id'],
            'is_active' => ['boolean'],
        ];
    }

    private function messages(): array
    {
        return [
            'name.unique' => 'There is already a zone with that name.',
        ];
    }
}
