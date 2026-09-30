<?php

namespace App\Services\Health;

use App\Models\Resident\Resident;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Who a child's parents are, and who a mother's children are — as the
 * Population Office's register records them, and never further.
 *
 * READ ONLY. The health station references family information; the
 * Population Office keeps it. Nothing here writes resident_parents, a
 * spouse or a household, and nothing here is inferred from a surname, an
 * address, a household or a marriage: a child is a mother's child because
 * the register says so (resident_parents, parent_role Mother), and a
 * child's father is the one the register names for that child.
 */
final class ParentLinks
{
    private const PERSON = ['residents.id', 'resident_number', 'first_name', 'middle_name', 'last_name', 'suffix',
        'gender', 'birthdate', 'zone_purok', 'address', 'contact_number', 'life_status', 'record_type', 'spouse_id'];

    /**
     * A child's mother and father as the register records them.
     *
     * @return array{mother: ?Resident, father: ?Resident}
     */
    public function registerParents(Resident $child): array
    {
        $parents = $child->parents()->select(self::PERSON)->get();

        return [
            'mother' => $parents->first(fn ($p) => $p->pivot->parent_role === 'Mother'),
            'father' => $parents->first(fn ($p) => $p->pivot->parent_role === 'Father'),
        ];
    }

    /**
     * The children the register lists this woman as the MOTHER of, eldest
     * first, each with the father the register names for that child (or
     * none). A duplicate merged into another record is not a child.
     *
     * @return Collection<int, array{child: Resident, father: ?Resident}>
     */
    public function childrenOf(Resident $mother): Collection
    {
        $children = $mother->children()
            ->wherePivot('parent_role', 'Mother')
            ->whereNull('residents.merged_into_id')
            ->select(self::PERSON)
            ->orderBy('birthdate')
            ->orderBy('residents.id')
            ->get();

        if ($children->isEmpty()) {
            return collect();
        }

        $fatherIds = DB::table('resident_parents')
            ->whereIn('child_id', $children->pluck('id'))
            ->where('parent_role', 'Father')
            ->pluck('parent_id', 'child_id');
        $fathers = Resident::select(array_map(fn ($c) => str_replace('residents.', '', $c), self::PERSON))
            ->whereIn('id', $fatherIds->values())
            ->get()
            ->keyBy('id');

        return $children->map(fn (Resident $child) => [
            'child' => $child,
            'father' => $fathers->get($fatherIds->get($child->id)),
        ])->values();
    }

    /** Whether the register lists this woman as the mother of this child. */
    public function isMotherOf(int $motherId, int $childId): bool
    {
        return DB::table('resident_parents')
            ->where('parent_id', $motherId)
            ->where('child_id', $childId)
            ->where('parent_role', 'Mother')
            ->exists();
    }

    /** A person as the health pages show them — read from the register. */
    public function person(?Resident $r): ?array
    {
        if (! $r) {
            return null;
        }

        return [
            'id' => $r->id,
            'name' => $r->full_name,
            'resident_number' => $r->resident_number,
            'sex' => in_array($r->gender, ['Male', 'Female'], true) ? $r->gender : null,
            'birthdate' => $r->birthdate?->toDateString(),
            'age' => $r->birthdate?->age,
            'zone_purok' => $r->zone_purok,
            'address' => $r->address,
            'contact_number' => $r->contact_number,
            'deceased' => $r->isDeceased(),
        ];
    }
}
