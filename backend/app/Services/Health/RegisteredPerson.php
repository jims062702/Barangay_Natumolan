<?php

namespace App\Services\Health;

use App\Models\Resident\Resident;
use Illuminate\Validation\ValidationException;

/**
 * The people the health station records are the Population Office's
 * residents — checked here, on the server, whatever the form filtered.
 *
 * A picker that shows only women is a convenience; a request can carry any
 * id. So the rules are enforced where the record is made: the person is on
 * the register (not a duplicate merged away), and a mother is a woman.
 */
final class RegisteredPerson
{
    public const NOT_FOUND = 'Resident not found. Please coordinate with the Population Office to register '
        . 'or update the resident before creating a health record.';

    /**
     * A woman on the register — a mother, a pregnancy, a prenatal record.
     * `living` refuses one recorded as deceased (a pregnancy cannot be
     * registered for her; her children's records still can be).
     */
    public function woman(mixed $id, string $field = 'mother_id', bool $living = false): Resident
    {
        $resident = is_numeric($id) ? Resident::whereNull('merged_into_id')->find((int) $id) : null;

        if (! $resident) {
            throw ValidationException::withMessages([$field => self::NOT_FOUND]);
        }

        if ($resident->gender !== 'Female') {
            throw ValidationException::withMessages([
                $field => "{$resident->full_name} is not recorded as female on the register. "
                    . 'If that is wrong, the Population Office corrects it.',
            ]);
        }

        if ($living && $resident->isDeceased()) {
            throw ValidationException::withMessages([
                $field => "{$resident->full_name} is recorded as deceased on the register.",
            ]);
        }

        return $resident;
    }
}
