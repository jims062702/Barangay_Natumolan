import { useState } from "react";
import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";
import { ageFrom } from "../../../../shared/lib/birthdate";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import ChoiceWithOther, { isListed } from "../../../../shared/ui/ChoiceWithOther";
import { holderName, holderOf, isUnlisted } from "../../lib/holder";
import { FLOW, STAGE_HELP } from "../../lib/certificateFlow";
import type { CertificateDeskState } from "../../hooks/useCertificateDesk";
import { CounterCamera } from "./CounterCamera";
import { PrintDetails } from "./PrintDetails";

/**
 * One certificate: where it is, what it says, and the next press.
 */
export function CertificateDetailModal({ ctx }: { ctx: CertificateDeskState }) {
  /*
   * Open the camera again over a photo already taken.
   *
   * The photo on file is shown in the box beside this; the camera replaces
   * it only when the clerk asks, so a stream is not left running on every
   * certificate that already has one.
   */
  const [retaking, setRetaking] = useState(false);

  const {
    detail, setDetail, setEditingDetail, editingDetail, detailType, setDetailType, catalogue,
    asksPurpose, detailPurpose, setDetailPurpose, saveDetailEdit, openDetailEdit,
    attachPhoto, photoUpload, actionsFor, detailDraft, siblings, openDetail,
  } = ctx;

  return (
    <Modal open={!!detail} onClose={() => { setDetail(null); setEditingDetail(false); }} title="Certificate Details" wide>
      {detail && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-dark">{detail.certificate_type}</p>
              <p className="text-sm text-gray-500">
                {detail.certificate_number} · Reference Number{" "}
                <span className="font-mono">{detail.reference_number}</span>
              </p>
            </div>
            <StatusBadge status={detail.status} />
          </div>

          {detail.resident && ageFrom(detail.resident.birthdate) !== null && ageFrom(detail.resident.birthdate)! < 18 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-warning/50 bg-warning/10 p-3.5 text-xs text-dark">
              <FiAlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-warning-dark">
                  Minor Resident Alert (Age: {ageFrom(detail.resident.birthdate)}) — Parent/Guardian Required
                </p>
                <p className="mt-0.5 text-gray-700 leading-relaxed">
                  This resident is 17 years old or below ({ageFrom(detail.resident.birthdate)} years old). As a minor, they must be accompanied by a parent or legal guardian to receive this certificate at the counter. Please verify the guardian's presence and identification before releasing.
                </p>
              </div>
            </div>
          )}

          {/*
            The rest of the visit. Each is its own certificate with its own
            number and its own press of Print — but the resident is one
            person waiting at one counter, so they are listed together.
          */}
          {siblings.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Also in this transaction ({detail.service_request?.transaction_code})
              </p>
              <ul className="space-y-1.5">
                {siblings.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium text-dark">{s.certificate_type}</span>
                      <span className="text-xs text-gray-500">
                        {" "}· {s.certificate_number}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={s.status} />
                      <button
                        type="button"
                        onClick={() => void openDetail(s)}
                        className="cursor-pointer text-xs font-semibold text-primary hover:underline"
                      >
                        Open
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Where the document has got to */}
          {detail.status !== "Cancelled" && (
            <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-secondary p-3 text-xs">
              {FLOW.map((stage, index) => {
                const current = FLOW.indexOf(detail.status);
                const done = current >= 0 && index <= current;
                return (
                  <div key={stage} className="flex items-center">
                    <span className={`rounded-full px-3 py-1 font-semibold ${done ? "bg-primary text-white" : "bg-white text-gray-400"}`}>
                      {index + 1}. {stage}
                    </span>
                    {index < FLOW.length - 1 && <span className="mx-1 text-gray-300">→</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Type and purpose stay correctable until the document is
              printed — after that the paper and the record must agree. */}
          {editingDetail ? (
            <div className="grid gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:grid-cols-2">
              <FormField label="Certificate type" required>
                <select
                  value={detailType}
                  onChange={(e) => setDetailType(e.target.value)}
                  className={inputClasses}
                >
                  {(catalogue?.types ?? []).map((t) => (
                    <option key={t.name}>{t.name}</option>
                  ))}
                </select>
              </FormField>
              {asksPurpose(detailType) && (
              <FormField
                label="Purpose"
                required
                hint={
                  catalogue?.types.find((t) => t.name === detailType)?.fee_from === "clearance"
                  && !isListed(catalogue?.clearance_purposes, detailPurpose)
                  && detailPurpose.trim()
                    ? "Not on the ordinance's list. Pick the matching purpose if one fits — it sets the fee."
                    : undefined
                }
              >
                {/*
                  The same list, with the same way out, as when filing.

                  This is where a resident's online request gets looked at: a
                  purpose they wrote themselves opens as "Others" with their
                  words in the box, so the clerk can see what was meant and
                  choose the proper listed purpose — which reprices it.
                */}
                {catalogue?.types.find((t) => t.name === detailType)?.fee_from === "clearance" ? (
                  <ChoiceWithOther
                    options={catalogue?.clearance_purposes ?? {}}
                    value={detailPurpose}
                    onChange={setDetailPurpose}
                    placeholder="Choose what the clearance is for…"
                    otherPlaceholder="Type the purpose"
                    otherPrice={catalogue?.other_certification_fee}
                  />
                ) : (
                  <input
                    value={detailPurpose}
                    onChange={(e) => setDetailPurpose(e.target.value)}
                    className={inputClasses}
                  />
                )}
              </FormField>
              )}
              <div className="sm:col-span-2">
                <DraftNotice draft={detailDraft} />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={saveDetailEdit}
                  disabled={asksPurpose(detailType) && !detailPurpose.trim()}
                  className="flex-1 cursor-pointer rounded-full bg-primary py-2 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  Save corrections
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDetail(false)}
                  className="flex-1 cursor-pointer rounded-full border border-gray py-2 text-xs font-semibold text-dark hover:border-primary hover:text-primary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            ["Pending", "Processing"].includes(detail.status) && (
              <button
                type="button"
                onClick={() => openDetailEdit(detail)}
                className="w-full cursor-pointer rounded-full border border-primary/40 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
              >
                {asksPurpose(detail.certificate_type) ? "Correct type or purpose" : "Correct type"}
              </button>
            )
          )}

          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ["Resident", holderName(detail) + (isUnlisted(detail) ? " (not yet on the register)" : "")],
              /*
                How to tell them it is ready. Read live from the register:
                a number copied onto the certificate at filing time is the
                number they had then, not the one they have now.
              */
              ["Purok", holderOf(detail)?.zone_purok || "Not recorded"],
              ["Contact", detail.resident?.contact_number || "No number on file"],
              [
                "Purpose",
                /*
                 * Marked when it is not one of the ordinance's purposes — a
                 * resident's own words from an online request, or an "Others"
                 * typed at the counter. The clerk needs to see it, because a
                 * listed purpose may fit and would set a different fee.
                 */
                catalogue?.types.find((t) => t.name === detail.certificate_type)?.fee_from === "clearance"
                  && detail.purpose
                  && !isListed(catalogue?.clearance_purposes, detail.purpose)
                  ? `${detail.purpose} — Others, not on the ordinance list (review)`
                  : detail.purpose ?? "—",
              ],
              [
                "Amount",
                [
                  detail.is_exempt
                    ? `Fee exempt${detail.exemption_reason ? ` (${detail.exemption_reason})` : ""}`
                    : `₱${Number(detail.fee_amount).toFixed(2)} fee`,
                  Number(detail.documentary_stamp ?? 0) > 0
                    ? `₱${Number(detail.documentary_stamp).toFixed(2)} documentary stamp`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" + ")
                  + ` = ₱${(Number(detail.fee_amount) + Number(detail.documentary_stamp ?? 0)).toFixed(2)}`,
              ],
              ["Requested", detail.created_at ? new Date(detail.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—"],
              ["Started by", detail.processor?.name ? `${detail.processor.name}${detail.processed_at ? ` · ${new Date(detail.processed_at).toLocaleDateString("en-PH")}` : ""}` : "Not started yet"],
              ["Printed", detail.printed_at ? new Date(detail.printed_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "Not yet printed"],
              ["Released", detail.released_at ? new Date(detail.released_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "Not yet released"],
            ]
              /* No purpose row for a form that prints none. */
              .filter(([label]) => label !== "Purpose" || asksPurpose(detail.certificate_type))
              .map(([label, value]) => (
              <div key={label} className="rounded-xl border border-gray/70 px-3.5 py-2.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-dark">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Specialized Verification Card for Certification of Death */}
          {detail.certificate_type === "Certification of Death" && (
            <div className="rounded-2xl border border-primary/30 bg-primary/[0.03] p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-dark">Certification of Death — Verification Review</h3>
                  <p className="text-xs text-gray-500">
                    Review deceased identity, death claim, and relationship before confirming official records.
                  </p>
                </div>
                {detail.template_fields?.death_confirmed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
                    ✓ Death Confirmed in Population Register
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/20 px-3 py-1 text-xs font-semibold text-warning-dark">
                    ⚠ Pending Death Confirmation
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-xl border border-gray/70 bg-white px-3.5 py-2.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Requested by</dt>
                  <dd className="mt-0.5 font-semibold text-dark">
                    {detail.template_fields?.requested_by || holderName(detail)}
                  </dd>
                </div>
                <div className="rounded-xl border border-gray/70 bg-white px-3.5 py-2.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Requester Source</dt>
                  <dd className="mt-0.5 font-semibold text-dark">
                    {detail.template_fields?.requester_source === "portal_account"
                      ? "Resident Portal Account"
                      : detail.template_fields?.requester_source === "resident_id_card"
                      ? "Uploaded Barangay Resident ID"
                      : "Walk-in (Counter)"}
                  </dd>
                </div>
                <div className="rounded-xl border border-gray/70 bg-white px-3.5 py-2.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Relationship to Deceased</dt>
                  <dd className="mt-0.5 font-semibold text-dark">
                    {detail.template_fields?.relationship_to_deceased || "—"}
                  </dd>
                </div>
                <div className="rounded-xl border border-gray/70 bg-white px-3.5 py-2.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Name of Deceased</dt>
                  <dd className="mt-0.5 font-semibold text-dark">
                    {detail.template_fields?.deceased_name || "—"}
                  </dd>
                </div>
                <div className="rounded-xl border border-gray/70 bg-white px-3.5 py-2.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Age of Deceased</dt>
                  <dd className="mt-0.5 font-semibold text-dark">
                    {detail.template_fields?.deceased_age ? `${detail.template_fields.deceased_age} years old` : "—"}
                  </dd>
                </div>
                <div className="rounded-xl border border-gray/70 bg-white px-3.5 py-2.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Address of Deceased</dt>
                  <dd className="mt-0.5 font-semibold text-dark">
                    {detail.template_fields?.deceased_address || "—"}
                  </dd>
                </div>
                <div className="rounded-xl border border-gray/70 bg-white px-3.5 py-2.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Date of Death</dt>
                  <dd className="mt-0.5 font-semibold text-dark">
                    {detail.template_fields?.date_of_death || "—"}
                  </dd>
                </div>
                <div className="rounded-xl border border-gray/70 bg-white px-3.5 py-2.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Time of Death</dt>
                  <dd className="mt-0.5 font-semibold text-dark">
                    {detail.template_fields?.time_of_death || "—"}
                  </dd>
                </div>
                <div className="rounded-xl border border-gray/70 bg-white px-3.5 py-2.5 sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Place of Death</dt>
                  <dd className="mt-0.5 font-semibold text-dark">
                    {detail.template_fields?.place_of_death || "—"}
                  </dd>
                </div>
              </div>

              {detail.template_fields?.requester_source === "resident_id_card" && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary-dark">
                  <span className="font-semibold">Resident ID Verification:</span>
                  <span>Requester verified identity with Barangay Resident ID.</span>
                </div>
              )}
            </div>
          )}

          {/* Until it prints: after that, the paper and the record must agree. */}
          {["Pending", "Processing"].includes(detail.status) && !editingDetail && (
            <PrintDetails key={detail.id} detail={detail} ctx={ctx} />
          )}

          {catalogue?.types.find((t) => t.name === detail.certificate_type)?.needs_photo && (
            <div className="rounded-xl border border-gray/70 px-4 py-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                Counter photograph
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-[120px] w-[104px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray bg-secondary">
                  {detail.photo_url ? (
                    <img src={detail.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="px-2 text-center text-[11px] leading-tight text-gray-400">
                      No photo yet
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {detail.printed_at ? (
                    <p className="text-xs leading-relaxed text-gray-500">
                      Already printed, so the photograph is locked — the paper the resident
                      holds and this record have to agree.
                    </p>
                  ) : (
                    <>
                      {/*
                        TAKEN HERE, NOT UPLOADED.

                        A clearance with a picture is proof that the person
                        named on it stood at this counter. A file picker
                        accepts a photograph from any year, of anybody — so
                        the clearance would prove nothing. The resident is in
                        front of the clerk when this is issued, so the camera
                        takes it.
                      */}
                      {detail.photo_url && !retaking ? (
                        <button
                          type="button"
                          onClick={() => setRetaking(true)}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray px-4 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-primary hover:text-primary"
                        >
                          <FiRefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          Take it again
                        </button>
                      ) : (
                        <CounterCamera
                          /* null means nothing is in flight. */
                          busy={photoUpload.progress !== null && !photoUpload.done}
                          onCapture={(photo) => {
                            setRetaking(false);
                            void attachPhoto(detail, photo);
                          }}
                        />
                      )}
                      <p className="mt-2 text-xs leading-relaxed text-gray-500">
                        It prints in the box beside the thumbmarks. The thumbmarks themselves
                        are inked onto the printed sheet here at the counter.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {(detail.requirements_checklist?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-gray/70 px-4 py-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                Documentary requirements presented
              </p>
              <ul className="space-y-1.5 text-sm">
                {detail.requirements_checklist?.map((entry) => (
                  <li key={entry.item} className="flex items-center gap-2">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                        entry.presented ? "bg-success" : "bg-danger"
                      }`}
                      aria-hidden="true"
                    >
                      {entry.presented ? "✓" : "✕"}
                    </span>
                    <span className={entry.presented ? "text-dark" : "text-danger"}>
                      {entry.item}
                      {!entry.presented && " — not presented"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {STAGE_HELP[detail.status] && (
            <p
              className={`rounded-xl px-4 py-3 text-sm text-dark ${
                detail.status === "Ready to Claim" || detail.status === "Released"
                  ? "bg-success/10"
                  : detail.status === "Pending"
                    ? "bg-warning/10"
                    : "bg-primary/10"
              }`}
            >
              {STAGE_HELP[detail.status]}
            </p>
          )}

          {detail.status === "Cancelled" && (
            <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-dark">
              This request was cancelled
              {detail.cancel_reason ? <> — reason: <strong>{detail.cancel_reason}</strong></> : "."}{" "}
              The resident was notified.
            </p>
          )}

          <div className="flex flex-wrap gap-2">{actionsFor(detail, "lg")}</div>
        </div>
      )}
    </Modal>
  );
}
