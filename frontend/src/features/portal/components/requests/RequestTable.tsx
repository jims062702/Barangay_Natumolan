import { useState } from "react";
import { FiEye, FiRotateCcw, FiXCircle } from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import DataTable from "../../../../shared/ui/DataTable";
import Modal from "../../../../shared/ui/Modal";
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

  const [viewingRequest, setViewingRequest] = useState<ServiceRequest | null>(null);
  const [cancellingRequest, setCancellingRequest] = useState<ServiceRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  /* How many of the rows on this page were asked for together, by code. */
  const together = rows.reduce<Record<string, number>>((count, r) => {
    if (r.transaction_code) count[r.transaction_code] = (count[r.transaction_code] ?? 0) + 1;

    return count;
  }, {});

  return (
    <>
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
              header: "Actions",
              /*
               * View details, Cancel, and take it back again.
               */
              render: (r: ServiceRequest) => {
                const waiting = busyId === r.id;

                return (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewingRequest(r)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray bg-white px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      <FiEye className="h-3.5 w-3.5" aria-hidden="true" />
                      View
                    </button>

                    {r.status === "Cancelled" ? (
                      <button
                        type="button"
                        onClick={() => void resumeRequest(r)}
                        disabled={waiting}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray bg-white px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary disabled:opacity-60"
                      >
                        <FiRotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        {waiting ? "Resuming…" : "Resume"}
                      </button>
                    ) : canCancel(r) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCancellingRequest(r);
                          setCancelReason("");
                        }}
                        disabled={waiting}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:border-danger hover:text-danger disabled:opacity-60"
                      >
                        <FiXCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        {waiting ? "Cancelling…" : "Cancel"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">In Progress</span>
                    )}
                  </div>
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

      {/* Read-only View Details Modal for Residents */}
      <Modal
        open={!!viewingRequest}
        onClose={() => setViewingRequest(null)}
        title="Certificate Request Details"
        wide
      >
        {viewingRequest && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-dark">
                  {viewingRequest.certificate?.certificate_type ?? viewingRequest.service_type}
                </p>
                <p className="text-sm text-gray-500">
                  Request #{viewingRequest.request_number}
                  {viewingRequest.certificate?.certificate_number && (
                    <> · Certificate #{viewingRequest.certificate.certificate_number}</>
                  )}
                </p>
              </div>
              <StatusBadge status={viewingRequest.certificate?.status ?? viewingRequest.status} />
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray/70 px-3.5 py-2.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Reference Number</dt>
                <dd className="mt-0.5 text-sm font-semibold font-mono text-primary">
                  {viewingRequest.certificate?.reference_number ?? "—"}
                </dd>
              </div>
              <div className="rounded-xl border border-gray/70 px-3.5 py-2.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Date Filed</dt>
                <dd className="mt-0.5 text-sm font-medium text-dark">
                  {viewingRequest.created_at
                    ? new Date(viewingRequest.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
                    : "—"}
                </dd>
              </div>
              <div className="rounded-xl border border-gray/70 px-3.5 py-2.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Amount</dt>
                <dd className="mt-0.5 text-sm font-semibold text-dark">
                  {viewingRequest.certificate
                    ? peso(Number(viewingRequest.certificate.fee_amount ?? 0) + Number(viewingRequest.certificate.documentary_stamp ?? 0))
                    : "—"}
                </dd>
              </div>
              <div className="rounded-xl border border-gray/70 px-3.5 py-2.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Released Date</dt>
                <dd className="mt-0.5 text-sm font-medium text-dark">
                  {viewingRequest.certificate?.released_at
                    ? new Date(viewingRequest.certificate.released_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
                    : "Not yet released"}
                </dd>
              </div>
              {viewingRequest.purpose && (
                <div className="rounded-xl border border-gray/70 px-3.5 py-2.5 sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Purpose</dt>
                  <dd className="mt-0.5 text-sm font-medium text-dark">{viewingRequest.purpose}</dd>
                </div>
              )}
            </dl>

            {(viewingRequest.certificate?.status === "Cancelled" || viewingRequest.status === "Cancelled") && (
              <div className="rounded-xl bg-danger/10 p-3.5 text-sm text-dark">
                <span className="font-semibold text-danger">Cancellation Reason:</span>{" "}
                <span>
                  {viewingRequest.certificate?.cancel_reason ||
                    viewingRequest.certificate?.reason_for_cancellation ||
                    "Reason not specified"}
                </span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingRequest(null)}
                className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white hover:bg-primary-dark"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancellation Confirmation Modal with required Reason */}
      <Modal
        open={!!cancellingRequest}
        onClose={() => setCancellingRequest(null)}
        title="Cancel Certificate?"
      >
        {cancellingRequest && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to cancel the request for{" "}
              <strong className="text-dark">
                {cancellingRequest.certificate?.certificate_type ?? cancellingRequest.service_type}
              </strong>{" "}
              ({cancellingRequest.request_number})?
            </p>

            <div>
              <label className="block text-xs font-semibold text-dark mb-1">
                Reason for cancellation <span className="text-danger">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="State the reason why you are cancelling this request…"
                rows={3}
                className="w-full rounded-xl border border-gray px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {!cancelReason.trim() && (
                <p className="mt-1 text-xs text-danger">Please enter a reason before cancelling.</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancellingRequest(null)}
                className="rounded-full border border-gray px-4 py-2 text-xs font-semibold text-dark hover:border-gray-400"
              >
                Keep Certificate
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim() || busyId === cancellingRequest.id}
                onClick={async () => {
                  if (!cancellingRequest || !cancelReason.trim()) return;
                  await cancelRequest(cancellingRequest, cancelReason.trim());
                  setCancellingRequest(null);
                }}
                className="rounded-full bg-danger px-4 py-2 text-xs font-semibold text-white hover:bg-danger/90 disabled:opacity-50"
              >
                {busyId === cancellingRequest.id ? "Cancelling…" : "Cancel Certificate"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
