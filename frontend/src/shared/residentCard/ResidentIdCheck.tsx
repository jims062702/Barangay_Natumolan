import { useRef, useState } from "react";
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiLoader, FiShield } from "react-icons/fi";
import { Link } from "react-router-dom";
import { errorMessage } from "../lib/api";
import FileField from "../ui/FileField";
import FormField, { inputClasses } from "../ui/FormField";
import { cardCode, readQrFromImage } from "./readQr";

/**
 * A resident's Barangay Resident ID: uploaded, read, and checked — the one
 * step every resident-only form shares (the Online Complaint, the VAWC
 * report, and the portal's own versions of both).
 *
 * The picture is read HERE for its QR — the picture itself, never its file
 * name — and the code the QR carries is then checked by the server against
 * the register: a card this barangay issued, still the current one, held by
 * somebody still living here (and, on the portal, the signed-in resident's
 * own). The server checks it again when the form is sent, so this state is
 * what the person sees, not what the barangay trusts.
 */
export type IdCheckStatus = "idle" | "reading" | "pending" | "verified" | "failed";

export interface ResidentIdValue {
  file: File | null;
  code: string | null;
  status: IdCheckStatus;
  message: string;
  residentNumber: string | null;
  maskedName: string | null;
  /** The number on the record — only when the form asked for it (a complaint); see useContactFromId. */
  contactNumber: string | null;
  isMinor?: boolean;
  age?: number | null;
  guardianReminder?: string | null;
}

export const BLANK_RESIDENT_ID: ResidentIdValue = {
  file: null, code: null, status: "idle", message: "", residentNumber: null, maskedName: null, contactNumber: null,
  isMinor: false, age: null, guardianReminder: null,
};

export const RESIDENT_ID_ACCEPT = "image/jpeg,image/png,image/webp";

export interface IdCheckSummary {
  valid: boolean;
  message: string;
  resident_number: string | null;
  masked_name: string | null;
  /** Sent only to a complaint form that asked (`purpose`) — ResidentCards::formSummary. */
  contact_number?: string | null;
  is_minor?: boolean;
  age?: number | null;
  guardian_reminder?: string | null;
}

