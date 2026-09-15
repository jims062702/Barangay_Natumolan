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
    setProceedings, outcome, setOutcome,
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
        <FormField label="Proceedings notes">
          <textarea
            value={proceedings}
            onChange={(e) => setProceedings(e.target.value)}
            rows={3}
            className={`${inputClasses} resize-none`}
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
      </form>
    </Modal>
  );
}
