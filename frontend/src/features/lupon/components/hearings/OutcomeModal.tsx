import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { OUTCOME_STATUSES } from "../../lib/hearings";
import type { HearingCalendarState } from "../../hooks/useHearingCalendar";

/**
 * What happened at the hearing, as the minutes record it.
 */
export function OutcomeModal({ ctx }: { ctx: HearingCalendarState }) {
  const {
    outcomeFor, setOutcomeFor, saveOutcome, status, setStatus, complainantPresent,
    setComplainantPresent, respondentPresent, setRespondentPresent, proceedings,
    setProceedings, outcome, setOutcome, settleCase,
  } = ctx;

  return (
    <Modal
      open={outcomeFor !== null}
      onClose={() => setOutcomeFor(null)}
      title={`Hearing outcome — ${outcomeFor?.lupon_case?.case_number ?? ""}`}
    >
      <form onSubmit={saveOutcome} className="space-y-4">
        <FormField label="Result" required>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClasses}>
            {OUTCOME_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </FormField>
        <div className="grid gap-2 rounded-xl bg-secondary px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Attendance</p>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-dark">
            <input
              type="checkbox"
              checked={complainantPresent}
              onChange={(e) => setComplainantPresent(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            Complainant present
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-dark">
            <input
              type="checkbox"
              checked={respondentPresent}
              onChange={(e) => setRespondentPresent(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            Respondent present
          </label>
        </div>
        {/*
          The minutes of the sitting: what was said, what was offered, what
          was agreed. Every session has them — an agreement recorded with no
          account of how it was reached is the one a party later disputes.
        */}
        <FormField
          label="Minutes of this sitting"
          hint="What was discussed, offered and agreed. Required before the case can be closed."
        >
          <textarea
            value={proceedings}
            onChange={(e) => setProceedings(e.target.value)}
            rows={5}
            className={`${inputClasses} resize-none`}
            placeholder="Both parties appeared. The complainant asked for…"
          />
        </FormField>
        <FormField label="Outcome">
          <input
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className={inputClasses}
            placeholder="e.g. Settlement reached, No settlement"
          />
        </FormField>
        <button
          type="submit"
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Record outcome
        </button>

        {/*
          Its own button, not a word typed into "Outcome".
          "Settlement reached" written in that box closed nothing: the case
          stayed open and three more Tuesdays sat on the calendar that
          nobody would attend. This one ends the case and clears them.
        */}
        <div className="rounded-xl border border-success/40 bg-success/5 px-3.5 py-3">
          <p className="text-sm font-semibold text-dark">The parties agreed</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-600">
            Closes the case to the Lupon and stands down every sitting still on the calendar.
          </p>
          <button
            type="button"
            onClick={() => void settleCase()}
            className="mt-2.5 w-full cursor-pointer rounded-full bg-success py-2 text-sm font-semibold text-white transition-colors hover:brightness-95"
          >
            Settle &amp; close case
          </button>
        </div>
      </form>
    </Modal>
  );
}
