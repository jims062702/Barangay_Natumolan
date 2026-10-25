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
import { CardButton, CheckList, DetailRows, saveToCase, SubmitButton, TextBlock } from "./parts";

const personName = (p?: { first_name?: string; middle_name?: string | null; last_name?: string; suffix?: string | null } | null) =>
  p ? [p.first_name, p.middle_name, p.last_name, p.suffix].filter(Boolean).join(" ") : "";

const OUTCOMES = ["Agreement reached", "Not settled"] as const;

/** Said on the card and in the form, because it is the rule the card lives under. */
const SAFEGUARD =
  "Optional, and held at most once. Dialogue is only an option if the victim-survivor wishes to talk with the respondent/offender. " +
  "Not all cases undergo dialogue, and it is never a requirement before receiving protection (RA 9262 §33). " +
  "Ang pag-dialogue ay opsyon lamang para sa may gustong makipag-usap sa respondent.";

/**
 * The one dialogue a case may have — and whether it ended in agreement.
 *
 * ONCE: a series of sittings is mediation, and a VAWC matter is not
 * mediated. The table holds one row per case; saving again corrects it.
 */
export function DialogueCard({ caseData, onEdit, onCloseCase, active }: {
  caseData: VawcCase;
  onEdit: () => void;
  onCloseCase?: () => void;
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
        <div className="py-4 text-center">
          <p className="text-sm text-gray-400">No dialogue held.</p>
          <p className="mt-1 text-xs text-gray-400">
            Dialogue is strictly optional — held only if the victim-survivor wishes to speak with the respondent.
          </p>
        </div>
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

          {active && onCloseCase && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-600">
              <span>Dialogue concluded ({d.outcome}). Case can now be closed.</span>
              <button
                type="button"
                onClick={onCloseCase}
                className="font-semibold text-danger hover:underline ml-2"
              >
                Close case
              </button>
            </div>
          )}

          {!active && (
            <div className="mt-3 text-xs text-gray-500 font-medium">
              Case is closed following dialogue ({d.outcome}).
            </div>
          )}
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
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [closeCase, setCloseCase] = useState<boolean>(() => caseData.status === "Active");

  const participantOptions = [
    caseData.survivor ? `${personName(caseData.survivor)} (Victim-Survivor)` : "Victim-Survivor",
    caseData.respondent ? `${personName(caseData.respondent)} (Respondent)` : "Respondent",
    caseData.officer ? `${caseData.officer.name} (VAW Desk Officer)` : "VAW Desk Officer",
    "Hon. Punong Barangay",
    "Barangay Secretary",
    "Barangay Kagawad (Women & Family)",
    "BPSO Officer",
    "Social Worker / MSWDO",
  ];

  useEffect(() => {
    if (!open) return;
    setForm(fromSaved(caseData.agreement));
    const initialOutcome = caseData.agreement?.outcome === "No agreement"
      ? "Not settled"
      : (caseData.agreement?.outcome as (typeof OUTCOMES)[number] | null ?? null);
    setOutcome(initialOutcome);
    setCloseCase(caseData.status === "Active");
    if (caseData.agreement?.attendees) {
      setSelectedAttendees(caseData.agreement.attendees.split(",").map((s) => s.trim()).filter(Boolean));
    } else {
      /* Default to the primary parties and officer */
      setSelectedAttendees([
        caseData.survivor ? `${personName(caseData.survivor)} (Victim-Survivor)` : "Victim-Survivor",
        caseData.respondent ? `${personName(caseData.respondent)} (Respondent)` : "Respondent",
        caseData.officer ? `${caseData.officer.name} (VAW Desk Officer)` : "VAW Desk Officer",
      ]);
    }
  }, [open, caseData.agreement, caseData.survivor, caseData.respondent, caseData.officer, caseData.status]);

  /* Tab memory only — a VAWC record is never written to the device. Kept
     through a closed dialog; gone on refresh, Discard, or logout. */
  const savedDialogue = {
    form: fromSaved(caseData.agreement),
    outcome: caseData.agreement?.outcome === "No agreement" ? "Not settled" : (caseData.agreement?.outcome ?? null),
    selectedAttendees,
    closeCase: caseData.status === "Active",
  };
  const draft = useModalDraft(
    `vawc-dialogue:${caseData.id}`,
    open,
    { form, outcome, selectedAttendees, closeCase },
    (kept) => {
      setForm({ ...savedDialogue.form, ...kept.form });
      setOutcome(kept.outcome ?? null);
      if (kept.selectedAttendees) setSelectedAttendees(kept.selectedAttendees);
      if (typeof kept.closeCase === "boolean") setCloseCase(kept.closeCase);
    },
    {
      memoryOnly: true,
      blank: savedDialogue,
      reset: () => {
        setForm(savedDialogue.form);
        setOutcome(savedDialogue.outcome as (typeof OUTCOMES)[number] | null);
        setSelectedAttendees([]);
        setCloseCase(caseData.status === "Active");
      },
      version: caseData.agreement ? JSON.stringify(savedDialogue) : null,
    },
  );

  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const promptText = closeCase && caseData.status === "Active"
      ? (caseData.agreement ? "Save corrections and close case?" : "Record dialogue and close case?")
      : (caseData.agreement ? "Save the corrections?" : "Record the dialogue?");

    await saveToCase(
      () => vawcApi.recordAgreement(caseData.id, {
        session_date: form.session_date,
        attendees: selectedAttendees.join(", ") || null,
        discussion: form.discussion,
        outcome,
        agreement: outcome === "Agreement reached" ? form.agreement.trim() || null : null,
        close_case: closeCase,
      }),
      () => { draft.clear(); onClose(); onSaved(); },
      closeCase && caseData.status === "Active" ? "Dialogue recorded and case closed." : "Dialogue recorded.",
      promptText,
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
        </div>

        <CheckList
          label="Who attended (Case participants & officials)"
          options={participantOptions}
          value={selectedAttendees}
          onChange={setSelectedAttendees}
          columns={2}
        />
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
          <RequiredQuestion text="Did the parties reach an agreement or not settled?" />
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

        {caseData.status === "Active" && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={closeCase}
                onChange={(e) => setCloseCase(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div className="text-xs">
                <span className="font-semibold text-gray-900">Close this case upon saving dialogue</span>
                <p className="text-gray-500 mt-0.5">
                  Marks this case as Closed now that dialogue has been completed ({outcome ?? "Agreement reached / Not settled"}).
                </p>
              </div>
            </label>
          </div>
        )}

        <DraftNotice draft={draft} tabOnly />
        <SubmitButton disabled={!outcome || form.discussion.trim() === ""}>
          {caseData.agreement ? "Save corrections" : "Record dialogue"}
        </SubmitButton>
      </form>
    </Modal>
  );
}
