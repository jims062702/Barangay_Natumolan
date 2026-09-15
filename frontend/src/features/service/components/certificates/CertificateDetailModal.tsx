import Modal from "../../../../shared/ui/Modal";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import ChoiceWithOther, { isListed } from "../../../../shared/ui/ChoiceWithOther";
import { personName } from "../../../../shared/lib/names";
import FileField from "../../../../shared/ui/FileField";
import { FLOW, STAGE_HELP } from "../../lib/certificateFlow";
import type { CertificateDeskState } from "../../hooks/useCertificateDesk";

/**
 * One certificate: where it is, what it says, and the next press.
 */
export function CertificateDetailModal({ ctx }: { ctx: CertificateDeskState }) {
  const {
    detail, setDetail, setEditingDetail, editingDetail, detailType, setDetailType, catalogue,
    asksPurpose, detailPurpose, setDetailPurpose, saveDetailEdit, openDetailEdit, photoFile,
    setPhotoFile, attachPhoto, photoUpload, actionsFor,
  } = ctx;

  return (
    <Modal open={!!detail} onClose={() => { setDetail(null); setEditingDetail(false); }} title="Certificate Details" wide>
      {detail && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-dark">{detail.certificate_type}</p>
              <p className="text-sm text-gray-500">
                {detail.certificate_number} · Ref{" "}
                <span className="font-mono">{detail.reference_number}</span>
              </p>
            </div>
            <StatusBadge status={detail.status} />
          </div>

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
              ["Resident", detail.resident ? personName(detail.resident) : "—"],
              /*
                How to tell them it is ready. Read live from the register:
                a number copied onto the certificate at filing time is the
                number they had then, not the one they have now.
              */
              ["Purok", detail.resident?.zone_purok || "Not recorded"],
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
              ["Reprints", String(detail.reprint_count ?? 0)],
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
                      {/* The shared field, so this upload names the file it
                          took and reports how far it has got — like every
                          other upload in the system. */}
                      <FileField
                        file={photoFile}
                        onPick={(file) => {
                          setPhotoFile(file);
                          if (file) void attachPhoto(detail, file);
                        }}
                        progress={photoUpload.progress}
                        done={photoUpload.done}
                      />
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
