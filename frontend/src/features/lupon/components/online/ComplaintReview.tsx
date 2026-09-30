import { useState } from "react";
import { FiCheck, FiX, FiPaperclip } from "react-icons/fi";
import { Link } from "react-router-dom";
import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import ResidentMultiPicker from "../../../resident/components/ResidentMultiPicker";
import { confirmAction } from "../../../../shared/lib/confirm";
import { useModalDraft } from "../../../../shared/lib/useModalDraft";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import type { Resident } from "../../../../shared/types";
import { CLASSIFICATIONS } from "../../lib/docket";
import type { OnlineComplaint } from "../../types";
import { ValidIdViewer } from "./ValidIdViewer";

const KB = 1024;

function readableSize(bytes: number) {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < KB * KB) return `${(bytes / KB).toFixed(0)} KB`;

  return `${(bytes / (KB * KB)).toFixed(1)} MB`;
}

/**
 * One submission, read at the counter, with the complainant in front of it.
 *
 * THIS IS WHERE A REFERENCE NUMBER BECOMES A CASE NUMBER, and the shape of
 * the panel follows the order the officer actually works in: read the
 * complaint, look at the ID against the face, then either accept it into the
 * docket or say why not.
 *
 * Two things are asked for on acceptance that the website could not ask:
 *
 *   the CLASSIFICATION  which the docket needs and a complainant cannot be
 *                       expected to choose. "Assault" or "Debt" is a legal
 *                       reading of what they described.
 *   the RESPONDENTS     as register records. The website has only a typed
 *                       name, and a summons has to reach a real address.
 *
 * Nothing here is optional theatre: a case with no classification cannot be
 * reported on, and a case with no linked respondent cannot be summoned.
 */
