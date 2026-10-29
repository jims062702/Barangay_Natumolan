import { FiAlertTriangle, FiPlus, FiTrash2 } from "react-icons/fi";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import ChoiceWithOther from "../../../../shared/ui/ChoiceWithOther";
import ResidentPicker from "../../../resident/components/ResidentPicker";
import { DeathCertificateWalkinFields } from "./DeathCertificateWalkinFields";
import type { CertificateDeskState } from "../../hooks/useCertificateDesk";
import type { FilingItem } from "../../hooks/useCertificateFiling";
import { MAX_IN_TRANSACTION } from "../../lib/certificateFees";
import { ageFrom } from "../../../../shared/lib/birthdate";

/**
 * Filing certificates at the counter — as many as the resident needs, in
 * one visit.
 *
 * Each certificate is its own document with its own number; they are
 * written up together and filed in one press, so a resident who needs a
 * clearance AND an indigency certificate is served once instead of going
 * back to the end of the line.
 */
export function NewCertificateModal({ ctx }: { ctx: CertificateDeskState }) {
  const {
    createOpen, closeCreate, create, certResident, pickResident, residentRequests,
    selectedRequestId, setSelectedRequestId, chooseRequest, fromRequest, items, catalogue,
    saving, createDraft, addItem, grandTotal,
  } = ctx;

  const hasDeathCert = items.some((i) => i.certType === "Certification of Death");
  const isRequesterDeceased = certResident && certResident.life_status === "Deceased";
  const certResidentAge = ageFrom(certResident?.birthdate);
  const isResidentMinor = certResidentAge !== null && certResidentAge < 18;

  return (
    <Modal open={createOpen} onClose={closeCreate} title="New Certificate" size="xl">
      <form onSubmit={create} className="space-y-4">
        <FormField
          label={hasDeathCert ? "Requested by (Requester)" : "Resident"}
          hint={hasDeathCert ? "The person filing the request on behalf of the deceased" : undefined}
          required
          plain
        >
          {/* Constituents on the register only: a barangay certificate says
              something about somebody who lives here, and the server
              refuses anybody else. Somebody not listed yet is registered
              by the Population Office first. */}
          <ResidentPicker
            value={certResident}
            onChange={pickResident}
            residentsOnly
            notFound="A certificate is issued only to a resident on the barangay's register. Please coordinate with the Population Office to register the resident first."
          />
        </FormField>

        {isRequesterDeceased && (
          <div className="flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            <FiAlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              <strong>Cannot proceed:</strong> This resident is recorded as <strong>Deceased</strong> and cannot be the requester for a certificate.
            </p>
          </div>
        )}

        {isResidentMinor && (
          <div className="flex items-start gap-2.5 rounded-xl border border-warning/50 bg-warning/10 p-3.5 text-xs text-dark">
            <FiAlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-warning-dark">
                Minor Resident Alert (Age: {certResidentAge}) — Parent/Guardian Required
              </p>
              <p className="mt-0.5 text-gray-700 leading-relaxed">
                This resident is 17 years old or below ({certResidentAge} years old). As a minor, they must be accompanied by a parent or legal guardian to request and claim this certificate at the counter. Please verify the guardian's presence and identification.
              </p>
            </div>
          </div>
        )}

        {certResident && (
          <div className="rounded-xl border border-gray bg-secondary p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Start from an existing request
            </p>
            {residentRequests.length === 0 ? (
              <p className="text-sm text-gray-500">
                No <strong>pending</strong> requests — this will be recorded as a{" "}
                <strong>walk-in</strong>. Choose the certificates below.
                (In-Progress requests are not listed: their certificate was
                already filed automatically.)
              </p>
            ) : (
              <div className="space-y-1.5">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white">
                  <input
                    type="radio"
                    name="req"
                    checked={selectedRequestId === ""}
                    onChange={() => setSelectedRequestId("")}
                    className="accent-primary"
                  />
                  Walk-in (no existing request)
                </label>
                {residentRequests.map((r) => (
                  <label
                    key={r.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white"
                  >
                    <input
                      type="radio"
                      name="req"
                      checked={selectedRequestId === String(r.id)}
                      onChange={() => chooseRequest(String(r.id))}
                      className="accent-primary"
                    />
                    <span>
                      <span className="font-medium text-dark">{r.service_type}</span>{" "}
                      <span className="text-xs text-gray-500">
                        ({r.request_number} · {r.status})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {items.map((item, index) => (
          <CertificateItem key={item.key} ctx={ctx} item={item} index={index} />
        ))}

        {/*
          Another certificate for the same resident, in the same visit.
          Not while filing an existing request: that request is for one.
        */}
        {!fromRequest && items.length < MAX_IN_TRANSACTION && (
          <button
            type="button"
            onClick={addItem}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-primary/50 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" /> Add another certificate
          </button>
        )}

        {/* The whole visit, before the clerk quotes it. */}
        {items.length > 0 && (
          <div className="rounded-xl bg-primary/[0.06] px-4 py-3" data-testid="filing-summary">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {items.length === 1 ? "To pay" : `${items.length} certificates — to pay`}
            </p>
            <ul className="space-y-0.5 text-sm text-dark">
              {items.map((item) => (
                <li key={item.key} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    {item.certType}
                    {item.exempt ? <span className="text-gray-500"> (fee exempt)</span> : null}
                  </span>
                  <span className="tabular-nums">₱{ctx.itemTotal(item).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex justify-between border-t border-primary/20 pt-2 text-sm font-bold text-dark">
              <span>Total</span>
              <span className="tabular-nums" data-testid="filing-total">₱{grandTotal.toFixed(2)}</span>
            </p>
            {(catalogue?.documentary_stamp ?? 0) > 0 && (
              <p className="mt-1 text-[11px] text-gray-500">
                Includes the ₱{Number(catalogue?.documentary_stamp).toFixed(2)} documentary stamp on each certificate.
              </p>
            )}
          </div>
        )}

        <DraftNotice draft={createDraft} />

        <button
          type="submit"
          disabled={!certResident || saving || items.length === 0}
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? "Filing…" : items.length > 1 ? `File ${items.length} certificates` : "File certificate"}
        </button>
      </form>
    </Modal>
  );
}

/** One certificate of the visit: its type, fee, answers and exemption. */
function CertificateItem({ ctx, item, index }: { ctx: CertificateDeskState; item: FilingItem; index: number }) {
  const {
    items, catalogue, changeType, changePurpose, changeFee, changeExempt, changeExemptReason,
    removeItem, specOf, beforePurpose, afterPurpose, fieldBox, feeFor, feeOf, stamp,
  } = ctx;
  const spec = specOf(item.certType);
  const several = items.length > 1;

  return (
    <fieldset className={several ? "space-y-4 rounded-2xl border border-gray p-4" : "space-y-4"} data-testid="certificate-item">
      {several && (
        <legend className="flex items-center gap-3 px-1">
          <span className="text-sm font-semibold text-dark">Certificate {index + 1}</span>
          <button
            type="button"
            onClick={() => removeItem(item.key)}
            aria-label={`Remove certificate ${index + 1}`}
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-gray-400 hover:text-danger"
          >
            <FiTrash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
          </button>
        </legend>
      )}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)]">
        <FormField label="Certificate type" required hint="Auto-filled from the request; change if needed">
          <select value={item.certType} onChange={(e) => changeType(item.key, e.target.value)} className={inputClasses}>
            {(catalogue?.types ?? []).map((type) => (
              <option key={type.name}>{type.name}</option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Fee (₱)"
          hint={
            spec?.fee === null
              ? "Set by the ordinance from the answer below"
              : "Set by the ordinance of 18 January 2020"
          }
        >
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.fee}
            onChange={(e) => changeFee(item.key, e.target.value)}
            disabled={item.exempt}
            className={inputClasses}
          />
        </FormField>
      </div>
      {/*
        The whole amount for this one, before the clerk quotes it. The stamp
        is added by the server and not typed here — it is the barangay's
        fixed charge, not something to vary per resident.
      */}
      {stamp > 0 && (
        <p className="-mt-2 text-xs text-gray-500">
          ₱{feeOf(item).toFixed(2)} + ₱{stamp.toFixed(2)} documentary stamp ={" "}
          <b className="text-dark">₱{ctx.itemTotal(item).toFixed(2)}</b>
        </p>
      )}

      {item.certType === "Certification of Death" ? (
        <DeathCertificateWalkinFields ctx={ctx} item={item} requester={ctx.certResident} />
      ) : (
        fieldBox(item, beforePurpose(item.certType), "What this form asks for")
      )}

      {/*
        A list where the ordinance prices by purpose, a free line where it
        does not. Typed freely, "Mayors permit" is not "Mayor's Permit" and
        the resident was charged ₱30 for a ₱200 document.
      */}
      {spec?.asks_purpose !== false && (
        <FormField label="Purpose" required>
          {spec?.fee_from === "clearance" ? (
            <ChoiceWithOther
              options={catalogue?.clearance_purposes ?? {}}
              value={item.purpose}
              onChange={(value) => changePurpose(item.key, value)}
              placeholder="Choose what the clearance is for…"
              otherPlaceholder="Type the purpose — e.g. Scholarship application"
              otherPrice={catalogue?.other_certification_fee}
              required
            />
          ) : (
            <input
              value={item.purpose}
              onChange={(e) => changePurpose(item.key, e.target.value)}
              required
              className={inputClasses}
              placeholder="e.g. Employment requirement"
            />
          )}
        </FormField>
      )}

      {fieldBox(item, afterPurpose(item.certType), "Filled in by the office")}

      {spec?.needs_photo && (
        <p className="text-xs leading-relaxed text-gray-500">
          This clearance prints a photo box and two thumbmark boxes. The photograph is
          TAKEN AT THE COUNTER on the certificate&rsquo;s own page — the resident is here,
          so it is not uploaded — and the thumbmarks are inked onto the printed sheet.
        </p>
      )}

      <FormField label="Fee exemption">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-dark">
          <input
            type="checkbox"
            checked={item.exempt}
            onChange={(e) => changeExempt(item.key, e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Exempt from fees (indigent, first-time jobseeker, etc.)
        </label>
      </FormField>
      {item.exempt && (
        <FormField label="Exemption reason" required>
          <input
            value={item.exemptReason}
            onChange={(e) => changeExemptReason(item.key, e.target.value)}
            required
            className={inputClasses}
            placeholder="e.g. Indigent, First-time jobseeker (RA 11261)"
          />
        </FormField>
      )}
      {/* The price the ordinance sets, for when the clerk has changed it. */}
      {!item.exempt && item.fee !== "" && Number(item.fee) !== feeFor(item.certType, item.purpose, item.fields) && (
        <p className="text-xs text-warning">
          Not the ordinance fee (₱{feeFor(item.certType, item.purpose, item.fields).toFixed(2)}).
        </p>
      )}
    </fieldset>
  );
}