export function ResidentIdCheck({
  value,
  onChange,
  mode,
  verify,
  progress = null,
  done = false,
  disabled = false,
}: {
  value: ResidentIdValue;
  onChange: (next: ResidentIdValue) => void;
  /** "portal": the card must also be the signed-in resident's own. */
  mode: "public" | "portal";
  /** The server's check of a code — the public one, or the portal's (which also asks "is it yours?"). */
  verify: (code: string) => Promise<IdCheckSummary>;
  progress?: number | null;
  done?: boolean;
  disabled?: boolean;
}) {
  const [typed, setTyped] = useState("");
  /* Only the latest pick counts: a slow read of an earlier picture must not
     overwrite the answer for the one chosen after it. */
  const attempt = useRef(0);

  const check = async (file: File | null, code: string, turn: number) => {
    onChange({ ...BLANK_RESIDENT_ID, file, code, status: "pending", message: "" });
    try {
      const s = await verify(code);
      if (turn !== attempt.current) return;
      onChange({
        file, code,
        status: s.valid ? "verified" : "failed",
        message: s.message,
        residentNumber: s.valid ? s.resident_number : null,
        maskedName: s.valid ? s.masked_name : null,
        contactNumber: s.valid ? s.contact_number ?? null : null,
        isMinor: s.valid ? (s.is_minor ?? false) : false,
        age: s.valid ? (s.age ?? null) : null,
        guardianReminder: s.valid ? (s.guardian_reminder ?? null) : null,
      });
    } catch (err) {
      if (turn !== attempt.current) return;
      onChange({ ...BLANK_RESIDENT_ID, file, code, status: "failed", message: errorMessage(err) });
    }
  };

  const pick = async (file: File | null) => {
    const turn = ++attempt.current;
    if (!file) {
      onChange(BLANK_RESIDENT_ID);
      return;
    }
    if (!RESIDENT_ID_ACCEPT.split(",").includes(file.type)) {
      onChange({ ...BLANK_RESIDENT_ID, file, status: "failed", message: "Upload a picture of your ID — JPG, PNG or WEBP — so its QR code can be read." });
      return;
    }
    onChange({ ...BLANK_RESIDENT_ID, file, status: "reading" });
    let code: string | null = null;
    try {
      code = cardCode(await readQrFromImage(file));
    } catch {
      code = null;
    }
    if (turn !== attempt.current) return;
    if (!code) {
      onChange({
        ...BLANK_RESIDENT_ID, file, status: "failed",
        message: "We could not read a Barangay Resident ID QR code in this picture. Take a sharper photo with the whole card in view and the QR in focus — or type the verification code printed under the QR below.",
      });
      return;
    }
    await check(file, code, turn);
  };

  const checkTyped = async () => {
    const code = cardCode(typed);
    const turn = ++attempt.current;
    if (!code) {
      onChange({ ...value, code: null, status: "failed", message: "That is not a verification code. It has 12 letters and numbers, printed as XXXX-XXXX-XXXX under the QR." });
      return;
    }
    await check(value.file, code, turn);
  };

  const s = value.status;

  return (
    <div className="space-y-4" data-testid="resident-id-check">
      <div className="flex gap-3 rounded-2xl bg-primary/5 px-4 py-3">
        <FiShield className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="text-xs leading-relaxed text-dark">
          <p>
            <strong>Why we ask:</strong> your Barangay Resident ID tells the barangay which resident is
            filing. Its QR code is checked against the barangay register, so you do not have to type your
            name, birthday or address.
          </p>
          <p className="mt-1 text-gray-600">
            {mode === "portal" ? (
              <>Use your own card — a photo or scan, or the file from{" "}
                <Link to="/resident/profile" className="font-semibold text-primary hover:underline">My Profile → Barangay Resident Card / ID</Link>.</>
            ) : (
              <>A photo or scan of your card, or the ID file from your resident portal (My Profile → Barangay Resident Card / ID).
                No card yet? The Population Office issues one.</>
            )}
          </p>
        </div>
      </div>

      <FormField
        label="Your Barangay Resident ID"
        required
        plain
        hint="JPG, PNG or WEBP, up to 5 MB. The whole card in view, the QR code sharp."
      >
        <FileField
          file={value.file}
          onPick={pick}
          accept={RESIDENT_ID_ACCEPT}
          progress={progress}
          done={done}
          disabled={disabled}
        />
      </FormField>

      {s !== "idle" && (
        <div
          role="status"
          data-testid="resident-id-status"
          data-status={s}
          className={`flex gap-3 rounded-2xl border px-4 py-3 ${
            s === "verified" ? "border-success/40 bg-success/5"
              : s === "failed" ? "border-danger/40 bg-danger/5"
                : "border-warning/40 bg-warning/5"
          }`}
        >
          {s === "verified" ? <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            : s === "failed" ? <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
              : <FiLoader className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-warning" aria-hidden="true" />}
          <div className="min-w-0 text-sm leading-relaxed text-dark">
            <p className="font-bold">
              {s === "verified" ? "ID Verified" : s === "failed" ? "ID Verification Failed" : "Verification Pending"}
            </p>
            {s === "verified" && (
              <>
                <p className="text-gray-600">
                  Resident Number <span className="font-mono font-semibold text-dark">{value.residentNumber}</span> · {value.maskedName}
                </p>
                {value.isMinor && (
                  <div className="mt-2.5 rounded-xl border border-warning/50 bg-warning/10 p-3 text-xs leading-relaxed text-dark">
                    <p className="flex items-center gap-1.5 font-bold text-amber-900">
                      <FiAlertTriangle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                      Parent / Legal Guardian Required (Age: {value.age ?? "17 and below"})
                    </p>
                    <p className="mt-1 text-gray-700">
                      Please be reminded that because you are <strong>17 years old or below</strong>{value.age ? ` (${value.age} years old)` : ""}, you must be accompanied by a <strong>parent or legal guardian</strong> when appearing at the Barangay Hall to claim documents, attend hearings, or process your complaint/request.
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-amber-800">
                      (Paalala: Dahil ikaw ay menor de edad / 17 anyos pababa, kailangang magsama ng magulang o legal guardian sa pagpunta sa Barangay Hall.)
                    </p>
                  </div>
                )}
              </>
            )}
            {s === "failed" && <p className="text-gray-600">{value.message}</p>}
            {(s === "reading" || s === "pending") && (
              <p className="text-gray-600">{s === "reading" ? "Reading the QR code in your picture…" : "Checking the code against the barangay register…"}</p>
            )}
          </div>
        </div>
      )}

      {s === "failed" && value.file && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1">
            <FormField label="Verification code (under the QR)" hint="12 letters and numbers, e.g. 7K3M-Q9TD-X2PA">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className={`${inputClasses} font-mono uppercase`}
                maxLength={20}
                aria-label="Verification code"
                disabled={disabled}
              />
            </FormField>
          </div>
          <button
            type="button"
            onClick={checkTyped}
            disabled={disabled || !typed.trim()}
            className="mb-[2px] cursor-pointer rounded-full border border-primary px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Check code
          </button>
        </div>
      )}
    </div>
  );
}
