import { FiUsers, FiEdit2, FiCheckCircle } from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import DataTable from "../../../../shared/ui/DataTable";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import { asDate, asTime } from "../../lib/sessions";
import type { SessionRecordsState } from "../../hooks/useSessionRecords";
import type { Session } from "../../types";

/**
 * The sessions on record, and whether each has been adopted.
 */
export function SessionTable({ ctx }: { ctx: SessionRecordsState }) {
  const { startEdit, canAdopt, adopt, rows, loading, page, lastPage, total, setPage } = ctx;

  return (
    <Card>
      <DataTable
        columns={[
          {
            header: "Session",
            render: (s: Session) => (
              <div>
                <p className="font-mono font-semibold text-primary">{s.session_number}</p>
                <p className="text-xs text-gray-500">{s.session_type}</p>
              </div>
            ),
          },
          { header: "Date", render: (s: Session) => asDate(s.session_date) },
          {
            header: "Ran",
            render: (s: Session) =>
              s.called_to_order_at
                ? `${asTime(s.called_to_order_at)}${s.adjourned_at ? ` – ${asTime(s.adjourned_at)}` : ""}`
                : "—",
          },
          {
            header: "Attendance",
            render: (s: Session) =>
              s.attendees_count ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-dark">
                  <FiUsers className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  {/* Present or late — somebody who was in the room. */}
                  <span className="font-semibold">{s.present_count ?? 0}</span>
                  <span className="text-gray-400">of {s.attendees_count}</span>
                </span>
              ) : (
                <span className="text-sm text-gray-400">Not taken</span>
              ),
          },
          { header: "Status", render: (s: Session) => <StatusBadge status={s.status} /> },
          {
            header: "",
            render: (s: Session) => (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(s)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray px-3 py-1.5 text-xs font-semibold text-dark transition hover:border-primary/50"
                >
                  <FiEdit2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {s.status === "Adopted" ? "Read" : "Edit"}
                </button>

                {/* Only the council adopts, and only once. */}
                {canAdopt && s.status !== "Adopted" && (
                  <button
                    type="button"
                    onClick={() => adopt(s)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-dark"
                  >
                    <FiCheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> Accept / Adopt
                  </button>
                )}
              </div>
            ),
          },
        ]}
        rows={rows}
        rowKey={(s) => s.id}
        loading={loading}
        page={page}
        lastPage={lastPage}
        total={total}
        onPageChange={setPage}
        numbered
        emptyMessage="No sessions recorded yet."
      />
    </Card>
  );
}
