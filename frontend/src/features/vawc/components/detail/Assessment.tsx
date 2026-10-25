import { useEffect, useState, type FormEvent } from "react";
import Card from "../../../../shared/ui/Card";
import { useModalDraft } from "../../../../shared/lib/useModalDraft";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import {
  ASSESSMENT_CHECKS, formatDay, manilaToday, PERSONS_PRESENT, SERVICES_PROVIDED,
} from "../../lib/caseOptions";
import { vawcApi } from "../../api";
import type { VawcAssessment, VawcCase } from "../../types";
import { CardButton, CheckList, Chips, DetailRows, saveToCase, SubmitButton, TextBlock, Tick } from "./parts";

type CheckKey = (typeof ASSESSMENT_CHECKS)[number]["key"];

/**
 * Case Assessment & Action Plan — what replaced "Session & agreement".
 *
 * The desk's record of her concerns, what it found, what it did and what
 * happens next. Not what the parties agreed: a VAWC case is not turned into
 * a settlement between them.
 */
export function AssessmentCard({ caseData, onEdit, active, className = "" }: {
  caseData: VawcCase;
  onEdit: () => void;
  active: boolean;
  className?: string;
}) {
  const a = caseData.assessment;

  return (
    <Card
      title="Case Assessment & Action Plan"
      className={className}
      action={active && <CardButton onClick={onEdit}>{a ? "Update" : "Record assessment"}</CardButton>}
    >
      <p className="-mt-2 mb-4 text-xs leading-relaxed text-gray-500">
        Document the victim-survivor's concerns, assessment findings, services provided, and next steps.
      </p>

      {!a ? (
        <p className="py-4 text-center text-sm text-gray-400">No assessment recorded yet.</p>
      ) : (
        <div className="space-y-4">
          <DetailRows
            rows={[
              ["Assessment date", formatDay(a.assessment_date)],
              ["Persons present", <Chips key="p" items={a.persons_present} />],
              ["Services / assistance provided", <Chips key="s" items={a.services_provided} />],
            ]}
          />
          <div className="grid gap-3 md:grid-cols-3">
            <TextBlock label="Victim-Survivor's statement" text={a.statement} />
            <TextBlock label="Assessment / observations" text={a.observations} />
            <TextBlock label="Action plan / next steps" text={a.action_plan} />
          </div>
          <ul className="space-y-1.5">
            {ASSESSMENT_CHECKS.map((c) => <Tick key={c.key} done={a[c.key]} label={c.label} />)}
          </ul>
          <p className="text-xs text-gray-400">Recorded by {a.recorder?.name ?? "the desk"}.</p>
        </div>
      )}
    </Card>
  );
}

const blank = () => ({
  assessment_date: manilaToday(),
  /* The two who are always there at the desk. */
  persons_present: ["Victim-Survivor", "VAW Desk Officer"],
  statement: "",
  observations: "",
  services_provided: [] as string[],
  action_plan: "",
  informed_of_rights: false,
  protection_order_offered: false,
  referral_made: false,
  next_steps_documented: false,
});

const fromSaved = (a: VawcAssessment) => ({
  assessment_date: a.assessment_date,
  persons_present: a.persons_present ?? [],
  statement: a.statement ?? "",
  observations: a.observations ?? "",
  services_provided: a.services_provided ?? [],
  action_plan: a.action_plan ?? "",
  informed_of_rights: a.informed_of_rights,
  protection_order_offered: a.protection_order_offered,
  referral_made: a.referral_made,
  next_steps_documented: a.next_steps_documented,
});

/** One per case; saving again corrects it. */
export function AssessmentModal({ caseData, open, onClose, onSaved }: {
  caseData: VawcCase;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!open) return;
    setForm(caseData.assessment ? fromSaved(caseData.assessment) : blank());
  }, [open, caseData.assessment]);

  /* Tab memory only — a VAWC record is never written to the device. Kept
     through a closed dialog; gone on refresh, Discard, or logout. */
  const savedAssessment = caseData.assessment ? fromSaved(caseData.assessment) : blank();
  const draft = useModalDraft(
    `vawc-assessment:${caseData.id}`,
    open,
    form,
    (kept) => setForm({ ...savedAssessment, ...kept }),
    {
      memoryOnly: true,
      blank: savedAssessment,
      reset: () => setForm(savedAssessment),
      version: caseData.assessment ? JSON.stringify(savedAssessment) : null,
    },
  );

  const set = <K extends keyof ReturnType<typeof blank>>(key: K, value: ReturnType<typeof blank>[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveToCase(
      () => vawcApi.saveAssessment(caseData.id, {
        ...form,
        statement: form.statement.trim() || null,
        observations: form.observations.trim() || null,
        action_plan: form.action_plan.trim() || null,
      }),
      () => { draft.clear(); onClose(); onSaved(); },
      "Case assessment saved.",
      caseData.assessment ? "Save the corrections?" : "Record this assessment?",
    );
  };

  const text = (key: "statement" | "observations" | "action_plan", label: string, hint: string) => (
    <FormField label={label} hint={`${hint} Stored encrypted.`}>
      <textarea
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        rows={3}
        maxLength={10000}
        className={`${inputClasses} resize-y`}
      />
    </FormField>
  );

  return (
    <Modal open={open} onClose={onClose} title="Case Assessment & Action Plan" size="wide">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs leading-relaxed text-gray-500">
          Document the victim-survivor's concerns, assessment findings, services provided, and next steps.
        </p>
        <div className="max-w-xs">
          <FormField label="Assessment date" required>
            <input
              type="date"
              value={form.assessment_date}
              max={manilaToday()}
              onChange={(e) => set("assessment_date", e.target.value)}
              required
              className={inputClasses}
            />
          </FormField>
        </div>

        <CheckList
          label="Persons present"
          options={PERSONS_PRESENT}
          value={form.persons_present}
          onChange={(v) => set("persons_present", v)}
          columns={3}
        />

        {text("statement", "Victim-Survivor's statement", "What the victim reported and what assistance was requested.")}
        {text("observations", "Assessment / observations", "Relevant assessment findings and immediate concerns.")}

        <CheckList
          label="Services / assistance provided"
          options={SERVICES_PROVIDED}
          value={form.services_provided}
          onChange={(v) => set("services_provided", v)}
          columns={3}
        />

        {text("action_plan", "Action plan / next steps", "What needs to happen next.")}

        <fieldset className="space-y-2 rounded-xl bg-secondary px-4 py-3">
          <legend className="sr-only">What the victim-survivor was told and offered</legend>
          {ASSESSMENT_CHECKS.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-start gap-2 text-sm text-dark">
              <input
                type="checkbox"
                checked={form[c.key as CheckKey]}
                onChange={(e) => set(c.key as CheckKey, e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
              />
              {c.label}
            </label>
          ))}
        </fieldset>

        <DraftNotice draft={draft} tabOnly />
        <SubmitButton>{caseData.assessment ? "Save corrections" : "Record assessment"}</SubmitButton>
      </form>
    </Modal>
  );
}
