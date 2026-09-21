import type { FormEvent } from "react";
import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { luponApi } from "../../api";
import type { LuponCaseState } from "../../hooks/useLuponCase";

/**
 * Scheduling the next hearing and its summons.
 */
export function HearingModal({ ctx }: { ctx: LuponCaseState }) {
  const {
    hearingOpen, setHearingOpen, post, id, hearingType, hearingAt, summons, setHearingType,
    setHearingAt, setSummons,
  } = ctx;

  return (
    <Modal open={hearingOpen} onClose={() => setHearingOpen(false)} title="Schedule hearing">
      <form
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          post(
            () => luponApi.scheduleHearing(id, { hearing_type: hearingType, scheduled_at: hearingAt.replace("T", " ") + ":00", summons_issued: summons }),
            () => setHearingOpen(false),
            "Hearing scheduled; parties notified."
          );
        }}
        className="space-y-4"
      >
        <FormField label="Type" required>
          <select value={hearingType} onChange={(e) => setHearingType(e.target.value)} className={inputClasses}>
            <option>Mediation</option>
            <option>Conciliation</option>
          </select>
        </FormField>
        <FormField label="Date & time" required>
          <input type="datetime-local" value={hearingAt} onChange={(e) => setHearingAt(e.target.value)} required className={inputClasses} />
        </FormField>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={summons} onChange={(e) => setSummons(e.target.checked)} className="h-4 w-4 accent-primary" />
          Summons issued to parties
        </label>
        <button type="submit" className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
          Schedule
        </button>
      </form>
    </Modal>
  );
}
