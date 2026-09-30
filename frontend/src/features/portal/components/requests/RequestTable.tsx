import { FiRotateCcw, FiXCircle } from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import DataTable from "../../../../shared/ui/DataTable";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import type { ServiceRequest } from "../../../../shared/types";
import { peso } from "../../lib/money";
import type { PortalRequestsState } from "../../hooks/usePortalRequests";

/**
 * The resident's requests, and where each one is.
 */
export function RequestTable({ ctx }: { ctx: PortalRequestsState }) {
  const {
    busyId, resumeRequest, canCancel, cancelRequest, rows, loading, page, lastPage, setPage,
    total,
  } = ctx;

  /* How many of the rows on this page were asked for together, by code. */
  const together = rows.reduce<Record<string, number>>((count, r) => {
    if (r.transaction_code) count[r.transaction_code] = (count[r.transaction_code] ?? 0) + 1;

    return count;
  }, {});

  return (
    <Card>
      <DataTable
        columns={[
          {
            header: "Certificate / Request Number",
            /*
             * The certificate number when there is one, because that is
             * what the clerk at the counter will ask for. The request
             * number stays underneath: it is what the resident quoted
             * before the document existed.
             */
            render: (r: ServiceRequest) => (
              <span className="block">
                <span className="font-medium text-dark">
                  {r.certificate?.certificate_number ?? r.request_number}
                </span>
                {r.certificate?.certificate_number && (
                  <span className="mt-0.5 block text-[11px] text-gray-400">
                    {r.request_number}
                  </span>
                )}
              </span>
            ),
          },
          {
            header: "Service",
            render: (r: ServiceRequest) => (
              <span className="block">
                <span>{r.certificate?.certificate_type ?? r.service_type}</span>
                {/* Asked for in one request with others — collected together. */}
                {r.transaction_code && (together[r.transaction_code] ?? 0) > 1 && (
                  <span className="mt-0.5 inline-block whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                    Requested together ({together[r.transaction_code]})
                  </span>
                )}
              </span>
            ),
          },
          {
            header: "Filed",
            render: (r: ServiceRequest) =>
              r.created_at ? new Date(r.created_at).toLocaleDateString("en-PH") : "—",
          },
          {
            header: "Amount",
            render: (r: ServiceRequest) =>
              r.certificate ? (
                <span className="tabular-nums">
                  {peso(Number(r.certificate.fee_amount ?? 0) + Number(r.certificate.documentary_stamp ?? 0))}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              ),
          },
          {
            header: "Status",
            /*
             * The document's own status wins. It is the record that knows
             * whether the paper has been printed, and it is what the clerk
             * is looking at — two screens that disagree about one document
             * is worse than either of them alone.
             */
            render: (r: ServiceRequest) => (
              <StatusBadge status={r.certificate?.status ?? r.status} />
            ),
          },
          {
            header: "Reference Number",
            render: (r: ServiceRequest) =>
              r.certificate?.reference_number ? (
                <span className="font-mono text-xs text-primary">
                  {r.certificate.reference_number}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              ),
          },
          {
            header: "",
            /*
             * Cancel, and take it back again. No delete anywhere: the
             * request carries a number from the counter's own series and
             * its certificate carries another, so the row has to stay.
             * A resident who asked by accident needs it stopped, not
             * erased.
             */
            render: (r: ServiceRequest) => {
              const waiting = busyId === r.id;

              if (r.status === "Cancelled") {
                return (
                  <button
                    type="button"
                    onClick={() => void resumeRequest(r)}
                    disabled={waiting}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray bg-white px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary disabled:opacity-60"
                  >
                    <FiRotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    {waiting ? "Resuming…" : "Resume"}
                  </button>
                );
              }

              if (!canCancel(r)) {
                /* Not a disabled button: a control that can never be
                   pressed is a puzzle. The reason is the useful thing. */
                return (
                  <span className="text-xs text-gray-400">Already being worked on</span>
                );
              }

              return (
                <button
                  type="button"
                  onClick={() => void cancelRequest(r)}
                  disabled={waiting}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:border-danger hover:text-danger disabled:opacity-60"
                >
                  <FiXCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  {waiting ? "Cancelling…" : "Cancel"}
                </button>
              );
            },
          },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage="You have not asked for anything yet."
        page={page}
        lastPage={lastPage}
        onPageChange={setPage}
        total={total}
        perPage={15}
        numbered
      />
    </Card>
  );
}
