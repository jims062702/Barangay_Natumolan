import { useEffect, useState, type FormEvent } from "react";
import Card from "../../../../shared/ui/Card";
import { useModalDraft } from "../../../../shared/lib/useModalDraft";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import ChoiceGroup from "../../../../shared/ui/ChoiceGroup";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { RequiredQuestion } from "../Band";
import { formatDay, manilaToday } from "../../lib/caseOptions";
import { vawcApi } from "../../api";
import type { VawcCase, VawcDialogue } from "../../types";
import { CardButton, DetailRows, saveToCase, SubmitButton, TextBlock } from "./parts";

const OUTCOMES = ["Agreement reached", "No agreement"] as const;

/** Said on the card and in the form, because it is the rule the card lives under. */
const SAFEGUARD =
  "Optional, and held once. A case may go straight to a BPO without any dialogue. The victim-survivor " +
  "is never required to attend one, or to settle, before protection is given (RA 9262 §33).";

/**
 * The one dialogue a case may have — and whether it ended in agreement.
 *
 * ONCE: a series of sittings is mediation, and a VAWC matter is not
 * mediated. The table holds one row per case; saving again corrects it.
 */
export function DialogueCard({ caseData, onEdit, active }: {
  caseData: VawcCase;
  onEdit: () => void;
  active: boolean;
}) {
  const d = caseData.agreement;

  return (
    <Card
      title="Dialogue"
      action={active && <CardButton onClick={onEdit}>{d ? "Correct" : "Record dialogue"}</CardButton>}
    >
      <p className="-mt-2 mb-4 text-xs leading-relaxed text-gray-500">{SAFEGUARD}</p>

      {!d ? (
        <p className="py-4 text-center text-sm text-gray-400">No dialogue held.</p>
      ) : (
        <div className="space-y-3">
          <DetailRows
            rows={[
              ["Date held", formatDay(d.session_date)],
              ["Outcome", d.outcome ? <StatusBadge key="o" status={d.outcome} /> : "Not recorded"],
              ["Who attended", d.attendees || "—"],
            ]}
          />
          <TextBlock label="What was discussed" text={d.discussion} />
          {d.outcome === "Agreement reached" && <TextBlock label="What was agreed" text={d.agreement} />}
        </div>
      )}
    </Card>
  );
}

const fromSaved = (d: VawcDialogue | null | undefined) => ({
  session_date: d?.session_date ?? manilaToday(),
  attendees: d?.attendees ?? "",
  discussion: d?.discussion ?? "",
  agreement: d?.agreement ?? "",
});

export function DialogueModal({ caseData, open, onClose, onSaved }: {
  caseData: VawcCase;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => fromSaved(null));
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number] | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(fromSaved(caseData.agreement));
    setOutcome(caseData.agreement?.outcome ?? null);
  }, [open, caseData.agreement]);

  /* Tab memory only — a VAWC record is never written to the device. Kept
     through a closed dialog; gone on refresh, Discard, or logout. */
  const savedDialogue = { form: fromSaved(caseData.agreement), outcome: caseData.agreement?.outcome ?? null };
  const draft = useModalDraft(
    `vawc-dialogue:${caseData.id}`,
    open,
    { form, outcome },
    (kept) => {
      setForm({ ...savedDialogue.form, ...kept.form });
      setOutcome(kept.outcome ?? null);
    },
    {
      memoryOnly: true,
      blank: savedDialogue,
      reset: () => {
        setForm(savedDialogue.form);
        setOutcome(savedDialogue.outcome);
      },
      version: caseData.agreement ? JSON.stringify(savedDialogue) : null,
    },
  );

  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveToCase(
      () => vawcApi.recordAgreement(caseData.id, {
        session_date: form.session_date,
        attendees: form.attendees.trim() || null,
        discussion: form.discussion,
        outcome,
        agreement: outcome === "Agreement reached" ? form.agreement.trim() || null : null,
      }),
      () => { draft.clear(); onClose(); onSaved(); },
      "Dialogue recorded.",
      caseData.agreement ? "Save the corrections?" : "Record the dialogue?",
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={caseData.agreement ? "Correct the dialogue record" : "Record the dialogue"} size="wide">
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-xl bg-secondary px-4 py-3 text-xs leading-relaxed text-gray-600">{SAFEGUARD}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Date held" required>
            <input
              type="date"
              value={form.session_date}
              max={manilaToday()}
              onChange={(e) => set("session_date", e.target.value)}
              required
              className={inputClasses}
            />
          </FormField>
          <FormField label="Who attended" hint="Stored encrypted">
            <input
              value={form.attendees}
              onChange={(e) => set("attendees", e.target.value)}
              maxLength={500}
              className={inputClasses}
              placeholder="Both parties, a support person, the VAW Desk officer…"
            />
          </FormField>
        </div>
        <FormField label="What was discussed" required hint="Stored encrypted.">
          <textarea
            value={form.discussion}
            onChange={(e) => set("discussion", e.target.value)}
            required
            rows={4}
            className={`${inputClasses} resize-y`}
          />
        </FormField>
        <div>
          <RequiredQuestion text="Did the parties reach an agreement?" />
          <ChoiceGroup
            value={outcome}
            onChange={setOutcome}
            options={OUTCOMES.map((o) => ({ value: o, label: o }))}
          />
        </div>
        {outcome === "Agreement reached" && (
          <FormField label="What was agreed" required hint="In the parties' own terms. Stored encrypted.">
            <textarea
              value={form.agreement}
              onChange={(e) => set("agreement", e.target.value)}
              required
              rows={3}
              className={`${inputClasses} resize-y`}
            />
          </FormField>
        )}
        <DraftNotice draft={draft} tabOnly />
        <SubmitButton disabled={!outcome || form.discussion.trim() === ""}>
          {caseData.agreement ? "Save corrections" : "Record dialogue"}
        </SubmitButton>
      </form>
    </Modal>
  );
}
