import { useEffect, useMemo, useState, type FormEvent } from "react";
import axios from "axios";
import { FiArrowLeft, FiCheckCircle, FiFileText, FiSend } from "react-icons/fi";
import { Link, useSearchParams } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { useUpload } from "../../../shared/hooks/useUpload";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import ChoiceWithOther from "../../../shared/ui/ChoiceWithOther";
import {
  BLANK_RESIDENT_ID,
  ResidentIdCheck,
  type IdCheckSummary,
  type ResidentIdValue,
} from "../../../shared/residentCard/ResidentIdCheck";
import type { CertificateService } from "../../portal/types";
import logo from "../../../assets/logo/barangay-logo.png";
import { publicApi } from "../api";

/** One detail the certificate prints about the person, and whether their record has it. */
interface Need {
  field: string;
  label: string;
  on_record: boolean;
}

interface Receipt {
  request_number: string;
  service_type: string;
  filled: string[];
  message: string;
}

const peso = (n: number) => `₱${n.toFixed(2)}`;
const CIVIL_STATUSES = ["Single", "Married", "Widowed", "Separated"];

/**
 * ONLINE CERTIFICATE REQUEST — for a registered resident, WITHOUT signing
 * in: their Barangay Resident ID is the proof of who they are (2026-09-29).
 *
 *   1. the Resident ID, read by its QR and checked against the register
 *   2. which certificate, and what it is for
 *   3. what the certificate prints about them — taken from the record the
 *      ID names. The page says which details are on record (never shows
 *      them); only what the record lacks is asked, and it fills that blank.
 *
 * Residents only: there is no other way in. The request lands on the
 * Clerk's list like any portal request, and is paid for and claimed at the
 * Barangay Hall.
 */
