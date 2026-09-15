import Modal from "../../../../shared/ui/Modal";
import { formatWallClock } from "../../../../shared/lib/datetime";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { today } from "../../lib/hearings";
import type { HearingCalendarState } from "../../hooks/useHearingCalendar";

/**
 * Proof that the summons was served.
 */
export function SummonsModal({ ctx }: { ctx: HearingCalendarState }) {
  const {
    summonsFor, setSummonsFor, saveSummons, issued, setIssued, servedDate, setServedDate,
  } = ctx;

  return (
    <Modal
      open={summonsFor !== null}
      onClose={() => setSummonsFor(null)}
      title={`Summons — ${summonsFor?.lupon_case?.case_number ?? ""}`}
    >
      <form onSubmit={saveSummons} className="space-y-4">
        <div className="rounded-xl bg-secondary px-4 py-3 text-xs text-gray-500">
          {summonsFor?.hearing_type} hearing on {formatWallClock(summonsFor?.scheduled_at)}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-dark">
          <input
            type="checkbox"
            checked={issued}
            onChange={(e) => setIssued(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-primary"
          />
          Summons issued to both parties
        </label>
        <FormField
          label="Proof of service date"
          hint="The date the summons was actually served. Required before a party may be defaulted."
        >
          <input
            type="date"
            value={servedDate}
            max={today()}
            disabled={!issued}
            onChange={(e) => setServedDate(e.target.value)}
            className={inputClasses}
          />
        </FormField>
        <button
          type="submit"
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Save summons record
        </button>
      </form>
    </Modal>
  );
}
