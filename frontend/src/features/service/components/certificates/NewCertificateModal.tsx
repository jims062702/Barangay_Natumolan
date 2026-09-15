import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import ChoiceWithOther from "../../../../shared/ui/ChoiceWithOther";
import ResidentPicker from "../../../resident/components/ResidentPicker";
import type { CertificateDeskState } from "../../hooks/useCertificateDesk";

/**
 * Filing a certificate at the counter.
 */
export function NewCertificateModal({ ctx }: { ctx: CertificateDeskState }) {
  const {
    createOpen, closeCreate, create, certResident, pickResident, residentRequests,
    selectedRequestId, setSelectedRequestId, chooseRequest, certType, changeType, catalogue,
    spec, fee, setFee, exempt, fieldBox, beforePurpose, purpose, changePurpose, afterPurpose,
    setExempt, feeFor, fields, exemptReason, setExemptReason, saving,
  } = ctx;

  return (
    <Modal open={createOpen} onClose={closeCreate} title="New Certificate" size="xl">
      <form onSubmit={create} className="space-y-4">
        <FormField label="Resident" required  plain>
          {/* Constituents only: a barangay certificate says something
              about somebody who lives here, and the server refuses
              a non-resident anyway. */}
          <ResidentPicker value={certResident} onChange={pickResident} residentsOnly />
        </FormField>

        {certResident && (
          <div className="rounded-xl border border-gray bg-secondary p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Start from an existing request
            </p>
            {residentRequests.length === 0 ? (
              <p className="text-sm text-gray-500">
                No <strong>pending</strong> requests — this will be recorded as a{" "}
                <strong>walk-in</strong>. Choose the certificate type below.
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

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Certificate type" required hint="Auto-filled from the request; change if needed">
            <select value={certType} onChange={(e) => changeType(e.target.value)} className={inputClasses}>
              {(catalogue?.types ?? []).map((type) => (
                <option key={type.name}>{type.name}</option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Fee (₱)"
            hint={
              spec?.fee === null
                ? "Set by the ordinance from the answer below, not by the type"
                : "Set by the ordinance of 18 January 2020"
            }
          >
            <input
              type="number"
              min="0"
              step="0.01"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              disabled={exempt}
              className={inputClasses}
            />
            {/*
              The whole amount, before the clerk quotes it. The stamp is
              added by the server and not typed here — it is the barangay's
              fixed charge, not something to vary per resident.
            */}
            {(catalogue?.documentary_stamp ?? 0) > 0 && (
              <p className="mt-1.5 text-xs text-gray-500">
                + ₱{Number(catalogue?.documentary_stamp).toFixed(2)} documentary stamp ={" "}
                <b className="text-dark">
                  ₱{(Number(fee || 0) + Number(catalogue?.documentary_stamp ?? 0)).toFixed(2)} total
                </b>
              </p>
            )}
          </FormField>
        </div>

        {fieldBox(beforePurpose, "What this form asks for")}

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
              value={purpose}
              onChange={changePurpose}
              placeholder="Choose what the clearance is for…"
              otherPlaceholder="Type the purpose — e.g. Scholarship application"
              otherPrice={catalogue?.other_certification_fee}
              required
            />
          ) : (
            <input
              value={purpose}
              onChange={(e) => changePurpose(e.target.value)}
              required
              className={inputClasses}
              placeholder="e.g. Employment requirement"
            />
          )}
        </FormField>
        )}

        {fieldBox(afterPurpose, "Filled in by the office")}

        {spec?.needs_photo && (
          <p className="text-xs leading-relaxed text-gray-500">
            This clearance prints a photo box and two thumbmark boxes. Attach the
            photograph on the certificate&rsquo;s own page; the thumbmarks are inked onto
            the printed sheet at the counter.
          </p>
        )}

        <FormField label="Fee exemption">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-dark">
            <input
              type="checkbox"
              checked={exempt}
              onChange={(e) => {
                setExempt(e.target.checked);
                if (e.target.checked) setFee("0");
                else setFee(String(feeFor(certType, purpose, fields)));
              }}
              className="h-4 w-4 accent-primary"
            />
            Exempt from fees (indigent, first-time jobseeker, etc.)
          </label>
        </FormField>
        {exempt && (
          <FormField label="Exemption reason" required>
            <input
              value={exemptReason}
              onChange={(e) => setExemptReason(e.target.value)}
              required
              className={inputClasses}
              placeholder="e.g. Indigent, First-time jobseeker (RA 11261)"
            />
          </FormField>
        )}

        <button
          type="submit"
          disabled={!certResident || saving}
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? "Filing…" : "File certificate"}
        </button>
      </form>
    </Modal>
  );
}
