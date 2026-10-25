import { FiPrinter } from "react-icons/fi";
import { useEffect, useState, type FormEvent } from "react";
import Card from "../../../../shared/ui/Card";
import { useModalDraft } from "../../../../shared/lib/useModalDraft";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { useAuth } from "../../../../shared/auth/AuthContext";
import {
  formatDay, manilaToday, OTHER, REFERRAL_DESTINATIONS, REFERRAL_REASONS, REFERRAL_STATUSES, URGENCIES,
} from "../../lib/caseOptions";
import { vawcApi } from "../../api";
import type { VawcCase } from "../../types";
import { printReferral } from "../../lib/vawcPrint";
import { CardButton, saveToCase, SubmitButton } from "./parts";

/**
 * Referrals & service coordination — where the desk sent her, why, how
 * urgently, and where each referral stands now.
 */
export function ReferralsCard({ caseData, onCreate, onSaved, active }: {
  caseData: VawcCase;
  onCreate: () => void;
  onSaved: () => void;
  active: boolean;
}) {
  const referrals = caseData.referrals ?? [];

  /* A status moves with one choice — confirmed, because it is on the record. */
  const changeStatus = (referralId: number, status: string) =>
    saveToCase(
      () => vawcApi.updateCaseReferral(caseData.id, referralId, { referral_status: status }),
      onSaved,
      "Referral updated.",
      `Mark this referral "${status}"?`,
    );

  return (
    <Card
      title="Referrals & service coordination"
      action={active && <CardButton onClick={onCreate}>Create referral</CardButton>}
    >
      {referrals.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">No referrals yet.</p>
      ) : (
        <ul className="space-y-3">
          {referrals.map((referral) => (
            <li key={referral.id} className="rounded-xl bg-secondary p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-dark">{referral.referral_agency}</p>
                <StatusBadge status={referral.urgency} />
              </div>
              <p className="mt-1 text-xs text-gray-600">
                {referral.referral_reason === "Other"
                  ? referral.reason_other || "Other"
                  : referral.referral_reason ?? referral.services_requested ?? "—"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {formatDay(referral.referral_date, "medium")}
                {referral.referrer?.name ? ` · referred by ${referral.referrer.name}` : ""}
              </p>
              {referral.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">{referral.notes}</p>}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-gray/50 pt-2">
                <button
                  type="button"
                  onClick={() => printReferral(caseData, referral)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray bg-white px-3 py-1 text-xs font-semibold text-primary transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <FiPrinter className="h-3.5 w-3.5" aria-hidden="true" />
                  Print Referral
                </button>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  Status
                  <select
                    value={referral.referral_status}
                    disabled={!active}
                    onChange={(e) => changeStatus(referral.id, e.target.value)}
                    className="cursor-pointer rounded-lg border border-gray bg-white px-2 py-1 text-xs font-semibold text-dark outline-none focus:border-primary disabled:cursor-default"
                  >
                    {REFERRAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** "Create Referral". */
export function ReferralModal({ caseId, open, onClose, onSaved }: {
  caseId: number;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [destination, setDestination] = useState("");
  const [destinationOther, setDestinationOther] = useState("");
  const [reason, setReason] = useState("");
  const [reasonOther, setReasonOther] = useState("");
  const [urgency, setUrgency] = useState("Routine");
  const [date, setDate] = useState(manilaToday);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Pending");

  /* A fresh form each time — one referral's notes never start the next. */
  useEffect(() => {
    if (!open) return;
    setDestination("");
    setDestinationOther("");
    setReason("");
    setReasonOther("");
    setUrgency("Routine");
    setDate(manilaToday());
    setNotes("");
    setStatus("Pending");
  }, [open]);

  /* Tab memory only — a VAWC record is never written to the device. Kept
     through a closed dialog; gone on refresh, Discard, or logout. */
  const blankReferral = () => ({
    destination: "", destinationOther: "", reason: "", reasonOther: "", urgency: "Routine",
    date: manilaToday(), notes: "", status: "Pending",
  });
  const fillReferral = (v: ReturnType<typeof blankReferral>) => {
    setDestination(v.destination);
    setDestinationOther(v.destinationOther);
    setReason(v.reason);
    setReasonOther(v.reasonOther);
    setUrgency(v.urgency);
    setDate(v.date);
    setNotes(v.notes);
    setStatus(v.status);
  };
  const draft = useModalDraft(
    `vawc-referral:${caseId}`,
    open,
    { destination, destinationOther, reason, reasonOther, urgency, date, notes, status },
    (kept) => fillReferral({ ...blankReferral(), ...kept }),
    { memoryOnly: true, blank: blankReferral(), reset: () => fillReferral(blankReferral()) },
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveToCase(
      () => vawcApi.addReferral(caseId, {
        /* "Other" is stored as the office's name, never as the word. */
        referral_agency: destination === OTHER ? destinationOther.trim() : destination,
        referral_reason: reason,
        reason_other: reason === "Other" ? reasonOther.trim() : null,
        urgency,
        referral_date: date,
        referral_status: status,
        notes: notes.trim() || null,
      }),
      () => { draft.clear(); onClose(); onSaved(); },
      "Referral created.",
      "Create this referral?",
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Referral" size="wide">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <FormField label="Referral destination" required>
          <select value={destination} onChange={(e) => setDestination(e.target.value)} required className={inputClasses}>
            <option value="">Select…</option>
            {REFERRAL_DESTINATIONS.map((d) => <option key={d}>{d}</option>)}
            <option value={OTHER}>Other</option>
          </select>
          {destination === OTHER && (
            <input
              value={destinationOther}
              onChange={(e) => setDestinationOther(e.target.value)}
              required
              maxLength={80}
              placeholder="Name of the office or agency"
              className={`${inputClasses} mt-2`}
            />
          )}
        </FormField>
        <FormField label="Reason for referral" required>
          <select value={reason} onChange={(e) => setReason(e.target.value)} required className={inputClasses}>
            <option value="">Select…</option>
            {REFERRAL_REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          {reason === "Other" && (
            <input
              value={reasonOther}
              onChange={(e) => setReasonOther(e.target.value)}
              required
              maxLength={150}
              placeholder="Say what the referral is for"
              className={`${inputClasses} mt-2`}
            />
          )}
        </FormField>
        <FormField label="Urgency">
          <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className={inputClasses}>
            {URGENCIES.map((u) => <option key={u}>{u}</option>)}
          </select>
        </FormField>
        <FormField label="Referral date" required>
          <input
            type="date"
            value={date}
            max={manilaToday()}
            onChange={(e) => setDate(e.target.value)}
            required
            className={inputClasses}
          />
        </FormField>
        {/* Whoever records it is who referred her — shown, not typed. */}
        <FormField label="Referred by">
          <input value={user?.name ?? ""} readOnly disabled className={inputClasses} />
        </FormField>
        <FormField label="Referral status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClasses}>
            {REFERRAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Referral notes" hint="Stored encrypted.">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={5000}
              className={`${inputClasses} resize-none`}
              placeholder="What the receiving office should know, who received it…"
            />
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <DraftNotice draft={draft} tabOnly />
          <SubmitButton>Create referral</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
