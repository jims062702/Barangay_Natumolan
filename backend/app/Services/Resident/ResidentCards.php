<?php

namespace App\Services\Resident;

use App\Models\Account\User;
use App\Models\Resident\Resident;
use App\Models\Resident\ResidentCard;
use App\Support\Signatories;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * THE BARANGAY RESIDENT ID — issued, drawn, and checked. One place, so the
 * Online Complaint, the VAWC report, the QR scan page and the portal all
 * accept and refuse the same cards for the same reasons.
 *
 * WHAT THE QR HOLDS: a twelve-character random code (also printed under the
 * QR, for when a photo is too blurred to scan), and nothing else. No name, no
 * birthday, no address — a code that means nothing without this system. It
 * is checked by:
 *
 *   1. being a well-formed code at all;
 *   2. belonging to a card this barangay issued (looked up by keyed hash);
 *   3. that card still being the resident's CURRENT one — a lost card stops
 *      working the day its replacement is printed;
 *   4. the resident still being a resident: on the register as living here,
 *      active, alive, and not a duplicate merged into another record.
 *
 * Nobody is ever created or changed by a check. A card that cannot be matched
 * to a resident is simply not verified, and the person files as they are.
 */
final class ResidentCards
{
    /** Crockford's base-32: no I, L, O or U, so a hand-typed code survives. */
    public const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

    public const LENGTH = 12;

