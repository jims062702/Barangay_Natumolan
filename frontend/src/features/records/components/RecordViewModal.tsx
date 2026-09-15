import Modal from "../../../shared/ui/Modal";
import { asDate } from "../lib/recordForm";
import type { RecordArchiveState } from "../hooks/useRecordArchive";

/**
 * One record, read.
 */
export function RecordViewModal({ ctx }: { ctx: RecordArchiveState }) {
  const { viewing, setViewing } = ctx;

  return (
    <Modal
      open={viewing !== null}
      onClose={() => setViewing(null)}
      wide
      title={viewing?.document_number ?? "Document"}
    >
      {viewing && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-dark">{viewing.document_title}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {viewing.document_type} · {asDate(viewing.document_date)}
              {viewing.file_reference && ` · File ${viewing.file_reference}`}
            </p>
          </div>
          <dl className="grid gap-3 rounded-xl bg-secondary px-4 py-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Filed by</dt>
              <dd className="text-dark">{viewing.creator?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Approved</dt>
              <dd className="text-dark">
                {viewing.approved_at
                  ? `${viewing.approver?.name ?? "—"} · ${asDate(viewing.approved_at)}`
                  : "Awaiting the Punong Barangay"}
              </dd>
            </div>
          </dl>
          {viewing.summary && (
            <p className="rounded-xl border border-gray px-4 py-3 text-sm text-gray-500">
              {viewing.summary}
            </p>
          )}
          <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-gray px-4 py-3 text-sm leading-relaxed text-dark">
            {viewing.document_content}
          </div>
        </div>
      )}
    </Modal>
  );
}
