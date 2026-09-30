import { FiPlus, FiX } from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import { personName } from "../../../../shared/lib/names";
import { formatBirthdate, birthdateNote } from "../../../../shared/lib/birthdate";
import type { Resident } from "../../../../shared/types";
import { Row } from "./Row";
import { isAgeSector } from "../../lib/sectors";
import type { ResidentRecordState } from "../../hooks/useResidentRecord";

/**
 * Who the resident is, where they live, and the sectors they belong to.
 */
export function ResidentProfile({ ctx, resident, isOutside }: {
  ctx: ResidentRecordState;
  resident: Resident;
  isOutside: boolean;
}) {
  const { isBpo, setSectorOpen, removeSector } = ctx;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title="Personal information">
        <Row label="Full name" value={personName(resident)} />
        <Row label="Sex" value={resident.gender} />
        {/* A clerk about to copy this onto a certificate has to be able
            to see that it came from a census and not a birth certificate. */}
        <Row
          label="Birthdate"
          value={formatBirthdate(resident.birthdate, resident.birthdate_is_estimated) || null}
          hint={birthdateNote(resident.birthdate_is_estimated) || undefined}
        />
        <Row label="Place of birth" value={resident.birth_place} />
        {/* RBIM Q7 — printed on the Resident ID. */}
        <Row label="Nationality" value={resident.nationality} />
        <Row label="Civil status" value={resident.civil_status} />
        <Row label="Occupation" value={resident.occupation} />
        <Row label="Educational attainment" value={resident.educational_attainment} />
        {/* RBIM Q32 — where they vote. */}
        <Row label="Registered voter in" value={resident.registered_voter_in} />
        <Row label="Contact Number" value={resident.contact_number} />
        <Row label="Email" value={resident.email} />
      </Card>

      {/*
        A non-resident holds none of this. "Residency status: Permanent"
        beside somebody living in Cagayan de Oro is not an empty field — it
        is the NOT NULL column default being read as a fact, under a heading
        that does not apply to them at all. What IS true of them is one
        line: where they live.
      */}
      {isOutside ? (
        <Card title="Where they live">
          <Row label="Address" value={resident.address} />
          <p className="mt-4 rounded-xl bg-secondary/70 px-4 py-3 text-xs leading-relaxed text-gray-600">
            This person lives <strong>outside Barangay Natumolan</strong>. They hold no
            household, purok, residency status or sector, are not counted in the population,
            and no barangay certificate can be issued to them. If they have moved in, use{" "}
            <strong>Convert to resident</strong> below &mdash; every family link comes with
            them and they are given a resident number.
          </p>
        </Card>
      ) : (
        <Card title="Residency & household">
          <Row label="Zone / Purok" value={resident.zone_purok} />
          <Row label="Residency status" value={resident.residency_status} />
          <Row
            label="Length of residence"
            value={
              resident.length_of_residence_years != null
                ? `${resident.length_of_residence_years} year${resident.length_of_residence_years === 1 ? "" : "s"}`
                : null
            }
          />
          <Row label="Household" value={resident.household?.household_number} />
          <Row label="Address" value={resident.household?.street_address} />
        </Card>
      )}

      <Card
        title="Classification & Sectors"
        action={
          isBpo ? (
            <button
              type="button"
              onClick={() => setSectorOpen(true)}
              className="cursor-pointer text-sm font-medium text-primary hover:underline"
            >
              <FiPlus className="h-4 w-4" aria-hidden="true" /> Add sector
            </button>
          ) : undefined
        }
      >
        {(resident.sectors ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">Not in any sector list.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {resident.sectors?.map((sector) => (
              <span
                key={sector.id}
                /* The note says what the tag rests on — the disability the
                   census recorded, or that the ID number is still to come. */
                title={sector.note ?? undefined}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
              >
                {sector.sector_type}
                {sector.sector_type === "PWD" && sector.note?.includes(" (RBIM") && (
                  <span className="font-normal">· {sector.note.split(" (RBIM")[0]}</span>
                )}
                {/* Age brackets are auto-managed → no manual remove. */}
                {isBpo && !isAgeSector(sector.sector_type) && (
                  <button
                    type="button"
                    onClick={() => removeSector(sector.id, sector.sector_type)}
                    aria-label={`Remove ${sector.sector_type}`}
                    title={`Remove ${sector.sector_type}`}
                    className="cursor-pointer rounded-full text-primary/60 transition-colors hover:text-danger"
                  >
                    <FiX className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {isBpo && (
          <p className="mt-3 text-xs text-gray-400">
            The age bracket — one at a time: Children Under Five (0–4), Child (5–14), Youth
            (15–30), Adult (31–59), Senior Citizen (60+) — is set automatically from the birthdate.
          </p>
        )}
      </Card>
    </div>
  );
}
