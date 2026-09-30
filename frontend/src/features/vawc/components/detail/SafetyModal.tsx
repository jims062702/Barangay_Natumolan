import { useEffect, useState, type FormEvent } from "react";
import { useModalDraft } from "../../../../shared/lib/useModalDraft";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import ChoiceGroup from "../../../../shared/ui/ChoiceGroup";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { RequiredQuestion } from "../Band";
import { DANGER_ANSWERS, PROTECTION_ANSWERS, RISK_LEVELS } from "../../lib/caseOptions";
import { vawcApi } from "../../api";
import type { VawcCase } from "../../types";
import { saveToCase, SubmitButton } from "./parts";

type Danger = (typeof DANGER_ANSWERS)[number];
type Protection = (typeof PROTECTION_ANSWERS)[number];

/**
 * "Update Safety Assessment" — the two intake questions asked again, and
 * the risk level the docket sorts by.
 *
 * In danger right now is Critical, so the level locks there while "Yes" is
 * chosen; the server applies the same rule whatever is sent.
 */
export function SafetyModal({ caseData, open, onClose, onSaved, onNeedsBpo }: {
  caseData: VawcCase;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Protection needed and nothing recorded yet: offer the BPO next. */
  onNeedsBpo: () => void;
}) {
  const [danger, setDanger] = useState<Danger | null>(null);
  const [protection, setProtection] = useState<Protection | null>(null);
  const [risk, setRisk] = useState("");

  useEffect(() => {
    if (!open) return;
    setDanger(caseData.currently_in_danger ?? null);
    setProtection(caseData.protection_needed ?? null);
    setRisk(caseData.risk_level ?? "");
  }, [open, caseData]);

  /* Tab memory only — a VAWC record is never written to the device. Kept
     through a closed dialog; gone on refresh, Discard, or logout. */
  const savedSafety = {
    danger: caseData.currently_in_danger ?? null,
    protection: caseData.protection_needed ?? null,
    risk: caseData.risk_level ?? "",
  };
  const draft = useModalDraft(
    `vawc-safety:${caseData.id}`,
    open,
    { danger, protection, risk },
    (kept) => {
      setDanger(kept.danger ?? null);
      setProtection(kept.protection ?? null);
      setRisk(kept.risk ?? "");
    },
    {
      memoryOnly: true,
      blank: savedSafety,
      reset: () => {
        setDanger(savedSafety.danger);
        setProtection(savedSafety.protection);
        setRisk(savedSafety.risk);
      },
      version: JSON.stringify(savedSafety),
    },
  );

  const level = danger === "Yes" ? "Critical" : risk;
  const hasOrder = (caseData.protection_orders ?? []).length > 0;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveToCase(
      () => vawcApi.updateCase(caseData.id, {
        currently_in_danger: danger,
        protection_needed: protection,
        risk_level: level || null,
      }),
      () => {
        draft.clear();
        onClose();
        onSaved();
        if (protection === "Yes" && !hasOrder) onNeedsBpo();
      },
      "Safety assessment updated.",
      "Update the safety assessment?",
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Update Safety Assessment">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <RequiredQuestion text="Is the victim-survivor currently in danger?" />
          <ChoiceGroup
            value={danger}
            onChange={setDanger}
            options={DANGER_ANSWERS.map((a) => ({ value: a, label: a }))}
          />
        </div>
        <div>
          <RequiredQuestion text="Immediate protection needed?" />
          <ChoiceGroup
            value={protection}
            onChange={setProtection}
            options={PROTECTION_ANSWERS.map((a) => ({ value: a, label: a }))}
          />
        </div>
        <FormField
          label="Risk level"
          hint={danger === "Yes" ? "Critical while the victim-survivor is in danger." : "Sorts the docket: most urgent first."}
        >
          <select
            value={level}
            onChange={(e) => setRisk(e.target.value)}
            disabled={danger === "Yes"}
            className={inputClasses}
          >
            <option value="">Not assessed</option>
            {RISK_LEVELS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </FormField>
        {protection === "Yes" && !hasOrder && (
          <p className="rounded-xl bg-primary/5 px-4 py-3 text-xs text-dark">
            After saving, the BPO application opens so it can be recorded straight away.
          </p>
        )}
        <DraftNotice draft={draft} tabOnly />
        <SubmitButton disabled={!danger || !protection}>Save safety assessment</SubmitButton>
      </form>
    </Modal>
  );
}
