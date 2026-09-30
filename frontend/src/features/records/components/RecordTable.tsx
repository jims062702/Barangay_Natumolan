import { FiEdit2, FiCheck, FiTrash2, FiRotateCcw, FiArchive } from "react-icons/fi";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import RowAction, { RowActions } from "../../../shared/ui/RowAction";
import { asDate, DOCUMENT_TYPES } from "../lib/recordForm";
import type { RecordArchiveState } from "../hooks/useRecordArchive";
import type { AdministrativeRecord } from "../types";

/**
 * The archive, by type and date.
 */
export function RecordTable({ ctx }: { ctx: RecordArchiveState }) {
  const {
    showArchived, setPage, setShowArchived, setViewing, openEdit, isPunongBarangay, approve,
    remove, toggleArchive, rows, total, loading, page, lastPage,
  } = ctx;

  return (
    <Card>
      <label className="mb-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-dark">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => {
            setPage(1);
            setShowArchived(e.target.checked);
          }}
          className="h-4 w-4 cursor-pointer accent-primary"
        />
        Show the archive instead of current documents
      </label>

      <DataTable
        columns={[
          { header: "Number", render: (r: AdministrativeRecord) => r.document_number },
          { header: "Type", render: (r: AdministrativeRecord) => r.document_type },
          {
            header: "Title",
            render: (r: AdministrativeRecord) => (
              <button
                type="button"
                onClick={() => setViewing(r)}
                className="cursor-pointer text-left font-medium text-primary hover:underline"
              >
                {r.document_title}
              </button>
            ),
          },
          { header: "Date", render: (r: AdministrativeRecord) => asDate(r.document_date) },
          {
            header: "Status",
            render: (r: AdministrativeRecord) =>
              r.approved_at ? (
                <span className="inline-block whitespace-nowrap rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                  Approved
                </span>
              ) : (
                <span className="inline-block whitespace-nowrap rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
                  For approval
                </span>
              ),
          },
          {
            header: "Actions",
            render: (r: AdministrativeRecord) => (
              <RowActions>
                {!r.approved_at && (
                  <RowAction label="Edit record" icon={FiEdit2} onClick={() => openEdit(r)} />
                )}
                {!r.approved_at && isPunongBarangay && (
                  <RowAction
                    label="Approve record"
                    icon={FiCheck}
                    tone="primary"
                    onClick={() => approve(r)}
                  />
                )}
                {/* Adopted documents are archived, never deleted. */}
                {!r.approved_at && (
                  <RowAction
                    label="Delete record"
                    icon={FiTrash2}
                    tone="danger"
                    onClick={() => remove(r)}
                  />
                )}
                <RowAction
                  label={r.is_archived ? "Restore record" : "Archive record"}
                  icon={r.is_archived ? FiRotateCcw : FiArchive}
                  onClick={() => toggleArchive(r)}
                />
              </RowActions>
            ),
          },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
        numbered
        total={total}
        searchable
        searchPlaceholder="Search by Document Number, Title, Type or Summary…"
        getSearchText={(r) =>
          `${r.document_number} ${r.document_title} ${r.document_type} ${r.summary ?? ""}`
        }
        filters={[{ label: "Type", getValue: (r) => r.document_type, options: DOCUMENT_TYPES }]}
        loading={loading}
        page={page}
        lastPage={lastPage}
        onPageChange={setPage}
        emptyMessage={showArchived ? "The archive is empty." : "No documents filed yet."}
      />
    </Card>
  );
}
