import { useEffect, useState } from "react";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import { publicApi } from "../../public/api";
import {
  BPO_DAYS, BPO_ISSUERS, BPO_STATUSES, bpoLastDay, formatDay, manilaToday,
} from "../lib/caseOptions";

/** One Barangay Protection Order as the form holds it — every box a string. */
export interface BpoDraft {
  status: string;
  applied_on: string;
  issued_on: string;
  issued_by: string;
  issued_by_name: string;
  notes: string;
}

export const emptyBpo = (status = "Not Yet Applied"): BpoDraft => ({
  status,
  applied_on: "",
  issued_on: "",
  issued_by: "",
  issued_by_name: "",
  notes: "",
});

/** Statuses that come after an application was actually made. */
const APPLIED = ["Applied", "Issued", "Not Issued", "Referred for TPO/PPO"];

/**
 * What is sent: only the answers the chosen status asks for.
 *
 * The server drops the rest too, but a form that sends an issuing official
 * with a status of "Applied" is a form somebody will one day misread.
 */
export function bpoPayload(draft: BpoDraft) {
  const issued = draft.status === "Issued";

  return {
    status: draft.status,
    applied_on: APPLIED.includes(draft.status) ? draft.applied_on || null : null,
    issued_on: issued ? draft.issued_on || null : null,
    issued_by: issued ? draft.issued_by || null : null,
    issued_by_name: issued ? draft.issued_by_name.trim() || null : null,
    notes: draft.notes.trim() || null,
  };
}

interface Official {
  name: string;
  position: string;
}

/**
 * The officials who may issue a BPO, from the barangay's own roster.
 *
 * Read from the public officials list, which is public by nature and is the
 * only thing on this form that may be kept on the device.
 */
function useIssuers() {
  const [officials, setOfficials] = useState<Official[] | null>(null);

  useEffect(() => {
    publicApi.officials()
      .then((r) => setOfficials((r.data.data?.barangay ?? []) as Official[]))
      .catch(() => setOfficials([]));
  }, []);

  return officials;
}

/**
 * The fields of one Barangay Protection Order.
 *
 * Used at intake ("Immediate protection needed? Yes") and by "Apply for BPO"
 * on the case, so an order is asked for the same way in both places.
 *
 * The last day in effect is shown, never asked: fifteen days counted from
 * the day of issuance.
 */
export default function BpoFields({
  value,
  onChange,
  showNotes = true,
  /** "YYYY-MM-DD" a renewal must come after — the renewed order's issuance. */
  issuedAfter,
}: {
  value: BpoDraft;
  onChange: (next: BpoDraft) => void;
  showNotes?: boolean;
  issuedAfter?: string | null;
}) {
  const officials = useIssuers();
  const set = <K extends keyof BpoDraft>(key: K, v: BpoDraft[K]) => onChange({ ...value, [key]: v });
  const today = manilaToday();

  const applied = APPLIED.includes(value.status);
  const issued = value.status === "Issued";
  const names = (officials ?? []).filter((o) => o.position === value.issued_by).map((o) => o.name);

  /* Choosing who issued it: the Punong Barangay is one person, so their name
     fills itself in; a Kagawad has to be picked. */
  const pickIssuer = (issuer: string) => {
    const pool = (officials ?? []).filter((o) => o.position === issuer).map((o) => o.name);
    onChange({ ...value, issued_by: issuer, issued_by_name: pool.length === 1 ? pool[0] : "" });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="BPO status" required>
        <select
          value={value.status}
          onChange={(e) => set("status", e.target.value)}
          required
          className={inputClasses}
        >
          {BPO_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </FormField>

      {applied && (
        <FormField
          label="Date applied"
          required={value.status === "Applied"}
          hint={issued ? "Leave blank if it was applied for on the day it was issued." : undefined}
        >
          <input
            type="date"
            value={value.applied_on}
            max={today}
            onChange={(e) => set("applied_on", e.target.value)}
            required={value.status === "Applied"}
            className={inputClasses}
          />
        </FormField>
      )}

      {issued && (
        <>
          <FormField label="Date issued" required>
            <input
              type="date"
              value={value.issued_on}
              min={issuedAfter ? bpoLastDay(issuedAfter, 2) : value.applied_on || undefined}
              max={today}
              onChange={(e) => set("issued_on", e.target.value)}
              required
              className={inputClasses}
            />
          </FormField>
          <FormField label="Issued by" required>
            <select
              value={value.issued_by}
              onChange={(e) => pickIssuer(e.target.value)}
              required
              className={inputClasses}
            >
              <option value="">Select…</option>
              {BPO_ISSUERS.map((i) => <option key={i}>{i}</option>)}
            </select>
          </FormField>
          <FormField label="Name of the issuing official" required>
            {/*
              From the roster when it could be read; typed when it could not
              (offline, or a roster nobody has filled in yet). The name the
              order was actually signed by must always be recordable.
            */}
            {names.length > 0 ? (
              <select
                value={value.issued_by_name}
                onChange={(e) => set("issued_by_name", e.target.value)}
                required
                className={inputClasses}
              >
                <option value="">Select…</option>
                {names.map((n) => <option key={n}>{n}</option>)}
                {value.issued_by_name && !names.includes(value.issued_by_name) && (
                  <option>{value.issued_by_name}</option>
                )}
              </select>
            ) : (
              <input
                value={value.issued_by_name}
                onChange={(e) => set("issued_by_name", e.target.value)}
                required
                maxLength={150}
                disabled={!value.issued_by}
                placeholder={value.issued_by ? "Full name" : "Choose who issued it first"}
                className={inputClasses}
              />
            )}
          </FormField>
          <div className="self-end rounded-xl bg-primary/5 px-4 py-2.5 text-sm text-dark">
            {value.issued_on ? (
              <>
                In effect for {BPO_DAYS} days:{" "}
                <strong className="font-semibold">
                  {formatDay(value.issued_on, "medium")} – {formatDay(bpoLastDay(value.issued_on), "medium")}
                </strong>
              </>
            ) : (
              <>In effect for {BPO_DAYS} days from the date issued.</>
            )}
          </div>
        </>
      )}

      {showNotes && (
        <div className="sm:col-span-2">
          <FormField label="Notes" hint="Stored encrypted.">
            <textarea
              value={value.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              maxLength={2000}
              className={`${inputClasses} resize-none`}
              placeholder={
                value.status === "Not Issued"
                  ? "Why the BPO was not issued…"
                  : "What the order directs, or where the application stands…"
              }
            />
          </FormField>
        </div>
      )}

      <p className="text-xs leading-relaxed text-gray-500 sm:col-span-2">
        A BPO is issued by the Punong Barangay, or by an available Barangay Kagawad when the Punong
        Barangay is unavailable, and is in effect for {BPO_DAYS} days. It can be renewed when it runs out.
      </p>
    </div>
  );
}
