import Modal from "../../../../shared/ui/Modal";
import { formatWallClock } from "../../../../shared/lib/datetime";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import type { HearingCalendarState } from "../../hooks/useHearingCalendar";

/**
 * Moving a hearing to another date.
 */
export function RescheduleModal({ ctx }: { ctx: HearingCalendarState }) {
  const { resetFor, setResetFor, saveReset, newDateTime, setNewDateTime, reason, setReason } = ctx;

  return (
    <Modal
      open={resetFor !== null}
      onClose={() => setResetFor(null)}
      title={`Reschedule — ${resetFor?.lupon_case?.case_number ?? ""}`}
    >
      <form onSubmit={saveReset} className="space-y-4">
        <div className="rounded-xl bg-secondary px-4 py-3 text-xs text-gray-500">
          Currently set for {formatWallClock(resetFor?.scheduled_at)}. The original
          entry stays on the record marked <em>Rescheduled</em>.
        </div>
        <FormField label="New schedule" required>
          <input
            type="datetime-local"
            value={newDateTime}
            onChange={(e) => setNewDateTime(e.target.value)}
            required
            className={inputClasses}
          />
        </FormField>
        <FormField label="Reason">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputClasses}
            placeholder="e.g. Respondent requested a new date"
          />
        </FormField>
        <button
          type="submit"
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Reschedule &amp; notify parties
        </button>
      </form>
    </Modal>
  );
}
