import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import type { HearingCalendarState } from "../../hooks/useHearingCalendar";

/**
 * The complainant takes the complaint back.
 *
 * This ends the CASE, not the sitting, and the reason is required: the
 * monthly transmittal counts it under "Cancel", and a year later the only
 * answer to "why did this one stop?" is the sentence typed here.
 */
export function WithdrawModal({ ctx }: { ctx: HearingCalendarState }) {
  const { withdrawFor, setWithdrawFor, saveWithdraw, withdrawReason, setWithdrawReason, withdrawDraft } = ctx;

  return (
    <Modal
      open={withdrawFor !== null}
      onClose={() => setWithdrawFor(null)}
      title={`Withdraw the complaint — ${withdrawFor?.lupon_case?.case_number ?? ""}`}
    >
      <form onSubmit={saveWithdraw} className="space-y-4">
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-xs leading-relaxed text-gray-600">
          <span className="font-semibold text-dark">
            {withdrawFor?.lupon_case?.case_title ?? "This case"}
          </span>{" "}
          closes at the Lupon and every sitting still on the calendar is stood down.
          Both parties are told. This cannot be undone from here.
        </div>

        <FormField
          label="Why is it being withdrawn?"
          required
          hint="In the complainant's own words where you have them."
        >
          <textarea
            value={withdrawReason}
            onChange={(e) => setWithdrawReason(e.target.value)}
            required
            rows={4}
            className={`${inputClasses} resize-none`}
            placeholder="e.g. The parties settled between themselves and the complainant asked to withdraw."
          />
        </FormField>

        <DraftNotice draft={withdrawDraft} />

        <button
          type="submit"
          className="w-full cursor-pointer rounded-full bg-danger py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-95"
        >
          Withdraw the complaint
        </button>
      </form>
    </Modal>
  );
}