    /**
     * The code in whatever form it arrives — the QR's full link, the printed
     * "7K3M-Q9TD-X2PA", lower case, with an O for a 0 — reduced to its twelve
     * characters, or null when it cannot be one.
     */
    public static function normalise(?string $raw): ?string
    {
        $raw = trim((string) $raw);
        if ($raw === '') {
            return null;
        }

        if (preg_match('~/id/([A-Za-z0-9-]+)~', $raw, $m)) {
            $raw = $m[1];
        }

        $code = strtr(strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', $raw)), ['O' => '0', 'I' => '1', 'L' => '1', 'U' => 'V']);

        return strlen($code) === self::LENGTH && strspn($code, self::ALPHABET) === self::LENGTH ? $code : null;
    }

    public static function hash(string $code): string
    {
        return hash_hmac('sha256', $code, (string) config('app.key'));
    }

    /** "7K3MQ9TDX2PA" → "7K3M-Q9TD-X2PA", as printed. */
    public static function format(string $code): string
    {
        return implode('-', str_split($code, 4));
    }

    private static function newCode(): string
    {
        do {
            $code = '';
            for ($i = 0; $i < self::LENGTH; $i++) {
                $code .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
            }
        } while (ResidentCard::where('token_hash', self::hash($code))->exists());

        return $code;
    }

    /** Whether this record may hold a Barangay Resident ID at all. */
    public static function eligible(Resident $resident): bool
    {
        return $resident->record_type !== Resident::NON_RESIDENT
            && (bool) $resident->is_active
            && $resident->life_status !== Resident::DECEASED
            && ! $resident->merged_into_id;
    }

    public function current(Resident $resident): ?ResidentCard
    {
        return ResidentCard::where('resident_id', $resident->id)
            ->where('status', ResidentCard::ACTIVE)
            ->latest('id')
            ->first();
    }

    /**
     * A card for somebody who holds none — never a second one.
     *
     * The resident's row is locked for the length of it, so two presses (or a
     * bulk issue and a single one) cannot both find "no card" and both issue;
     * and the database refuses a second Active card for the same person
     * whatever reaches it (resident_cards.active_for is unique).
     *
     * @throws CardAlreadyActive with the card they already hold
     */
    public function issue(Resident $resident, string $via, ?User $by = null): ResidentCard
    {
        try {
            return DB::transaction(function () use ($resident, $via, $by) {
                Resident::whereKey($resident->id)->lockForUpdate()->first();

                if ($active = $this->current($resident)) {
                    throw new CardAlreadyActive($active);
                }

                return $this->create($resident, $via, $by, null, null);
            });
        } catch (QueryException $e) {
            /* Another request won the race the lock did not see: theirs stands. */
            if ($e->getCode() === '23000' && ($active = $this->current($resident))) {
                throw new CardAlreadyActive($active);
            }
            throw $e;
        }
    }

    /**
     * A NEW card in place of the one they hold — lost, damaged, or its
     * details changed. The old one is revoked in the same breath, kept in the
     * history with who replaced it, when and why; there is never a moment
     * with two valid cards for one person.
     */
    public function reissue(Resident $resident, string $via, ?User $by = null, ?string $reason = null): ResidentCard
    {
        return DB::transaction(function () use ($resident, $via, $by, $reason) {
            Resident::whereKey($resident->id)->lockForUpdate()->first();

            $old = $this->current($resident);
            $old?->update([
                'status' => ResidentCard::REVOKED,
                'revoked_at' => now(),
                'revoked_by' => $by?->id,
                'revoke_reason' => $reason
                    ? 'Replaced: ' . $reason
                    : 'Replaced by a new card issued through the ' . $via . '.',
            ]);

            return $this->create($resident, $via, $by, $old, $reason);
        });
    }

    /**
     * Cards for many residents at once — only those who hold none.
     *
     * Each is issued on its own (one failing does not undo the others), and
     * the answer says, person by person, who got a card and who was skipped
     * and why. Somebody who already holds a card is SKIPPED, never given a
     * second one.
     *
     * @param  int[]  $residentIds
     * @return array{issued: array<int, array>, skipped: array<int, array{resident_id: int, reason: string}>}
     */
    public function issueMany(array $residentIds, string $via, ?User $by = null): array
    {
        $issued = [];
        $skipped = [];

        foreach (array_values(array_unique(array_map('intval', $residentIds))) as $id) {
            $resident = Resident::find($id);
            if (! $resident) {
                $skipped[] = ['resident_id' => $id, 'reason' => 'not_found'];
                continue;
            }
            if (! self::eligible($resident)) {
                $skipped[] = ['resident_id' => $id, 'reason' => 'not_eligible'];
                continue;
            }
            try {
                $card = $this->issue($resident, $via, $by);
                $issued[] = self::cardData($card->load('resident'));
            } catch (CardAlreadyActive) {
                $skipped[] = ['resident_id' => $id, 'reason' => 'has_active'];
            }
        }

        return ['issued' => $issued, 'skipped' => $skipped];
    }

    private function create(Resident $resident, string $via, ?User $by, ?ResidentCard $replacing, ?string $reason): ResidentCard
    {
        $code = self::newCode();
        $count = ResidentCard::where('resident_id', $resident->id)->count();

        return ResidentCard::create([
            'resident_id' => $resident->id,
            'card_no' => 'RID-' . $resident->resident_number . '-' . str_pad((string) ($count + 1), 2, '0', STR_PAD_LEFT),
            'token_hash' => self::hash($code),
            'token' => $code,
            'status' => ResidentCard::ACTIVE,
            'action' => $count === 0 ? ResidentCard::ISSUED : ResidentCard::REISSUED,
            'replaces_card_id' => $replacing?->id,
            'reason' => $reason,
            'issued_via' => $via,
            'issued_by' => $by?->id,
            'issued_at' => now(),
        ]);
    }

    /** The resident's card, issuing their first one if they have none. */
    public function ensure(Resident $resident, string $via, ?User $by = null): ResidentCard
    {
        try {
            return $this->current($resident) ?? $this->issue($resident, $via, $by);
        } catch (CardAlreadyActive $e) {
            return $e->card;
        }
    }

    /** Every card the resident was ever issued, newest first — the history. */
    public function history(Resident $resident): array
    {
        return ResidentCard::with(['issuedBy:id,name', 'revokedBy:id,name'])
            ->where('resident_id', $resident->id)
            ->orderByDesc('id')
            ->get()
            ->map(fn (ResidentCard $c) => [
                'card_no' => $c->card_no,
                'status' => $c->status,
                'action' => $c->action,
                'issued_at' => $c->issued_at?->toIso8601String(),
                'issued_via' => $c->issued_via,
                'issued_by' => $c->issuedBy?->name,
                'replaces' => $c->replaces_card_id ? ResidentCard::whereKey($c->replaces_card_id)->value('card_no') : null,
                'reason' => $c->reason,
                'revoked_at' => $c->revoked_at?->toIso8601String(),
                'revoked_by' => $c->revokedBy?->name,
                'revoke_reason' => $c->revoke_reason,
            ])
            ->all();
    }

    /**
     * Where each of these residents stands — for the lists that issue in
     * bulk (a census form, a household). The card they hold, drawn data and
     * all, or none; and whether they may hold one at all.
     *
     * @param  int[]  $residentIds
     */
    public function standing(array $residentIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $residentIds)));
        $residents = Resident::whereIn('id', $ids)->get()->keyBy('id');
        $active = ResidentCard::with('resident')->whereIn('resident_id', $ids)->where('status', ResidentCard::ACTIVE)->get()->keyBy('resident_id');
        $counts = ResidentCard::whereIn('resident_id', $ids)->selectRaw('resident_id, COUNT(*) n')->groupBy('resident_id')->pluck('n', 'resident_id');

        return collect($ids)->map(fn (int $id) => [
            'resident_id' => $id,
            'found' => $residents->has($id),
            'eligible' => $residents->has($id) && self::eligible($residents[$id]),
            'card' => $active->has($id) ? self::cardData($active[$id]) : null,
            'issued_count' => (int) ($counts[$id] ?? 0),
        ])->all();
    }

    /**
     * Is this a valid Barangay Natumolan Resident ID?
     *
     * @return array{ok: bool, reason: string, message: string, card: ?ResidentCard, resident: ?Resident}
     */
    public function verify(?string $raw): array
    {
        $refuse = fn (string $reason, string $message, ?ResidentCard $card = null) => [
            'ok' => false, 'reason' => $reason, 'message' => $message, 'card' => $card, 'resident' => null,
        ];

        $code = self::normalise($raw);
        if (! $code) {
            return $refuse('unreadable', 'This is not a Barangay Natumolan Resident ID code.');
        }

        $card = ResidentCard::with('resident')->where('token_hash', self::hash($code))->first();
        if (! $card || ! $card->resident) {
            return $refuse('unknown', 'No Barangay Natumolan Resident ID carries this code.');
        }

        if ($card->status !== ResidentCard::ACTIVE) {
            return $refuse('revoked', 'This Resident ID is no longer valid — a newer card has been issued. '
                . 'Use the latest one: download it from My Profile, or ask the Population Office.', $card);
        }

        if (! self::eligible($card->resident)) {
            return $refuse('inactive', 'This Resident ID belongs to a record that is no longer active on the '
                . 'barangay register. Please visit the Population Office.', $card);
        }

        return ['ok' => true, 'reason' => 'verified', 'message' => 'ID verified.', 'card' => $card, 'resident' => $card->resident];
    }

    /**
     * What a check says to whoever made it — enough to know the card is good
     * and whose it is ("JU** DE** CR**"), and no more: never an address, a
     * birthday or a phone number.
     */
    public static function summary(array $check): array
    {
        $resident = $check['resident'];
        $age = $resident?->birthdate?->age;
        $isMinor = ($resident && $age !== null && $age < 18);

        return [
            'valid' => $check['ok'],
            'reason' => $check['reason'],
            'message' => $check['message'],
            'resident_number' => $resident?->resident_number,
            'masked_name' => $resident ? self::mask($resident->first_name . ' ' . $resident->last_name) : null,
            'issued_on' => $check['ok'] ? $check['card']?->issued_at?->toDateString() : null,
            'is_minor' => $isMinor,
            'age' => $age,
            'guardian_reminder' => $isMinor
                ? 'Notice: As a minor (17 years old and below), you must be accompanied by a parent or legal guardian when appearing at the Barangay Hall.'
                : null,
        ];
    }

    /**
     * A check, for a form that says what it is for (2026-09-30):
     *
     *   complaint   the Lupon's online complaint — the contact number on the
     *               record comes back as well, to fill in the form's box,
     *               where it stays theirs to change (a number changes more
     *               often than anybody tells the Population Office)
     *   vawc        the VAWC online complaint — the same, and a card whose
     *               record is not a woman's is refused: that complaint is
     *               filed by a woman (App\Services\Vawc\VawcComplainant)
     *
     * The number is the one the card itself carries — cardData prints it. The
     * page a scanned QR opens (summary alone) never shows it.
     */
    public static function formSummary(array $check, ?string $purpose): array
    {
        if ($purpose === 'vawc' && $check['ok']
            && ($refusal = \App\Services\Vawc\VawcComplainant::onlineRefusal($check['resident']))) {
            $check = ['ok' => false, 'reason' => 'not_a_woman', 'message' => $refusal, 'card' => $check['card'], 'resident' => null];
        }

        $summary = self::summary($check);

        if ($purpose !== null && $check['ok']) {
            $summary['contact_number'] = $check['resident']->contact_number ?: null;
        }

        return $summary;
    }

    /** "Juan Dela Cruz" → "JU** DE** CR**". */
    public static function mask(string $name): string
    {
        return collect(preg_split('/\s+/', mb_strtoupper(trim($name))))
            ->filter()
            ->map(fn (string $word) => mb_strlen($word) <= 2
                ? mb_substr($word, 0, 1) . '*'
                : mb_substr($word, 0, 2) . str_repeat('*', min(4, max(2, mb_strlen($word) - 2))))
            ->implode(' ');
    }

    /**
     * Nationality as the resident's RECORD holds it (Q7 of the RBIM, kept in
     * words — see App\Support\Nationality): FILIPINO, or what they are. The
     * record is the one source, so a correction on it is on the next card.
     * Null when nobody has recorded it — the card then says so rather than
     * assuming.
     */
    public static function nationality(Resident $resident): ?string
    {
        $nationality = trim((string) $resident->nationality);

        return $nationality === '' ? null : mb_strtoupper($nationality);
    }

    /** Where they live, in full — the register's address and purok, then the barangay. */
    public static function completeAddress(Resident $resident): string
    {
        $address = trim((string) $resident->address);
        $zone = trim((string) $resident->zone_purok);

        /* "Z-4" beside "Zone 4" says it twice. */
        $sameAsZone = $address !== '' && $zone !== ''
            && preg_replace('/\D/', '', $address) === preg_replace('/\D/', '', $zone)
            && preg_match('/^(z|zone|purok|p)[\s.-]*\d+$/i', $address);

        return implode(', ', array_filter([
            $sameAsZone ? null : ($address ?: null),
            $zone ?: null,
            'Barangay Natumolan, Tagoloan, Misamis Oriental',
        ]));
    }

    /**
     * Everything drawn on the card, straight from the register. The resident
     * cannot change any of it here: what the card says is what the barangay
     * holds, and a correction goes through the Population Office.
     */
    public static function cardData(ResidentCard $card): array
    {
        $resident = $card->resident;
        $middle = trim((string) $resident->middle_name);

        return [
            'resident_id' => $resident->id,
            'card_no' => $card->card_no,
            'nationality' => self::nationality($resident),
            /* The Punong Barangay's NAME on the back — never a signature image. */
            'punong_barangay' => Signatories::all()['punong_barangay'] ?? null,
            'resident_number' => $resident->resident_number,
            'last_name' => mb_strtoupper((string) $resident->last_name),
            'first_name' => mb_strtoupper(trim($resident->first_name . ' ' . $resident->suffix)),
            'middle_initial' => $middle !== '' ? mb_strtoupper(mb_substr($middle, 0, 1)) . '.' : '',
            'sex' => $resident->gender ? mb_strtoupper($resident->gender) : null,
            'zone_purok' => $resident->zone_purok,
            'address' => self::completeAddress($resident),
            'contact_number' => $resident->contact_number,
            'code' => self::format($card->token),
            'status' => $card->status,
            'issued_via' => $card->issued_via,
            'issued_at' => $card->issued_at?->toIso8601String(),
        ];
    }
}
