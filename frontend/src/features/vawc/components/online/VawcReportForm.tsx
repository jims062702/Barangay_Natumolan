import { useMemo, useState, type FormEvent } from "react";
import axios, { type AxiosRequestConfig } from "axios";
import { FiAlertTriangle, FiLock, FiSend } from "react-icons/fi";
import { errorMessage } from "../../../../shared/lib/api";
import { toast } from "../../../../shared/lib/toast";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import ChoiceGroup from "../../../../shared/ui/ChoiceGroup";
import { useUpload } from "../../../../shared/hooks/useUpload";
import { manilaToday } from "../../../../shared/lib/complaintFiling";
import {
  BLANK_RESIDENT_ID,
  ResidentIdCheck,
  type IdCheckSummary,
  type ResidentIdValue,
} from "../../../../shared/residentCard/ResidentIdCheck";
import { useContactFromId } from "../../../../shared/residentCard/useContactFromId";
import PhoneInput from "../../../../shared/ui/PhoneInput";

/** What the server says back once a complaint is received. */
export interface ReportReceipt {
  reference_no: string;
  status: string;
  visit_required: boolean;
  message: string;
}

/* The four kinds RA 9262 names, in words a person uses about their own life. */
const KINDS: { value: string; label: string; hint: string }[] = [
  { value: "Physical", label: "Physical", hint: "Hitting, slapping, kicking, choking, or any injury to the body" },
  { value: "Sexual", label: "Sexual", hint: "Forced or unwanted sexual acts, or being made to do them" },
  { value: "Psychological", label: "Emotional / psychological", hint: "Threats, intimidation, stalking, humiliation, constant abuse in words" },
  { value: "Economic", label: "Economic", hint: "Withholding support or money, stopping you from working, taking what is yours" },
];

const RELATIONSHIPS = ["Spouse", "Former Spouse", "Cohabiting Partner", "Dating Partner", "Sexual Partner", "Other"];

/**
 * A VAWC ONLINE COMPLAINT, as a RESIDENT sends it — on the public page or
 * their portal.
 *
 * FILED BY A WOMAN WHO IS A RESIDENT (the office's rules, 2026-09-29 and
 * 2026-09-30). In the order it is checked:
 *
 *   1. who is complaining — her Barangay Resident ID, read by its QR and
 *      checked against the register, and refused if the record is not a
 *      woman's. Nothing else opens until it shows ID Verified.
 *   2. who it is about — the respondent, a man or a woman, in her own words:
 *      a name and where they live. The register is NOT searched from here;
 *      the VAW Desk finds them on it when it verifies the complaint, as the
 *      Lupon does with its online complaints.
 *   3. her safety, what happened, and how the desk can reach her — the
 *      number on her record filled in, and hers to change or clear.
 *
 * The server checks the card again whatever this page did — see
 * App\Services\Vawc\OnlineReports.
 *
 * SAFETY STILL COMES FIRST ON THE SCREEN: "In danger right now? Call 911" is
 * above this form on both pages, and a "yes" here puts 911 in front of her
 * again. Whether she has been threatened decides the next step, and she is
 * told which before she sends: without a threat she confirms it at the VAW
 * Desk in person; with one, coming in first is optional.
 *
 * NOTHING HERE IS KEPT ON THE DEVICE. No draft, no copy in the browser: what
 * she writes lives in this page until it is sent (encrypted, to the VAW Desk
 * only) or the page is closed.
 */
