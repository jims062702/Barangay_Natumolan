import { useState, type FormEvent } from "react";
import FormField from "../../../shared/ui/FormField";
import { TemplateFieldInput } from "../components/certificates/TemplateFieldInput";
import { confirmAction } from "../../../shared/lib/confirm";
import { isOffline } from "../../../shared/offline/connectivity";
import { toast } from "../../../shared/lib/toast";
import { enqueue } from "../../../shared/offline/writeQueue";
import { personName } from "../../../shared/lib/names";
import { errorMessage } from "../../../shared/lib/api";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import type { Resident, ServiceRequest } from "../../../shared/types";
import { fromRegister, toCertType, AFTER_PURPOSE, FIELD_LABELS, FIELD_HINTS } from "../lib/certificateFields";
import { serviceApi } from "../api";
import { mintLocalNumber, mintReference } from "../lib/certificateNumbers";
import { feeFor as priceOf, MAX_IN_TRANSACTION, newTransactionCode } from "../lib/certificateFees";
import type { CertificateRowsState } from "./useCertificateRows";

/**
 * One certificate on the form: its type, its answers and its fee. A visit can
 * ask for several — a clearance and an indigency — and they are filed
 * together in one press, so the resident is not sent back to the end of the
 * line for the second.
 */
export interface FilingItem {
  key: string;
  certType: string;
  /* The answers this particular form asks for beyond the register. */
  fields: Record<string, string>;
  purpose: string;
  /** The fee, as the ordinance sets it (or the clerk corrects it). */
  fee: string;
  exempt: boolean;
  exemptReason: string;
}

const DEFAULT_TYPE = "Barangay Clearance";
let nextKey = 1;
const newKey = () => `c${nextKey++}`;

/**
 * Filing new certificates: who they are for, which types, their answers and
 * their fees.
 */