export default function RequestCertificate() {
  const [params] = useSearchParams();
  const [services, setServices] = useState<CertificateService[]>([]);
  const [residentId, setResidentId] = useState<ResidentIdValue>(BLANK_RESIDENT_ID);
  const [serviceType, setServiceType] = useState(params.get("type") ?? "");
  const [purpose, setPurpose] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessKind, setBusinessKind] = useState("");
  const [needs, setNeeds] = useState<Need[] | null>(null);
  const [zones, setZones] = useState<string[]>([]);
  const [details, setDetails] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const upload = useUpload();

  useEffect(() => {
    publicApi.certificateServices()
      .then((r) => {
        const list: CertificateService[] = r.data.data ?? [];
        setServices(list);
        /* A ?type= from a link counts only if it is one offered online. */
        setServiceType((was) => (list.some((x) => x.certificate_type === was) ? was : ""));
      })
      .catch(() => toast("The list of certificates could not be loaded. Please reload the page.", "error"));
  }, []);

  const verify = async (code: string) => (await publicApi.verifyResidentId({ code })).data.data as IdCheckSummary;
  const code = residentId.status === "verified" ? residentId.code ?? "" : "";
  const chosen = services.find((s) => s.certificate_type === serviceType) ?? null;

  /* What this certificate needs about them — asked again whenever the card or the certificate changes. */
  useEffect(() => {
    if (!code || !serviceType) {
      setNeeds(null);
      return;
    }
    let live = true;
    setChecking(true);
    publicApi.checkCertificateRequest({ resident_card_code: code, service_type: serviceType })
      .then((r) => {
        if (!live) return;
        setNeeds(r.data.data.needs ?? []);
        setZones(r.data.data.zones ?? []);
        setCheckError("");
      })
      .catch((err) => {
        if (!live) return;
        setNeeds(null);
        setCheckError(errorMessage(err));
      })
      .finally(() => live && setChecking(false));

    return () => { live = false; };
  }, [code, serviceType]);

  const missing = (needs ?? []).filter((n) => !n.on_record);
  const fee = useMemo(() => {
    if (!chosen) return null;
    if (chosen.fee !== null) return chosen.fee;
    const list = chosen.fee_from === "business" ? chosen.business_kinds : chosen.purposes;
    const answer = chosen.fee_from === "business" ? businessKind : purpose;
    if (!answer.trim()) return null;

    return list && Object.prototype.hasOwnProperty.call(list, answer) ? list[answer] : chosen.other_fee ?? null;
  }, [chosen, purpose, businessKind]);

  const purposeOk = chosen?.asks_purpose === false || purpose.trim() !== "";
  const businessOk = chosen?.fee_from !== "business" || (businessName.trim() !== "" && businessKind.trim() !== "");
  const detailsOk = missing.every((n) => (details[n.field] ?? "").trim() !== "");
  const complete = Boolean(code && chosen && needs !== null && purposeOk && businessOk && detailsOk);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!complete || !chosen) return;
    setSending(true);
    try {
      const r = await publicApi.sendCertificateRequest({
        resident_card_code: code,
        service_type: chosen.certificate_type,
        purpose: chosen.asks_purpose === false ? undefined : purpose.trim(),
        template_fields: chosen.fee_from === "business" ? { business_name: businessName.trim(), business_kind: businessKind.trim() } : undefined,
        details: Object.fromEntries(missing.map((n) => [n.field, (details[n.field] ?? "").trim()])),
      });
      setReceipt({ ...r.data.data, message: r.data.message });
    } catch (err) {
      const refused = axios.isAxiosError(err)
        ? (err.response?.data as { errors?: Record<string, string[]> } | undefined)?.errors?.resident_card_code?.[0]
        : undefined;
      if (refused) setResidentId({ ...residentId, status: "failed", message: refused, residentNumber: null, maskedName: null, contactNumber: null });
      else toast(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  };

  const section = "rounded-3xl border border-gray bg-white p-5 shadow-sm sm:p-6";

  return (
    <div className="min-h-screen bg-secondary px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <Link to="/" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
          <FiArrowLeft aria-hidden="true" /> Back to website
        </Link>

        <div className="mb-6 text-center">
          <img src={logo} alt="Barangay Natumolan logo" className="mx-auto h-16 w-16 rounded-full object-cover" />
          <h1 className="mt-3 text-2xl font-bold text-dark">Online Certificate Request</h1>
          <p className="mx-auto mt-1 max-w-xl text-sm leading-relaxed text-gray-500">
            For registered residents of Barangay Natumolan — no account needed, only your Barangay Resident ID.
          </p>
        </div>

        {receipt ? (
          <div className="rounded-3xl border border-success/30 bg-white p-6 shadow-sm" data-testid="certificate-receipt">
            <div className="flex items-center gap-2">
              <FiCheckCircle className="h-6 w-6 text-success" aria-hidden="true" />
              <p className="text-lg font-bold text-dark">Request received</p>
            </div>
            <p className="mt-2 text-sm text-gray-600">{receipt.service_type} · Request number</p>
            <p className="font-mono text-2xl font-bold tracking-wide text-primary">{receipt.request_number}</p>
            <p className="mt-4 text-sm leading-relaxed text-dark">{receipt.message}</p>
            {receipt.filled.length > 0 && (
              <p className="mt-3 text-xs text-gray-500">
                Added to your barangay record: {receipt.filled.join(", ")}. The office checks them when you claim the certificate.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5" data-testid="certificate-request-form">
            <section className={section}>
              <h2 className="text-base font-bold text-dark">1. Your Barangay Resident ID</h2>
              <p className="mt-1 mb-4 text-sm leading-relaxed text-gray-500">
                Upload a photo or scan of your card, or the file downloaded from My Profile. The barangay reads its QR
                code and checks it against the register — the certificate is issued in the name the card carries.
              </p>
              <ResidentIdCheck
                value={residentId}
                onChange={setResidentId}
                mode="public"
                verify={verify}
                progress={upload.progress}
                done={upload.done}
                disabled={sending}
              />
            </section>

            {!code ? (
              <p className="rounded-3xl border border-dashed border-gray bg-white/60 px-5 py-4 text-sm leading-relaxed text-gray-600" data-testid="certificate-locked">
                The request opens once your Barangay Resident ID shows <strong>ID Verified</strong>. Not a registered
                resident? Certificates are issued only to residents — ask at the Barangay Hall how to register.
              </p>
            ) : (
              <>
                <section className={section}>
                  <h2 className="text-base font-bold text-dark">2. Which certificate?</h2>
                  <div className="mt-4 space-y-4">
                    <FormField label="Certificate" required>
                      <select value={serviceType} onChange={(e) => { setServiceType(e.target.value); setPurpose(""); setBusinessKind(""); }} className={inputClasses} aria-label="Certificate">
                        <option value="">Choose…</option>
                        {services.map((s) => (
                          <option key={s.certificate_type} value={s.certificate_type}>
                            {s.certificate_type}{s.fee !== null ? ` — ${peso(s.fee)}` : ""}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    {chosen && (
                      <div className="rounded-xl border border-gray bg-secondary/50 p-4 text-xs text-gray-700">
                        {chosen.description && <p className="mb-2 leading-relaxed">{chosen.description}</p>}
                        <p className="text-sm">
                          <span className="text-gray-500">Amount at the counter: </span>
                          <strong className="text-dark">{fee !== null ? peso(fee + (chosen.documentary_stamp ?? 0)) : "Choose below to see it"}</strong>
                        </p>
                        {chosen.requirements.length > 0 && (
                          <>
                            <p className="mt-2 font-semibold uppercase tracking-wide text-gray-500">Bring when you claim it</p>
                            <ul className="list-inside list-disc">
                              {chosen.requirements.map((r) => <li key={r}>{r}</li>)}
                            </ul>
                          </>
                        )}
                      </div>
                    )}

                    {chosen?.fee_from === "business" && (
                      <>
                        <FormField label="Business name" required>
                          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={150} className={inputClasses} />
                        </FormField>
                        <FormField label="Kind of business" required hint="Not on the list? Choose Others and type it.">
                          <ChoiceWithOther
                            options={chosen.business_kinds ?? {}}
                            value={businessKind}
                            onChange={setBusinessKind}
                            placeholder="Choose the kind of business…"
                            otherPlaceholder="Type the kind of business"
                            otherPrice={chosen.other_fee}
                            required
                          />
                        </FormField>
                      </>
                    )}

                    {chosen && chosen.asks_purpose !== false && (chosen.fee_from === "clearance" ? (
                      <FormField label="Purpose" required hint="Not on the list? Choose Others and type it.">
                        <ChoiceWithOther
                          options={chosen.purposes ?? {}}
                          value={purpose}
                          onChange={setPurpose}
                          placeholder="Choose what you need it for…"
                          otherPlaceholder="Type the purpose"
                          otherPrice={chosen.other_fee}
                          required
                        />
                      </FormField>
                    ) : (
                      <FormField label="Purpose" required hint="e.g. Employment requirement, school enrollment">
                        <input value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={500} className={inputClasses} aria-label="Purpose" />
                      </FormField>
                    ))}
                  </div>
                </section>

                {chosen && (
                  <section className={section} data-testid="certificate-details">
                    <h2 className="text-base font-bold text-dark">3. What the certificate states about you</h2>
                    <p className="mt-1 mb-4 text-sm leading-relaxed text-gray-500">
                      Taken from your barangay record — the one your Resident ID names. Only what your record does not
                      have yet is asked here, and it is added to your record.
                    </p>
                    {checking && <p className="text-xs text-gray-500">Checking your record…</p>}
                    {checkError && <p className="text-xs font-medium text-danger" role="alert">{checkError}</p>}
                    {needs && (
                      <ul className="space-y-3">
                        <li className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-dark">Name</span>
                          <span className="text-xs font-semibold text-success">From your Resident ID ✓</span>
                        </li>
                        {needs.map((n) => (
                          <li key={n.field} data-testid="certificate-need" data-field={n.field} data-on-record={n.on_record ? "1" : "0"}>
                            {n.on_record ? (
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-dark">{n.label}</span>
                                <span className="text-xs font-semibold text-success">On your record ✓</span>
                              </div>
                            ) : (
                              <FormField label={n.label} required hint="Your record does not have this yet.">
                                {n.field === "gender" ? (
                                  <select value={details.gender ?? ""} onChange={(e) => setDetails((d) => ({ ...d, gender: e.target.value }))} className={inputClasses} aria-label={n.label}>
                                    <option value="">Choose…</option>
                                    <option>Male</option>
                                    <option>Female</option>
                                  </select>
                                ) : n.field === "civil_status" ? (
                                  <select value={details.civil_status ?? ""} onChange={(e) => setDetails((d) => ({ ...d, civil_status: e.target.value }))} className={inputClasses} aria-label={n.label}>
                                    <option value="">Choose…</option>
                                    {CIVIL_STATUSES.map((c) => <option key={c}>{c}</option>)}
                                  </select>
                                ) : n.field === "zone_purok" ? (
                                  <select value={details.zone_purok ?? ""} onChange={(e) => setDetails((d) => ({ ...d, zone_purok: e.target.value }))} className={inputClasses} aria-label={n.label}>
                                    <option value="">Choose…</option>
                                    {zones.map((z) => <option key={z}>{z}</option>)}
                                  </select>
                                ) : (
                                  <input
                                    type={n.field === "birthdate" ? "date" : "text"}
                                    value={details[n.field] ?? ""}
                                    onChange={(e) => setDetails((d) => ({ ...d, [n.field]: e.target.value }))}
                                    maxLength={n.field === "address" ? 255 : 150}
                                    className={inputClasses}
                                    aria-label={n.label}
                                  />
                                )}
                              </FormField>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </>
            )}

            <div className={section}>
              <p className="flex items-start gap-2 text-xs leading-relaxed text-gray-500">
                <FiFileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                The request goes to the Barangay Clerk. Pay the fee and claim the certificate at the Barangay Hall
                (Monday to Friday, 8:00 AM to 5:00 PM), and bring your Barangay Resident ID.
              </p>
              <button
                type="submit"
                disabled={sending || !complete}
                className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiSend className="h-4 w-4" aria-hidden="true" /> {sending ? "Sending…" : "Request the certificate"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
