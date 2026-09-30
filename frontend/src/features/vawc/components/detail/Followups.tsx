import { useEffect, useState, type FormEvent } from "react";
import Card from "../../../../shared/ui/Card";
import { useModalDraft } from "../../../../shared/lib/useModalDraft";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import ChoiceGroup from "../../../../shared/ui/ChoiceGroup";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { useAuth } from "../../../../shared/auth/AuthContext";
import { RequiredQuestion } from "../Band";
import {
  FOLLOWUP_METHODS, formatDay, manilaToday, PROTECTION_ORDER_STATUSES, SAFETY_STATUSES,
} from "../../lib/caseOptions";
import { vawcApi } from "../../api";
import type { VawcCase, VawcProtectionOrder } from "../../types";
import { CardButton, saveToCase, SubmitButton } from "./parts";

/** Where the BPO stands today, as the follow-up form's first guess. */
function protectionStatusFrom(orders: VawcProtectionOrder[]): string {
  if (orders.some((o) => o.in_effect)) return "BPO in effect";
  const latest = orders[0];
  if (!latest) return "No BPO";
  if (latest.status === "Issued") return "BPO expired";
  if (latest.status === "Referred for TPO/PPO") return "Referred for TPO/PPO";
  if (["Applied", "Application Prepared"].includes(latest.status)) return "BPO applied";

  return "No BPO";
}

/** Follow-ups & monitoring. */
export function FollowupsCard({ caseData, onRecord, active, className = "" }: {
  caseData: VawcCase;
  onRecord: () => void;
  active: boolean;
  className?: string;
}) {
  /* The latest first: it is what the victim-survivor's situation is now. */
  const followups = [...(caseData.followups ?? [])].sort(
    (a, b) => b.followup_date.localeCompare(a.followup_date) || b.id - a.id,
  );

  return (
    <Card
      title="Follow-ups & monitoring"
      className={className}
      action={active && <CardButton onClick={onRecord}>Record follow-up</CardButton>}
    >
      {followups.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">No follow-ups yet.</p>
      ) : (
        <ul className="space-y-3">
          {followups.map((f) => (
            <li key={f.id} className="rounded-xl bg-secondary p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-dark">
                  {f.followup_type} · {formatDay(f.followup_date, "medium")}
                </p>
                <StatusBadge status={f.safety_status} />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {f.conducted_by ? `By ${f.conducted_by} · ` : ""}
                {f.protection_order_status}
                {f.new_incident ? " · New incident reported" : ""}
              </p>
              {f.services_received && <p className="mt-1 text-xs text-gray-600"><strong>Services received:</strong> {f.services_received}</p>}
              {f.additional_needs && <p className="mt-1 text-xs text-gray-600"><strong>Additional needs:</strong> {f.additional_needs}</p>}
              {f.next_action && <p className="mt-1 text-xs text-gray-600"><strong>Next action:</strong> {f.next_action}</p>}
              {f.next_followup_date && (
                <p className="mt-1 text-xs font-medium text-primary">
                  Next follow-up: {formatDay(f.next_followup_date, "medium")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** "Record Follow-up". The safety found here moves the case's risk level. */
export function FollowupModal({ caseData, open, onClose, onSaved }: {
  caseData: VawcCase;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const blank = () => ({
    followup_date: manilaToday(),
    conducted_by: user?.name ?? "",
    followup_type: "",
    safety_status: "",
    protection_order_status: protectionStatusFrom(caseData.protection_orders ?? []),
    services_received: "",
    additional_needs: "",
    next_action: "",
    next_followup_date: "",
  });
  const [form, setForm] = useState(blank);
  const [newIncident, setNewIncident] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(blank());
    setNewIncident(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Tab memory only — a VAWC record is never written to the device. Kept
     through a closed dialog; gone on refresh, Discard, or logout. */
  const draft = useModalDraft(
    `vawc-followup:${caseData.id}`,
    open,
    { form, newIncident },
    (kept) => {
      setForm({ ...blank(), ...kept.form });
      setNewIncident(kept.newIncident ?? null);
    },
    {
      memoryOnly: true,
      /* The date and the officer's name fill themselves in. */
      isEmpty: (v) => v.newIncident === null && JSON.stringify(v.form) === JSON.stringify(blank()),
      reset: () => {
        setForm(blank());
        setNewIncident(null);
      },
    },
  );

  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveToCase(
      () => vawcApi.recordFollowup(caseData.id, {
        ...form,
        conducted_by: form.conducted_by.trim(),
        new_incident: newIncident,
        services_received: form.services_received.trim() || null,
        additional_needs: form.additional_needs.trim() || null,
        next_action: form.next_action.trim() || null,
        next_followup_date: form.next_followup_date || null,
      }),
      () => { draft.clear(); onClose(); onSaved(); },
      "Follow-up recorded.",
      "Record this follow-up?",
    );
  };

  const textarea = (key: "services_received" | "additional_needs" | "next_action", label: string) => (
    <FormField label={label} hint="Stored encrypted.">
      <textarea
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        rows={2}
        maxLength={5000}
        className={`${inputClasses} resize-none`}
      />
    </FormField>
  );

  return (
    <Modal open={open} onClose={onClose} title="Record Follow-up" size="wide">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <FormField label="Date" required>
          <input
            type="date"
            value={form.followup_date}
            max={manilaToday()}
            onChange={(e) => set("followup_date", e.target.value)}
            required
            className={inputClasses}
          />
        </FormField>
        <FormField label="Conducted by" required>
          <input
            value={form.conducted_by}
            onChange={(e) => set("conducted_by", e.target.value)}
            required
            maxLength={150}
            className={inputClasses}
          />
        </FormField>
        <FormField label="Method" required>
          <select value={form.followup_type} onChange={(e) => set("followup_type", e.target.value)} required className={inputClasses}>
            <option value="">Select…</option>
            {FOLLOWUP_METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </FormField>
        <FormField
          label="Current safety status"
          required
          hint="Safe, Ongoing concern and Immediate danger update the case's risk level. Unknown leaves it."
        >
          <select value={form.safety_status} onChange={(e) => set("safety_status", e.target.value)} required className={inputClasses}>
            <option value="">Select…</option>
            {SAFETY_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="Protection order status" required>
          <select
            value={form.protection_order_status}
            onChange={(e) => set("protection_order_status", e.target.value)}
            required
            className={inputClasses}
          >
            {PROTECTION_ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </FormField>
        <div>
          <RequiredQuestion text="New incident reported?" />
          <ChoiceGroup
            value={newIncident}
            onChange={setNewIncident}
            options={[{ value: true, label: "Yes" }, { value: false, label: "No" }]}
          />
        </div>
        {textarea("services_received", "Services received")}
        {textarea("additional_needs", "Additional needs")}
        {textarea("next_action", "Next action")}
        <FormField label="Next follow-up date">
          <input
            type="date"
            value={form.next_followup_date}
            min={form.followup_date}
            onChange={(e) => set("next_followup_date", e.target.value)}
            className={inputClasses}
          />
        </FormField>
        <div className="sm:col-span-2">
          <DraftNotice draft={draft} tabOnly />
          <SubmitButton disabled={newIncident === null}>Save follow-up</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