export function useCertificateFiling(ctx: CertificateRowsState) {
  const {
    catalogue, council, load,
  } = ctx;

  const [createOpen, setCreateOpen] = useState(false);
  /*
   * Always somebody on the Population Office's register. A person not
   * listed yet is registered there first; there is no filing for them
   * from typed details.
   */
  const [certResident, setCertResident] = useState<Resident | null>(null);
  const [residentRequests, setResidentRequests] = useState<ServiceRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [items, setItems] = useState<FilingItem[]>([]);
  const [saving, setSaving] = useState(false);
  /** What this type charges, given the answer that decides it. */
  const feeFor = (type: string, purposeText: string, answers: Record<string, string>) =>
    priceOf(catalogue, type, purposeText, answers);
  const newItem = (resident: Resident | null, type = DEFAULT_TYPE): FilingItem => ({
    key: newKey(),
    certType: type,
    fields: fromRegister(resident),
    purpose: "",
    /* Blank until the fee schedule is on the device: blank means "the
       ordinance's fee", which the server fills in — never a silent ₱0. */
    fee: catalogue ? String(feeFor(type, "", {})) : "",
    exempt: false,
    exemptReason: "",
  });
  const resetCreateForm = () => {
    setCertResident(null);
    setResidentRequests([]);
    setSelectedRequestId("");
    setItems([newItem(null)]);
  };

  /*
   * The certificates being filed, kept until they are filed or discarded — a
   * click outside the dialog does not cost the clerk the answers. The
   * resident's pending requests are read again when it comes back.
   */
  const createDraft = useModalDraft<{ certResident: Resident | null; selectedRequestId: string; items: FilingItem[] }>(
    "new-certificate",
    createOpen,
    { certResident, selectedRequestId, items },
    (kept) => {
      setCertResident(kept.certResident ?? null);
      setSelectedRequestId(kept.selectedRequestId ?? "");
      /* A draft kept before a visit could hold several: one certificate, at
         the top level. It becomes the first item. */
      const legacy = kept as unknown as Partial<FilingItem> & { fee?: string };
      const restored = Array.isArray(kept.items) && kept.items.length > 0
        ? kept.items
        : legacy.certType
          ? [{
              key: newKey(), certType: legacy.certType, fields: legacy.fields ?? {}, purpose: legacy.purpose ?? "",
              fee: legacy.fee ?? "", exempt: Boolean(legacy.exempt), exemptReason: legacy.exemptReason ?? "",
            }]
          : [newItem(kept.certResident ?? null)];
      /* Only the fields a certificate has — a draft kept before copies were
         taken off the form may still carry them. */
      setItems(restored.map((item) => ({
        key: item.key || newKey(), certType: item.certType, fields: item.fields ?? {}, purpose: item.purpose ?? "",
        fee: item.fee ?? "", exempt: Boolean(item.exempt), exemptReason: item.exemptReason ?? "",
      })));
      if (kept.certResident) {
        serviceApi.serviceRequests({ params: { resident_id: kept.certResident.id } })
          .then((r) => setResidentRequests((r.data.data.data ?? []).filter((x: ServiceRequest) => x.status === "Pending")))
          .catch(() => setResidentRequests([]));
      }
    },
    {
      /* Nothing chosen and nothing typed — the fee fills itself in. */
      isEmpty: (v) => !v.certResident && !v.selectedRequestId && v.items.length <= 1
        && v.items.every((i) => i.certType === DEFAULT_TYPE && !i.purpose && !i.exempt
          && Object.values(i.fields ?? {}).every((x) => !x)),
      reset: resetCreateForm,
    },
  );
  const closeCreate = () => {
    setCreateOpen(false);
    resetCreateForm();
  };
  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  /* ---------------------------------------------------------------- items */

  const patchItem = (key: string, patch: (item: FilingItem) => Partial<FilingItem>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch(item) } : item)));

  const changeType = (key: string, type: string) =>
    patchItem(key, (item) => ({
      certType: type,
      /* Answers belong to the form that asked them; keeping them across a
         type change carried a date of death onto a residency certificate.
         What the REGISTER knows survives, because it was never the previous
         form's answer — it is a fact about the person. */
      fields: fromRegister(certResident),
      fee: item.exempt ? "0" : String(feeFor(type, item.purpose, {})),
    }));
  /*
   * The purpose moves the price, not only the type. A clearance for a
   * Mayor's Permit is ₱200 and one for local employment is ₱30, so the
   * amount has to follow the dropdown as it changes.
   */
  const changePurpose = (key: string, value: string) =>
    patchItem(key, (item) => ({
      purpose: value,
      ...(item.exempt ? {} : { fee: String(feeFor(item.certType, value, item.fields)) }),
    }));
  const changeField = (key: string, field: string, value: string) =>
    patchItem(key, (item) => {
      const next = { ...item.fields, [field]: value };

      return { fields: next, ...(item.exempt ? {} : { fee: String(feeFor(item.certType, item.purpose, next)) }) };
    });
  const changeFee = (key: string, value: string) => patchItem(key, () => ({ fee: value }));
  const changeExempt = (key: string, on: boolean) =>
    patchItem(key, (item) => ({
      exempt: on,
      fee: on ? "0" : String(feeFor(item.certType, item.purpose, item.fields)),
    }));
  const changeExemptReason = (key: string, value: string) => patchItem(key, () => ({ exemptReason: value }));

  const addItem = () =>
    setItems((list) => (list.length >= MAX_IN_TRANSACTION ? list : [...list, newItem(certResident)]));
  const removeItem = (key: string) =>
    setItems((list) => (list.length <= 1 ? list : list.filter((item) => item.key !== key)));

  /* What each costs, and the visit altogether: the fee and the stamp. */
  const stamp = catalogue?.documentary_stamp ?? 0;
  const feeOf = (item: FilingItem) =>
    item.exempt ? 0 : item.fee === "" ? feeFor(item.certType, item.purpose, item.fields) : Number(item.fee);
  const itemTotal = (item: FilingItem) => feeOf(item) + stamp;
  const grandTotal = items.reduce((sum, item) => sum + itemTotal(item), 0);

  // When a resident is picked, load their PENDING requests so a certificate
  // can be started from one (type auto-fills). In-Progress requests are
  // excluded — their certificate was already filed automatically when the
  // clerk pressed "Start processing". Empty = walk-in.
  const pickResident = async (resident: Resident | null) => {
    setCertResident(resident);
    setSelectedRequestId("");
    setResidentRequests([]);
    /* Their record answers part of every form the moment they are chosen. */
    setItems((list) => list.map((item) => ({ ...item, fields: { ...fromRegister(resident) } })));
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
  /*
   * Choosing an existing request files THAT request's certificate: one
   * certificate, its type, purpose and fee auto-filled. Walk-in again, and
   * more can be added.
   */
  const chooseRequest = (requestId: string) => {
    setSelectedRequestId(requestId);
    const request = residentRequests.find((r) => String(r.id) === requestId);
    if (request) {
      const type = toCertType(
        request.service_type,
        (catalogue?.types ?? []).map((t) => t.name),
      );
      const item = newItem(certResident, type);

      setItems([{
        ...item,
        purpose: request.purpose ?? "",
        fee: String(feeFor(type, request.purpose ?? "", {})),
      }]);
    }
  };
  const fromRequest = selectedRequestId !== "";

  const specOf = (type: string) => catalogue?.types.find((t) => t.name === type);
  /* A form's questions, split where the purpose prints. */
  const beforePurpose = (type: string) => (specOf(type)?.fields ?? []).filter((key) => !AFTER_PURPOSE.has(key));
  const afterPurpose = (type: string) => (specOf(type)?.fields ?? []).filter((key) => AFTER_PURPOSE.has(key));
  /*
   * One box of questions, in the order the sheet prints them. Nothing shows
   * for a certificate that asks nothing.
   */
  const fieldBox = (item: FilingItem, keys: string[], heading: string) =>
    keys.length > 0 && (
      <div className="rounded-2xl border border-gray bg-secondary/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {heading}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {keys.map((key) => (
            <FormField key={key} label={FIELD_LABELS[key] ?? key} hint={FIELD_HINTS[key]}>
              {/* The same box the certificate's record asks it in. */}
              <TemplateFieldInput
                name={key}
                value={item.fields[key] ?? ""}
                onChange={(value) => changeField(item.key, key, value)}
                catalogue={catalogue}
                council={council}
              />
            </FormField>
          ))}
        </div>
      </div>
    );

  /** The body one certificate is filed with. */
  const bodyFor = (item: FilingItem) => ({
    certificate_type: item.certType,
    /* Not sent where the paper has no purpose — nothing to print it on. */
    purpose: specOf(item.certType)?.asks_purpose === false ? undefined : item.purpose,
    template_fields: item.fields,
    /* Left to the ordinance when the box is empty. */
    fee_amount: item.exempt ? 0 : item.fee === "" ? undefined : Number(item.fee),
    is_exempt: item.exempt,
    exemption_reason: item.exempt ? item.exemptReason : undefined,
  });
  const describe = (item: FilingItem) => item.certType;

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!certResident || items.length === 0) return;

    if (certResident.life_status === "Deceased") {
      toast("The selected requester is recorded as deceased and cannot file a certificate.", "error");
      return;
    }

    for (const item of items) {
      if (item.certType === "Certification of Death") {
        if (!item.fields.deceased_resident_id) {
          toast("Please search and select the deceased resident.", "error");
          return;
        }
        if (Number(item.fields.deceased_resident_id) === certResident.id) {
          toast("The deceased resident cannot be the same person as the requester.", "error");
          return;
        }
        if (!item.fields.relationship_to_deceased?.trim()) {
          toast("Please enter the relationship to the deceased.", "error");
          return;
        }
        if (!item.fields.deceased_age?.trim()) {
          toast("Please enter the age of the deceased.", "error");
          return;
        }
        if (!item.fields.deceased_address?.trim()) {
          toast("Please enter the address of the deceased.", "error");
          return;
        }
        if (!item.fields.date_of_death?.trim()) {
          toast("Please enter the date of death.", "error");
          return;
        }
        if (!item.fields.time_of_death?.trim()) {
          toast("Please enter the time of death.", "error");
          return;
        }
        if (!item.fields.place_of_death?.trim()) {
          toast("Please enter the place of death.", "error");
          return;
        }
      }
    }

    const count = items.length;
    if (!(await confirmAction({
      title: count === 1 ? "File this certificate?" : `File these ${count} certificates?`,
      text: `${items.map(describe).join(", ")} — total ₱${grandTotal.toFixed(2)}`,
      confirmText: "Yes, file",
    }))) return;
    setSaving(true);

    const holder = personName(certResident);

    try {
      /*
       * Through the queue when there is no line.
       *
       * The clerk has a resident in front of them and cannot be told to
       * come back when the internet does. Each certificate is written to the
       * device first and sent when there is somewhere to send it — and the
       * message says which of the two happened, because "filed" and
       * "waiting to be filed" are different promises and the clerk is about
       * to repeat one of them out loud.
       */
      if (isOffline()) {
        /*
         * Every number is decided HERE, from this office's own series, so it
         * can be on the paper the resident takes away — all of them before
         * any is queued, so a device that cannot number files none rather
         * than half the visit.
         */
        const numbers: string[] = [];
        for (let i = 0; i < count; i++) {
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
          numbers.push(number);
        }

        /* The visit's code is made here too — random, so no device repeats it. */
        const transactionCode = count > 1 ? newTransactionCode() : undefined;

        for (let i = 0; i < count; i++) {
          await enqueue(
            "post",
            "/certificates",
            {
              resident_id: certResident.id,
              service_request_id: fromRequest ? Number(selectedRequestId) : undefined,
              ...bodyFor(items[i]),
              transaction_code: transactionCode,
              certificate_number: numbers[i],
              /* On the paper under "Verification Ref.", so it is made now too. */
              reference_number: mintReference(),
              /* Where a counter-filed certificate starts; moved on below as the
                 clerk prints and hands it over. */
              offline_status: "Processing",
            },
            `${describe(items[i])} — ${holder} (${numbers[i]})`,
          );
        }

        createDraft.clear();
        setCreateOpen(false);
        toast(
          (count === 1 ? "Saved on this device." : `${count} certificates saved on this device.`)
          + " They will be sent when the connection returns — see Pending sync.",
          "info",
        );
        load();

        return;
      }

      if (fromRequest) {
        /* That request's own certificate — one, tied to it. */
        await serviceApi.createCertificate({
          resident_id: certResident.id,
          service_request_id: Number(selectedRequestId),
          ...bodyFor(items[0]),
        });
      } else {
        /*
         * The whole visit in one press, all or nothing: a certificate the
         * server refuses leaves none of the others filed, so pressing again
         * never files the first ones twice.
         */
        await serviceApi.createCertificates({
          resident_id: certResident.id,
          items: items.map(bodyFor),
        });
      }
      createDraft.clear();
      setCreateOpen(false);
      toast(
        count === 1
          ? "Certificate filed — it is now being processed. Print it when you are ready."
          : `${count} certificates filed — total ₱${grandTotal.toFixed(2)}. Print each when you are ready.`,
      );
      load();
    } catch (err) {
      /* Nothing was filed; the form and its draft stay for another try. */
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return {
    createOpen, setCreateOpen, certResident, setCertResident, residentRequests,
    setResidentRequests, selectedRequestId, setSelectedRequestId, items, setItems, saving, setSaving,
    feeFor, resetCreateForm, closeCreate, openCreate, pickResident, chooseRequest, fromRequest,
    changeType, changePurpose, changeField, changeFee, changeExempt, changeExemptReason,
    addItem, removeItem, feeOf, itemTotal, grandTotal, stamp, specOf, beforePurpose, afterPurpose, fieldBox,
    create, createDraft,
  };
}

export type CertificateFilingState = ReturnType<typeof useCertificateFiling>;
