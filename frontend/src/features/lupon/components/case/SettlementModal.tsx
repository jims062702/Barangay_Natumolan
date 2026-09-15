import type { FormEvent } from "react";
import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { luponApi } from "../../api";
import type { LuponCaseState } from "../../hooks/useLuponCase";

/**
 * Recording the settlement the parties reached.
 */
export function SettlementModal({ ctx }: { ctx: LuponCaseState }) {
  const {
    settlementOpen, setSettlementOpen, post, id, settlementType, terms, dateAgreed,
    complianceDeadline, setSettlementType, setTerms, setDateAgreed, setComplianceDeadline,
  } = ctx;

  return (
    <Modal open={settlementOpen} onClose={() => setSettlementOpen(false)} title="Record settlement">
      <form
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          post(
            () => luponApi.registerSettlement(id, {
              settlement_type: settlementType,
              terms,
              date_agreed: dateAgreed,
              compliance_deadline: complianceDeadline || undefined,
            }),
            () => setSettlementOpen(false),
            "Settlement recorded — the 10-day repudiation countdown has started."
          );
        }}
        className="space-y-4"
      >
        <FormField label="Type" required>
          <select value={settlementType} onChange={(e) => setSettlementType(e.target.value)} className={inputClasses}>
            <option>Amicable Settlement</option>
            <option>Arbitration Award</option>
          </select>
        </FormField>
        <FormField label="Terms & obligations" required>
          <textarea value={terms} onChange={(e) => setTerms(e.target.value)} required rows={3} className={`${inputClasses} resize-none`} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Date agreed" required>
            <input type="date" value={dateAgreed} onChange={(e) => setDateAgreed(e.target.value)} required className={inputClasses} />
          </FormField>
          <FormField label="Compliance deadline">
            <input type="date" value={complianceDeadline} onChange={(e) => setComplianceDeadline(e.target.value)} className={inputClasses} />
          </FormField>
        </div>
        <button type="submit" className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
          Record settlement
        </button>
      </form>
    </Modal>
  );
}