export function VawcReportForm({
  mode,
  verify,
  send,
  onSent,
}: {
  mode: "public" | "portal";
  /** The check, for a VAWC complaint ("vawc"): a man's card is refused, and her number comes back. */
  verify: (code: string) => Promise<IdCheckSummary>;
  send: (body: FormData, config: AxiosRequestConfig) => Promise<ReportReceipt>;
  onSent: (receipt: ReportReceipt) => void;
}) {
  const today = useMemo(manilaToday, []);
  const [danger, setDanger] = useState<"yes" | "no" | null>(null);
  const [threatened, setThreatened] = useState<"yes" | "no" | null>(null);
  const [kinds, setKinds] = useState<string[]>([]);
  const [narrative, setNarrative] = useState("");
  const [occurredOn, setOccurredOn] = useState("");
  const [place, setPlace] = useState("");
  const [respondentName, setRespondentName] = useState("");
  const [respondentAddress, setRespondentAddress] = useState("");
  const [relationship, setRelationship] = useState("");
  const [safeContact, setSafeContact] = useState("");
  const [safeTime, setSafeTime] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [residentId, setResidentId] = useState<ResidentIdValue>(BLANK_RESIDENT_ID);
  const [sending, setSending] = useState(false);
  const upload = useUpload();

  const verified = residentId.status === "verified" && Boolean(residentId.file && residentId.code);
  const risk = threatened === "yes" || danger === "yes";
  const complete = verified && respondentName.trim().length >= 2 && danger !== null && threatened !== null
    && kinds.length > 0 && narrative.trim().length >= 20;
  const code = residentId.code ?? "";

  /* The number on her record, filled in once her card checks out — hers to change or clear. */
  const contactFromRecord = useContactFromId(residentId, safeContact, setSafeContact);

  const toggle = (kind: string) =>
    setKinds((was) => (was.includes(kind) ? was.filter((k) => k !== kind) : [...was, kind]));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!complete) return;

    const body = new FormData();
    body.append("resident_card_code", code);
    body.append("valid_id", residentId.file as File);
    body.append("respondent_name", respondentName.trim());
    if (respondentAddress.trim()) body.append("respondent_address", respondentAddress.trim());
    kinds.forEach((k) => body.append("violence_types[]", k));
    body.append("narrative", narrative.trim());
    if (occurredOn) body.append("occurred_on", occurredOn);
    if (place.trim()) body.append("place", place.trim());
    if (relationship) body.append("relationship", relationship);
    body.append("threatened", threatened === "yes" ? "1" : "0");
    body.append("in_danger_now", danger === "yes" ? "1" : "0");
    if (safeContact.trim()) body.append("safe_contact", safeContact.trim());
    if (safeTime.trim()) body.append("safe_time", safeTime.trim());
    evidenceFiles.forEach((file) => body.append("evidence[]", file));

    setSending(true);
    try {
      const receipt = await send(body, { ...upload.tracker });
      upload.finish();
      onSent(receipt);
    } catch (err) {
      upload.fail();
      const errors = axios.isAxiosError(err)
        ? (err.response?.data as { errors?: Record<string, string[]> } | undefined)?.errors
        : undefined;
      if (errors?.resident_card_code?.[0]) {
        setResidentId({ ...residentId, status: "failed", message: errors.resident_card_code[0], residentNumber: null, maskedName: null, contactNumber: null });
      } else {
        toast(errorMessage(err), "error");
      }
    } finally {
      setSending(false);
    }
  };

  const section = "rounded-3xl border border-gray bg-white p-5 shadow-sm sm:p-6";

  return (
    <form onSubmit={submit} className="space-y-5" data-testid="vawc-report-form">
      <section className={section}>
        <h2 className="text-base font-bold text-dark">1. Verify that you are a resident</h2>
        <p className="mt-1 mb-4 text-sm leading-relaxed text-gray-500">
          The VAWC online complaint is filed by a <strong className="text-dark">woman who is a registered resident of
          Barangay Natumolan</strong>. Upload your Barangay Resident ID — a photo or scan of the card, or the file
          downloaded from My Profile. The barangay reads its QR code and checks it against the register.
        </p>
        <ResidentIdCheck
          value={residentId}
          onChange={setResidentId}
          mode={mode}
          verify={verify}
          progress={upload.progress}
          done={upload.done}
          disabled={sending}
        />
      </section>

      {!verified ? (
        <div className="flex items-start gap-3 rounded-3xl border border-dashed border-gray bg-white/60 px-5 py-4" data-testid="vawc-locked">
          <FiLock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-gray-600">
            The rest of the complaint opens once your Barangay Resident ID shows <strong>ID Verified</strong>. Not a
            registered resident, or reporting for somebody else? Report at the Barangay VAW Desk in person (Monday to
            Friday, 8:00 AM to 5:00 PM), or at the police Women and Children Protection Desk.
          </p>
        </div>
      ) : (
        <>
          <section className={section}>
            <h2 className="text-base font-bold text-dark">2. The respondent</h2>
            <p className="mt-1 mb-4 text-sm leading-relaxed text-gray-500">
              The person the complaint is about. Write their name and where they live — the VAW Desk finds them on the
              barangay register when it verifies your complaint.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Name of the respondent" required>
                <input
                  value={respondentName}
                  onChange={(e) => setRespondentName(e.target.value)}
                  maxLength={150}
                  aria-label="Name of the respondent"
                  className={inputClasses}
                  required
                />
              </FormField>
              <FormField label="Where they live" hint="Optional — the zone or purok, or the address.">
                <input
                  value={respondentAddress}
                  onChange={(e) => setRespondentAddress(e.target.value)}
                  maxLength={255}
                  aria-label="Where they live"
                  className={inputClasses}
                />
              </FormField>
            </div>
            <div className="mt-4 sm:max-w-sm">
              <FormField label="Who is this person to you?" hint="Optional.">
                <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className={inputClasses}>
                  <option value="">Prefer not to say</option>
                  {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </FormField>
            </div>
          </section>

          <section className={section}>
            <h2 className="text-base font-bold text-dark">3. Your safety</h2>
            <div className="mt-4 space-y-5">
              <ChoiceGroup
                label="Are you in danger right now?"
                value={danger}
                onChange={setDanger}
                stretch
                options={[{ value: "yes" as const, label: "Yes" }, { value: "no" as const, label: "No" }]}
              />
              {danger === "yes" && (
                <div role="alert" className="flex gap-3 rounded-2xl border border-danger/40 bg-danger/5 px-4 py-3" data-testid="call-911">
                  <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
                  <p className="text-sm leading-relaxed text-dark">
                    <strong>Call 911 now</strong>, or go to the nearest police station and ask for the Women and
                    Children Protection Desk. You can finish this complaint when you are safe.
                  </p>
                </div>
              )}
              <ChoiceGroup
                label="Has the person threatened you (or your children)?"
                value={threatened}
                onChange={setThreatened}
                stretch
                options={[{ value: "yes" as const, label: "Yes" }, { value: "no" as const, label: "No" }]}
              />
              {danger !== null && threatened !== null && (
                <p className="rounded-2xl bg-secondary px-4 py-3 text-xs leading-relaxed text-gray-700" data-testid="visit-rule">
                  {risk
                    ? "Because you have been threatened, you do NOT have to come to the VAW Desk before your complaint is acted on. You may still visit at any time."
                    : "After you send this, please visit the Barangay VAW Desk with your Barangay Resident ID to confirm your complaint — it is verified there."}
                </p>
              )}
            </div>
          </section>

          <section className={section}>
            <h2 className="text-base font-bold text-dark">4. What happened</h2>
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-medium text-dark">What kind of harm? <span className="text-danger">*</span> <span className="font-normal text-gray-500">Choose all that apply.</span></legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {KINDS.map((k) => (
                  <label key={k.value} className={`flex cursor-pointer gap-3 rounded-2xl border px-4 py-3 transition-colors ${kinds.includes(k.value) ? "border-primary bg-primary/5" : "border-gray hover:border-primary/50"}`}>
                    <input type="checkbox" checked={kinds.includes(k.value)} onChange={() => toggle(k.value)} className="mt-1 h-4 w-4 accent-[var(--color-primary)]" aria-label={k.label} />
                    <span>
                      <span className="block text-sm font-semibold text-dark">{k.label}</span>
                      <span className="block text-xs text-gray-500">{k.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-4 space-y-4">
              <FormField label="Tell us what happened" required hint="In your own words. Only the VAW Desk reads this.">
                <textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={5} maxLength={5000} className={`${inputClasses} resize-y`} required minLength={20} />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="When did it happen?" hint="Optional. The day it last happened is enough.">
                  <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} max={today} className={inputClasses} />
                </FormField>
                <FormField label="Where?" hint="Optional.">
                  <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={255} className={inputClasses} />
                </FormField>
              </div>

              <FormField
                label="Evidence or supporting documents"
                hint="Optional. Photos, screenshots, medical certificates, or documents (JPG, PNG, WEBP, PDF — up to 5 files, 10 MB each)."
              >
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []);
                    if (selected.length + evidenceFiles.length > 5) {
                      toast("You may only upload up to 5 evidence files.", "error");
                      return;
                    }
                    setEvidenceFiles((prev) => [...prev, ...selected].slice(0, 5));
                  }}
                  className={inputClasses}
                />
                {evidenceFiles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {evidenceFiles.map((f, i) => (
                      <li key={i} className="flex items-center justify-between text-xs text-gray-700 bg-secondary/80 px-3 py-1.5 rounded-xl">
                        <span className="truncate font-medium">{f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)</span>
                        <button
                          type="button"
                          onClick={() => setEvidenceFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-danger hover:underline ml-2 cursor-pointer font-semibold"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </FormField>
            </div>
          </section>

          <section className={section}>
            <h2 className="text-base font-bold text-dark">5. How the VAW Desk can reach you</h2>
            <p className="mt-1 mb-4 text-sm text-gray-500">Optional. Only a number, or a time, that is safe for the desk to use.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Contact number"
                hint={contactFromRecord
                  ? "From your Barangay Resident ID record. Change it if your number has changed — or clear it if it is not safe for the VAW Desk to call or text this number."
                  : "Or another safe way to reach you (+63 followed by 10 digits). Leave blank if none."}
              >
                <PhoneInput value={safeContact} onChange={setSafeContact} />
              </FormField>
              <FormField label="Safe time to contact you">
                <input value={safeTime} onChange={(e) => setSafeTime(e.target.value)} maxLength={100} className={inputClasses} placeholder="e.g. weekdays before noon" />
              </FormField>
            </div>
          </section>
        </>
      )}

      <div className={section}>
        <p className="text-xs leading-relaxed text-gray-500">
          What you send goes only to the Barangay VAW Desk, and it is kept confidential. Nothing you type here is saved on
          this device.
        </p>
        {!complete && (
          <p className="mt-3 rounded-2xl bg-secondary px-4 py-3 text-xs font-medium text-gray-600" data-testid="vawc-needs">
            To send: upload your Barangay Resident ID until it shows <strong>ID Verified</strong>, write the respondent's
            name, answer the two safety questions, choose at least one kind of harm, and tell us what happened.
          </p>
        )}
        <button
          type="submit"
          disabled={sending || !complete}
          className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiSend className="h-4 w-4" aria-hidden="true" /> {sending ? "Sending…" : "Send my complaint to the VAW Desk"}
        </button>
      </div>
    </form>
  );
}