export function ComplaintReview({
  complaint,
  onClose,
  onAccept,
  onReject,
  busy,
}: {
  complaint: OnlineComplaint | null;
  onClose: () => void;
  onAccept: (body: Record<string, unknown>) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  busy: boolean;
}) {
  /* "" until the officer chooses — the complainant's own choice stands in for it. */
  const [classification, setClassification] = useState("");
  const [respondents, setRespondents] = useState<Resident[]>([]);
  const [notes, setNotes] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const resetReview = () => {
    setRejecting(false);
    setReason("");
    setRespondents([]);
    setNotes("");
    setClassification("");
  };

  /* The officer's reading of this submission, kept until it is accepted or
     turned down — the complainant may step away from the counter. */
  const blankReview = {
    classification: "", respondents: [] as Resident[], notes: "",
    rejecting: false, reason: "",
  };
  const draft = useModalDraft(
    complaint ? `review-online-complaint:${complaint.id}` : null,
    complaint !== null,
    { classification, respondents, notes, rejecting, reason },
    (kept) => {
      const k = { ...blankReview, ...kept };
      setClassification(k.classification);
      setRespondents(k.respondents ?? []);
      setNotes(k.notes);
      setRejecting(Boolean(k.rejecting));
      setReason(k.reason);
    },
    { blank: blankReview, reset: resetReview },
  );

  if (!complaint) return null;

  const open = complaint.status === "For Office Verification";
  /* Nature of the Case: the officer's choice, or the complainant's until then. */
  const nature = classification || complaint.case_classification || "";


  const close = () => {
    resetReview();
    onClose();
  };

  const accept = async () => {
    if (
      !(await confirmAction({
        title: `Accept ${complaint.reference_no} into the docket?`,
        text: "A KP case number is issued and the case starts at Filed. The filing fee is confirmed on the case itself.",
        confirmText: "Yes, accept it",
      }))
    ) {
      return;
    }

    try {
      await onAccept({
        case_classification: nature,
        respondent_ids: respondents.map((r) => r.id),
        notes: notes || undefined,
      });
    } catch {
      /* Said by the page. The form, and its draft, stay for another try. */
      return;
    }
    draft.clear();
    close();
  };

  const reject = async () => {
    try {
      await onReject(reason);
    } catch {
      return;
    }
    draft.clear();
    close();
  };

  return (
    <Modal open onClose={close} title={`${complaint.reference_no} — ${complaint.filer_kind}`} size="xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={complaint.status} />
          <span className="text-xs text-gray-500">
            Sent {new Date(complaint.created_at).toLocaleString("en-PH")}
          </span>
          {complaint.lupon_case && (
            <Link
              to={`/lupon/cases/${complaint.lupon_case.id}`}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Case {complaint.lupon_case.case_number} →
            </Link>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Complainant
            </p>
            <p className="mt-1 text-sm font-semibold text-dark">{complaint.complainant_name}</p>
            <p className="text-xs text-gray-500">{complaint.complainant_address}</p>
            <p className="text-xs text-gray-500">{complaint.complainant_contact}</p>

            {complaint.resident ? (
              <p className="mt-2 inline-flex rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                On the barangay register
              </p>
            ) : (
              <p className="mt-2 inline-flex rounded-full bg-gray px-2.5 py-1 text-xs font-semibold text-gray-500">
                Not a resident — filed here because the respondent lives here
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-gray p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Complained about
            </p>
            <p className="mt-1 text-sm font-semibold text-dark">{complaint.respondent_name}</p>
            <p className="text-xs text-gray-500">{complaint.respondent_address || "No address given"}</p>
            <dl className="mt-3 space-y-1 text-xs text-gray-500">
              <div className="flex gap-2">
                <dt className="font-medium text-gray-400">When</dt>
                <dd>{complaint.date_of_occurrence ?? "Not stated"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-gray-400">Where</dt>
                <dd>{complaint.place_of_occurrence ?? "Not stated"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-gray-400">Relationship</dt>
                <dd>{complaint.relationship_nature ?? "Not stated"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-gray-400">Nature of the Case</dt>
                <dd>{complaint.lupon_case?.case_classification ?? complaint.case_classification ?? "Not given"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="rounded-2xl border border-gray p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            What they said happened
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-dark">
            {complaint.narrative}
          </p>
        </div>

        <ValidIdViewer
          complaintId={complaint.id}
          idType={complaint.valid_id_type}
          idNumber={complaint.valid_id_number}
        />

        {complaint.files && complaint.files.length > 0 && (
          <div className="rounded-2xl border border-gray p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Attached ({complaint.files.length})
            </p>
            <ul className="mt-2 space-y-1">
              {complaint.files.map((file) => (
                <li key={file.id} className="flex items-center gap-2 text-xs text-dark">
                  <FiPaperclip className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{file.original_name}</span>
                  <span className="shrink-0 text-gray-500">{readableSize(file.size_bytes)}</span>
                </li>
              ))}
            </ul>
            {/*
              Listed, not opened. The office reads the evidence with the
              complainant standing there, from the phone it was sent from if
              need be; a second copy opened on a shared screen buys nothing.
            */}
            <p className="mt-2 text-xs text-gray-400">
              Go through these with the complainant at the counter.
            </p>
          </div>
        )}

        {complaint.office_notes && (
          <div className="rounded-2xl border border-gray bg-secondary/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Note from the office
            </p>
            <p className="mt-1 text-sm text-dark">{complaint.office_notes}</p>
          </div>
        )}

        {open && !rejecting && (
          <div className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <h3 className="text-sm font-bold text-dark">Accept it into the docket</h3>

              <>
                {/* One field, as at the counter (File Complaint): the case is named by its nature. */}
                <FormField
                  label="Nature of the Case"
                  required
                  hint={complaint.case_classification
                    ? `The complainant chose ${complaint.case_classification}. Keep it, or change it to your reading.`
                    : "Your reading of what they described. The docket and every report use it."}
                >
                  <select
                    value={nature}
                    onChange={(e) => setClassification(e.target.value)}
                    className={inputClasses}
                    aria-label="Nature of the Case"
                  >
                    <option value="" disabled>Choose…</option>
                    {CLASSIFICATIONS.map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                  </select>
                </FormField>

                {/*
                  The website had only a typed name. A summons has to reach a
                  real address, so the respondent is attached to their register
                  record here — with the complainant left out of the list, since
                  nobody is both sides of one dispute.
                */}
                <FormField
                  label="The respondent, on the register"
                  required
                  plain
                  hint="Required. Search the register for the person named above and choose them — a summons cannot be served on a name alone, and the case docket lists who was chosen here."
                >
                  <ResidentMultiPicker
                    value={respondents}
                    onChange={setRespondents}
                    residentsOnly
                    excludeIds={complaint.resident ? [complaint.resident.id] : []}
                    placeholder={`Search for "${complaint.respondent_name}"…`}
                  />
                </FormField>

                <FormField label="Note" hint="Optional. Kept on the submission, not on the case.">
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={inputClasses}
                    maxLength={500}
                  />
                </FormField>
              </>

            <DraftNotice draft={draft} />

            {(!nature || respondents.length === 0) && (
              <p className="text-right text-xs text-gray-500" data-testid="accept-needs">
                To accept: choose {!nature ? "the Nature of the Case" : ""}
                {!nature && respondents.length === 0 ? " and " : ""}
                {respondents.length === 0 ? "the respondent from the register" : ""}.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejecting(true)}
                disabled={busy}
                className="cursor-pointer rounded-full border border-gray bg-white px-4 py-2 text-xs font-semibold text-gray-500 transition-colors hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
              >
                Not accepted
              </button>
              <button
                type="button"
                onClick={accept}
                disabled={busy || !nature || respondents.length === 0}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {busy ? "Working…" : "Accept — issue the case number"}
              </button>
            </div>
          </div>
        )}

        {open && rejecting && (
          <div className="space-y-4 rounded-2xl border border-danger/30 bg-danger/5 p-4">
            <h3 className="text-sm font-bold text-danger">Not accepted</h3>

            {/*
              A reason is required, and the complainant is told it. Somebody who
              filed a complaint and hears nothing assumes the office lost it.
            */}
            <FormField
              label="Why is it not being accepted?"
              required
              hint="The complainant is shown this. Write it as you would say it to them."
            >
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={inputClasses}
                rows={3}
                maxLength={500}
              />
            </FormField>

            <DraftNotice draft={draft} />

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejecting(false)}
                disabled={busy}
                className="cursor-pointer rounded-full border border-gray bg-white px-4 py-2 text-xs font-semibold text-dark transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                Back
              </button>
              <button
                type="button"
                onClick={reject}
                disabled={busy || reason.trim().length === 0}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-danger px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiX className="h-3.5 w-3.5" aria-hidden="true" />
                {busy ? "Working…" : "Record as not accepted"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
