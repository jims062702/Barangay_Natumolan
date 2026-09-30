import type { FormEvent } from "react";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { localNow } from "../../lib/caseStages";
import { luponApi } from "../../api";
import type { LuponCaseState } from "../../hooks/useLuponCase";

/**
 * Recording a conciliation hearing before the Pangkat.
 */
export function ConciliationModal({ ctx }: { ctx: LuponCaseState }) {
  const {
    conciliationOpen, setConciliationOpen, post, id, conciliationDate, pangkat,
    conciliationOutcome, setConciliationDate, setPangkat, setConciliationOutcome, conciliationDraft, finishConciliation,
  } = ctx;

  return (
    <Modal open={conciliationOpen} onClose={() => setConciliationOpen(false)} title="Record Pangkat conciliation">
      <form
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          post(
            () => luponApi.recordConciliation(id, {
              conciliation_date: conciliationDate.replace("T", " ") + ":00",
              pangkat_members: pangkat.map((m) => m.trim()),
              outcome: conciliationOutcome,
            }),
            finishConciliation
          );
        }}
        className="space-y-4"
      >
        <FormField label="Date" required>
          <input
            type="datetime-local"
            value={conciliationDate}
            max={localNow()}
            onChange={(e) => setConciliationDate(e.target.value)}
            required
            className={inputClasses}
          />
        </FormField>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-dark">
            Pangkat ng Tagapagkasundo<span className="text-danger"> *</span>
          </span>
          <div className="space-y-2">
            {pangkat.map((member, index) => (
              <input
                key={index}
                value={member}
                onChange={(e) =>
                  setPangkat((prev) => prev.map((m, i) => (i === index ? e.target.value : m)))
                }
                required
                className={inputClasses}
                placeholder={`Lupon member ${index + 1}${index === 0 ? " (chairman)" : ""}`}
              />
            ))}
          </div>
          <span className="mt-1 block text-xs text-gray-400">
            Exactly three Lupon members, chosen by the parties from the Lupon
            list — or drawn by lot if they cannot agree. The panel elects its
            own chairman and secretary.
          </span>
        </div>
        <FormField label="Outcome" required>
          <select value={conciliationOutcome} onChange={(e) => setConciliationOutcome(e.target.value)} className={inputClasses}>
            {/* Two outcomes. A matter this Lupon cannot settle is dismissed —
                there is no arbitration here to send it to. */}
            {["Settlement", "Dismissed"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </FormField>
        <DraftNotice draft={conciliationDraft} />
        <button type="submit" className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
          Save conciliation
        </button>
      </form>
    </Modal>
  );
}
