import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import type { Resident } from "../../../../shared/types";
import { MANUAL_SECTORS } from "../../lib/sectors";
import type { ResidentRecordState } from "../../hooks/useResidentRecord";

/**
 * Tagging a resident with a sector — and the card behind it, where there is one.
 */
export function AddSectorModal({ ctx, resident }: {
  ctx: ResidentRecordState;
  resident: Resident;
}) {
  const {
    sectorOpen, setSectorOpen, addSector, sectorType, setSectorType, sectorRef, setSectorRef,
    sectorIssued, setSectorIssued, sectorValidUntil, setSectorValidUntil, sectorDraft,
  } = ctx;

  return (
    <Modal open={sectorOpen} onClose={() => setSectorOpen(false)} title="Tag sector membership">
      <form onSubmit={addSector} className="space-y-4">
        <FormField label="Sector" required hint="Age brackets (Child, Youth, Adult, Senior) are set automatically from birthdate.">
          <select value={sectorType} onChange={(e) => setSectorType(e.target.value)} className={inputClasses}>
            {MANUAL_SECTORS.map((sector) => (
              <option key={sector}>{sector}</option>
            ))}
          </select>
        </FormField>

        {/*
          Solo Parent is a status granted on registration and carrying
          benefits, so the tag follows the ID rather than the other way
          round — and somebody with a partner on the record is not raising
          children alone, which the server refuses outright.
        */}
        {sectorType === "Solo Parent" && (
          <>
            <p className="rounded-xl bg-secondary/70 px-4 py-3 text-xs leading-relaxed text-gray-600">
              Solo Parent is a registration under <strong>RA 8972</strong>, not a judgement made
              at this desk. Record the number from their Solo Parent ID.
              {resident.spouse && (
                <>
                  {" "}
                  <span className="font-semibold text-warning">
                    {resident.first_name} is recorded as partnered with{" "}
                    {resident.spouse.first_name} {resident.spouse.last_name} — end that union on
                    their record first, with the reason, or this will be refused.
                  </span>
                </>
              )}
            </p>

            <FormField label="Solo Parent ID / reference no." required>
              <input
                value={sectorRef}
                onChange={(e) => setSectorRef(e.target.value)}
                required
                className={inputClasses}
                placeholder="e.g. SP-2026-00113"
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Issued on">
                <input
                  type="date"
                  value={sectorIssued}
                  onChange={(e) => setSectorIssued(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Valid until" hint="A Solo Parent ID runs for a year and is renewed.">
                <input
                  type="date"
                  value={sectorValidUntil}
                  onChange={(e) => setSectorValidUntil(e.target.value)}
                  className={inputClasses}
                />
              </FormField>
            </div>
          </>
        )}
        <DraftNotice draft={sectorDraft} />
        <button
          type="submit"
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Add to master list
        </button>
      </form>
    </Modal>
  );
}
