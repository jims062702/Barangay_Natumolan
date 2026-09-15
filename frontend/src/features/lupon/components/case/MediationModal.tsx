import type { FormEvent } from "react";
import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { localNow } from "../../lib/caseStages";
import { luponApi } from "../../api";
import type { LuponCaseState } from "../../hooks/useLuponCase";

/**
 * Recording a mediation hearing before the Punong Barangay.
 */
export function MediationModal({ ctx }: { ctx: LuponCaseState }) {
  const {
    mediationOpen, setMediationOpen, post, id, mediationDate, attendance, mediationOutcome,
    mediationNotes, setMediationDate, setAttendance, setMediationOutcome, setMediationNotes,
  } = ctx;

  return (
    <Modal open={mediationOpen} onClose={() => setMediationOpen(false)} title="Record mediation (Punong Barangay)">
      <form
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          post(
            () => luponApi.recordMediation(id, {
              mediation_date: mediationDate.replace("T", " ") + ":00",
              attendance,
              outcome: mediationOutcome,
              proceedings_notes: mediationNotes || undefined,
            }),
            () => setMediationOpen(false)
          );
        }}
        className="space-y-4"
      >
        <FormField label="Date" required>
          <input
            type="datetime-local"
            value={mediationDate}
            max={localNow()}
            onChange={(e) => setMediationDate(e.target.value)}
            required
            className={inputClasses}
          />
        </FormField>
        <FormField label="Attendance" required>
          <select value={attendance} onChange={(e) => setAttendance(e.target.value)} className={inputClasses}>
            {["Both Present", "Complainant Only", "Respondent Only", "Neither"].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Outcome" required>
          <select value={mediationOutcome} onChange={(e) => setMediationOutcome(e.target.value)} className={inputClasses}>
            {["Settlement Reached", "No Settlement", "Rescheduled"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Proceedings notes">
          <textarea value={mediationNotes} onChange={(e) => setMediationNotes(e.target.value)} rows={2} className={`${inputClasses} resize-none`} />
        </FormField>
        <button type="submit" className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
          Save mediation
        </button>
      </form>
    </Modal>
  );
}
