import { FiEye } from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import DataTable from "../../../../shared/ui/DataTable";
import { personName } from "../../../../shared/lib/names";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import RowAction, { RowActions } from "../../../../shared/ui/RowAction";
import type { Certificate } from "../../../../shared/types";
import { STATUS_TABS } from "../../lib/certificateFlow";
import type { CertificateDeskState } from "../../hooks/useCertificateDesk";

/**
 * The counter list, by stage, with each row's next press.
 */
export function CertificateTable({ ctx }: { ctx: CertificateDeskState }) {
  const {
    setStatusFilter, setPage, statusFilter, counts, openDetail, actionsFor, rows, total,
    loading, page, lastPage,
  } = ctx;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((status) => (
          <button
            key={status || "all"}
            type="button"
            onClick={() => {
              setStatusFilter(status);
              setPage(1);
            }}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === status ? "bg-primary text-white" : "bg-secondary text-dark hover:bg-primary/10"
            }`}
          >
            {status || "All"}
            {status && counts[status] ? (
              <span className="ml-1.5 opacity-70">{counts[status]}</span>
            ) : null}
          </button>
        ))}
      </div>

      <DataTable
        columns={[
          {
            header: "Certificate #",
            render: (c: Certificate) => (
              <button
                type="button"
                onClick={() => openDetail(c)}
                className="cursor-pointer text-left hover:underline"
                title="View certificate details"
              >
                <span className="block font-medium text-primary">{c.certificate_number}</span>
                <span className="block font-mono text-[11px] text-gray-400">{c.reference_number}</span>
              </button>
            ),
          },
          {
            header: "Resident",
            /*
              The name, and how to reach them.

              A certificate sits Ready to Claim until somebody collects it,
              and the resident only learns it is ready if they open their
              portal. Plenty never do. The purok and the number are already
              on the register — showing them here is the difference between
              a clerk who can send a text and one who waits.

              Read from the register rather than copied onto the
              certificate, so a resident who moves is reachable at the
              address they moved to.
            */
            render: (c: Certificate) => (
              <div className="min-w-0">
                <p className="font-medium text-dark">
                  {c.resident ? personName(c.resident) : "—"}
                </p>
                {(c.resident?.zone_purok || c.resident?.contact_number) && (
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {[c.resident.zone_purok, c.resident.contact_number]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            ),
          },
          { header: "Type", render: (c: Certificate) => c.certificate_type },
          {
            /*
              How it was asked for, on the list rather than a modal away.

              It decides what the clerk does with a finished certificate:
              somebody who walked in is expecting a call, and somebody who
              asked online may never open their portal to learn it is
              ready. Buried in the detail, that had to be checked one row
              at a time.
            */
            header: "Channel",
            render: (c: Certificate) =>
              c.service_request?.request_type ? (
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    c.service_request.request_type === "Online"
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-gray-600"
                  }`}
                >
                  {c.service_request.request_type}
                </span>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              ),
          },
          {
            header: "Amount",
            render: (c: Certificate) => {
              const stamp = Number(c.documentary_stamp ?? 0);
              const fee = Number(c.fee_amount);

              /* An exemption removes the fee, not the stamp — unless there is
                 no stamp either, as on certificates issued before it. */
              if (c.is_exempt && stamp === 0) {
                return <span className="text-xs font-semibold text-success">Exempt</span>;
              }

              return (
                <span className="block">
                  <span className="font-medium text-dark">₱{(fee + stamp).toFixed(2)}</span>
                  {/* Said, so a clerk quoting the total can say what is in it. */}
                  {stamp > 0 && (
                    <span className="block text-[10px] text-gray-400">
                      ₱{fee.toFixed(2)} + ₱{stamp.toFixed(2)} stamp
                    </span>
                  )}
                </span>
              );
            },
          },
          {
            header: "Status",
            render: (c: Certificate) => (
              <span className="inline-flex flex-col items-start gap-1">
                <StatusBadge status={c.status} />
                {/*
                  Beside the status, not instead of it. The status says where
                  the certificate is in its workflow — printed, handed over —
                  and that is true whether or not the server has it yet.
                  This says the second thing.
                */}
                {((c as unknown as { _jobId?: string })._jobId
                  || (c as unknown as { _pendingSync?: boolean })._pendingSync) && (
                  <span className="rounded-full bg-dark/5 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                    Not yet synced
                  </span>
                )}
              </span>
            ),
          },
          {
            header: "Actions",
            render: (c: Certificate) => (
              <RowActions>
                <RowAction label="View certificate" icon={FiEye} onClick={() => openDetail(c)} />
                {actionsFor(c, "sm")}
              </RowActions>
            ),
          },
        ]}
        rows={rows}
        rowKey={(c) => c.id}
        numbered
        total={total}
        searchable
        searchPlaceholder="Search by name, certificate #, or reference…"
        /*
          The purok and the number are searchable too, so a clerk ringing
          round the ones ready to claim can pull up a whole purok at once
          rather than opening them one at a time.
        */
        getSearchText={(c) =>
          [
            c.certificate_number,
            c.reference_number,
            c.resident ? personName(c.resident) : "",
            c.certificate_type,
            c.resident?.zone_purok ?? "",
            c.resident?.contact_number ?? "",
            c.service_request?.request_type ?? "",
          ].join(" ")
        }
        filters={[{ label: "Type", getValue: (c) => c.certificate_type }]}
        loading={loading}
        page={page}
        lastPage={lastPage}
        onPageChange={setPage}
      />
    </Card>
  );
}
