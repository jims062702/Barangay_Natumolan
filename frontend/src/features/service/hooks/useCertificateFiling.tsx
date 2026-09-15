import { useState, type FormEvent } from "react";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import ChoiceWithOther from "../../../shared/ui/ChoiceWithOther";
import { confirmAction } from "../../../shared/lib/confirm";
import { isOffline } from "../../../shared/offline/connectivity";
import { toast } from "../../../shared/lib/toast";
import { enqueue } from "../../../shared/offline/writeQueue";
import { personName } from "../../../shared/lib/names";
import { errorMessage } from "../../../shared/lib/api";
import type { Resident, ServiceRequest } from "../../../shared/types";
import { fromRegister, toCertType, AFTER_PURPOSE, FIELD_LABELS, FIELD_HINTS } from "../lib/certificateFields";
import { serviceApi } from "../api";
import { mintLocalNumber, mintReference } from "../lib/certificateNumbers";
import type { CertificateRowsState } from "./useCertificateRows";

/**
 * Filing a new certificate: who it is for, which type, its answers and its fee.
 */
export function useCertificateFiling(ctx: CertificateRowsState) {
  const {
    catalogue, load,
  } = ctx;

  const [createOpen, setCreateOpen] = useState(false);
  const [certResident, setCertResident] = useState<Resident | null>(null);
  const [residentRequests, setResidentRequests] = useState<ServiceRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [certType, setCertType] = useState("Barangay Clearance");
  /* The answers this particular form asks for beyond the register. */
  const [fields, setFields] = useState<Record<string, string>>({});
  const [purpose, setPurpose] = useState("");
  const [fee, setFee] = useState("50");
  const [exempt, setExempt] = useState(false);
  const [exemptReason, setExemptReason] = useState("");
  const [saving, setSaving] = useState(false);
  /** What this type charges, given the answer that decides it. */
  const feeFor = (type: string, purposeText: string, answers: Record<string, string>) => {
    const spec = catalogue?.types.find((t) => t.name === type);

    if (!spec) return 0;
    if (spec.fee !== null) return spec.fee;

    const choice = spec.fee_field === "purpose" ? purposeText : answers[spec.fee_field ?? ""];
    const table =
      spec.fee_from === "clearance" ? catalogue?.clearance_purposes : catalogue?.business_kinds;

    return table?.[choice ?? ""] ?? catalogue?.other_certification_fee ?? 0;
  };
  const resetCreateForm = () => {
    setCertResident(null);
    setResidentRequests([]);
    setSelectedRequestId("");
    setCertType("Barangay Clearance");
    setPurpose("");
    setFields({});
    setFee("");
    setExempt(false);
    setExemptReason("");
  };
  const closeCreate = () => {
    setCreateOpen(false);
    resetCreateForm();
  };
  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };
  // When a resident is picked, load their PENDING requests so a certificate
  // can be started from one (type auto-fills). In-Progress requests are
  // excluded — their certificate was already filed automatically when the
  // clerk pressed "Start processing". Empty = walk-in.
  const pickResident = async (resident: Resident | null) => {
    setCertResident(resident);
    setSelectedRequestId("");
    setResidentRequests([]);
    /* Their record answers part of the form the moment they are chosen. */
    setFields(fromRegister(resident));
    if (!resident) return;
    try {
      const response = await serviceApi.serviceRequests({
        params: { resident_id: resident.id },
      });
      const open = (response.data.data.data ?? []).filter(
        (r: ServiceRequest) => r.status === "Pending"
      );
      setResidentRequests(open);
    } catch {
      setResidentRequests([]);
    }
  };
  // Choosing an existing request auto-fills the type, purpose, and fee.
  const chooseRequest = (requestId: string) => {
    setSelectedRequestId(requestId);
    const request = residentRequests.find((r) => String(r.id) === requestId);
    if (request) {
      const type = toCertType(
        request.service_type,
        (catalogue?.types ?? []).map((t) => t.name),
      );

      setCertType(type);
      /* Same as a type change: the previous form's answers go, what the
         register knows about the person stays. */
      setFields(fromRegister(certResident));
      if (request.purpose) setPurpose(request.purpose);
      setFee(String(feeFor(type, request.purpose ?? "", {})));
    }
  };
  const changeType = (type: string) => {
    setCertType(type);
    /* Answers belong to the form that asked them; keeping them across a
       type change carried a date of death onto a residency certificate.
       What the REGISTER knows survives, because it was never the previous
       form's answer — it is a fact about the person. */
    setFields(fromRegister(certResident));
    if (!exempt) setFee(String(feeFor(type, purpose, {})));
  };
  /*
   * The purpose moves the price, not only the type. A clearance for a
   * Mayor's Permit is ₱200 and one for local employment is ₱30, so the
   * amount has to follow the dropdown as it changes.
   */
  const changePurpose = (value: string) => {
    setPurpose(value);
    if (!exempt) setFee(String(feeFor(certType, value, fields)));
  };
  const changeField = (key: string, value: string) => {
    const next = { ...fields, [key]: value };

    setFields(next);
    if (!exempt) setFee(String(feeFor(certType, purpose, next)));
  };
  const spec = catalogue?.types.find((t) => t.name === certType);
  /* The form's questions, split where the purpose prints. */
  const beforePurpose = (spec?.fields ?? []).filter((key) => !AFTER_PURPOSE.has(key));
  const afterPurpose = (spec?.fields ?? []).filter((key) => AFTER_PURPOSE.has(key));
  /*
   * One box of questions, in the order the sheet prints them. Nothing shows
   * for a certificate that asks nothing.
   */
  const fieldBox = (keys: string[], heading: string) =>
    keys.length > 0 && (
      <div className="rounded-2xl border border-gray bg-secondary/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {heading}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {keys.map((key) => (
            <FormField key={key} label={FIELD_LABELS[key] ?? key} hint={FIELD_HINTS[key]}>
              {key === "business_kind" ? (
                <ChoiceWithOther
                  options={catalogue?.business_kinds ?? {}}
                  value={fields[key] ?? ""}
                  onChange={(value) => changeField(key, value)}
                  placeholder="Choose the kind of business…"
                  otherPlaceholder="Type the kind of business — e.g. Water Refilling Station"
                  otherPrice={catalogue?.other_certification_fee}
                />
              ) : key === "date_of_death" ? (
                <input
                  type="date"
                  value={fields[key] ?? ""}
                  onChange={(e) => changeField(key, e.target.value)}
                  className={inputClasses}
                />
              ) : key === "body" ? (
                <textarea
                  rows={3}
                  value={fields[key] ?? ""}
                  onChange={(e) => changeField(key, e.target.value)}
                  className={inputClasses}
                />
              ) : (
                <input
                  value={fields[key] ?? ""}
                  onChange={(e) => changeField(key, e.target.value)}
                  className={inputClasses}
                />
              )}
            </FormField>
          ))}
        </div>
      </div>
    );
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!certResident) return;
    if (!(await confirmAction({ title: "File this certificate?", confirmText: "Yes, file" }))) return;
    setSaving(true);

    const body = {
      resident_id: certResident.id,
      service_request_id: selectedRequestId ? Number(selectedRequestId) : undefined,
      certificate_type: certType,
      /* Not sent where the paper has no purpose — nothing to print it on. */
      purpose: spec?.asks_purpose === false ? undefined : purpose,
      template_fields: fields,
      fee_amount: exempt ? 0 : Number(fee),
      is_exempt: exempt,
      exemption_reason: exempt ? exemptReason : undefined,
    };

    try {
      /*
       * Through the queue when there is no line.
       *
       * The clerk has a resident in front of them and cannot be told to
       * come back when the internet does. The job is written to the device
       * first and sent when there is somewhere to send it — and the message
       * says which of the two happened, because "filed" and "waiting to be
       * filed" are different promises and the clerk is about to repeat one
       * of them out loud.
       */
      if (isOffline()) {
        /*
         * The number is decided HERE, from this office's own series, so it
         * can be on the paper the resident takes away. Sent with the job, so
         * the register ends up carrying the same number the paper does.
         */
        const number = await mintLocalNumber();

        if (!number) {
          /*
           * Refused rather than filed without one. A device that has never
           * been told its series cannot number a certificate safely, and a
           * certificate that goes out unnumbered is not one the barangay
           * can stand behind.
           */
          toast(
            "This device has not received its certificate number series yet. "
            + "Connect once, then try again.",
            "error",
          );

          return;
        }

        await enqueue(
          "post",
          "/certificates",
          {
            ...body,
            certificate_number: number,
            /* On the paper under "Verification Ref.", so it is made now too. */
            reference_number: mintReference(),
            /* Where a counter-filed certificate starts; moved on below as the
               clerk prints and hands it over. */
            offline_status: "Processing",
          },
          `${certType} — ${personName(certResident)} (${number})`,
        );

        setCreateOpen(false);
        toast(
          "Saved on this device. It will be sent when the connection returns — "
          + "see Pending sync.",
          "info",
        );
        load();

        return;
      }

      await serviceApi.createCertificate(body);
      setCreateOpen(false);
      toast("Certificate filed — it is now being processed. Print it when you are ready.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return {
    createOpen, setCreateOpen, certResident, setCertResident, residentRequests,
    setResidentRequests, selectedRequestId, setSelectedRequestId, certType, setCertType,
    fields, setFields, purpose, setPurpose, fee, setFee, exempt, setExempt, exemptReason,
    setExemptReason, saving, setSaving, feeFor, resetCreateForm, closeCreate, openCreate,
    pickResident, chooseRequest, changeType, changePurpose, changeField, spec, beforePurpose,
    afterPurpose, fieldBox, create,
  };
}

export type CertificateFilingState = ReturnType<typeof useCertificateFiling>;
