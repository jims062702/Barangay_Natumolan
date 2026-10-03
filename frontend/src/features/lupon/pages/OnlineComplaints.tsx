import { useEffect, useRef, useState } from "react";
import { FiEye, FiInfo, FiInbox, FiMail } from "react-icons/fi";
import { Link, useSearchParams } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import PageHeader from "../../../shared/ui/PageHeader";
import RowAction from "../../../shared/ui/RowAction";
import StatTile from "../../../shared/ui/StatTile";
import StatusBadge from "../../../shared/ui/StatusBadge";
import { ComplaintReview } from "../components/online/ComplaintReview";
import { luponApi } from "../api";
import type { OnlineComplaint } from "../types";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

/**
 * Complaints begun on the website or in a resident's portal.
 *
 * A QUEUE, NOT A DOCKET. Nothing on this screen is a case. Every row is
 * somebody who typed out a complaint and was told to come in, and the work
 * the screen exists for is reading it before they do — so that when they
 * arrive the officer already knows what the dispute is and what ID to expect.
 *
 * Accept is the only button here that writes to the docket, and it is pressed
 * at the counter with the complainant in front of it. That is the single
 * moment an Online Complaint Reference Number (OC-2026-0007) turns into a KP
 * case number (2026-09-25-03).
 */
export default function OnlineComplaints() {
  const [rows, setRows] = useState<OnlineComplaint[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();
  const [reviewing, setReviewing] = useState<OnlineComplaint | null>(null);
  const [busy, setBusy] = useState(false);

  /*
   * SEARCH, ON THE SERVER — reference, complainant, respondent, Nature of
   * the Case, case number, status — so it searches every page and the pages
   * that come back are of the matches. A notification opens this page with
   * ?q=<reference>, and that complaint is opened for the officer.
   */
  const [params] = useSearchParams();
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const openFromLink = useRef(params.get("q"));
  const linked = params.get("q");
  /* A second notification pressed while already here: that one, searched and opened. */
  useEffect(() => {
    if (!linked) return;
    openFromLink.current = linked;
    setSearch(linked);
    setPage(1);
  }, [linked]);

  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is reading;
   * a first load or a page change should still say it is working.
   */
  const load = (silent = false) => {
    if (!silent) setLoading(true);
    luponApi
      .onlineComplaints({ params: { page, q: search.trim() || undefined } })
      .then((r) => {
        const found: OnlineComplaint[] = r.data.data.data ?? [];
        setRows(found);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
        /* Opened from a notification: the one it is about, open. */
        if (openFromLink.current) {
          const match = found.find((row) => row.reference_no === openFromLink.current);
          openFromLink.current = null;
          if (match) setReviewing(match);
        }
      })
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(() => load(), search ? 300 : 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  useAutoRefresh(() => load(true), REFRESH.staff);
  usePulse("lupon_cases", () => load(true));

  /* Counted off the page on screen. The list is in reference order, newest
     first — OC-2026-0010 above OC-2026-0009 — searched on the server. */
  const waiting = rows.filter((row) => row.status === "For Office Verification");

  const accept = async (body: Record<string, unknown>) => {
    if (!reviewing) return;
    setBusy(true);
    try {
      const response = await luponApi.acceptOnlineComplaint(reviewing.id, body);
      toast(response.data.message);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const reject = async (reason: string) => {
    if (!reviewing) return;
    setBusy(true);
    try {
      const response = await luponApi.rejectOnlineComplaint(reviewing.id, { reason });
      toast(response.data.message);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => load()} />;

  return (
    <div>
      <PageHeader
        title="Online Complaints"
        subtitle="Complaints begun on the website or in a resident's portal, waiting to be verified at the counter"
      />

      <div className="mb-4 flex gap-3 rounded-2xl border border-gray bg-secondary px-4 py-3">
        <FiInfo className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-gray-500">
          None of these is a case. A reference number —{" "}
          <strong className="text-dark">OC-2026-0001</strong> — is what the website gave the
          complainant; the KP case number is issued here, when{" "}
          <strong className="text-dark">Accept</strong> is pressed with them at the counter and
          their ID checked. Filed cases are in the{" "}
          <Link to="/lupon/cases" className="font-semibold text-primary hover:underline">
            Case Docket
          </Link>
          .
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile label="Waiting to be verified" value={waiting.length} tone="warning" icon={FiInbox} />
        <StatTile label="Submissions on this page" value={rows.length} tone="primary" icon={FiMail} />
      </div>

      <Card>
        <DataTable
          columns={[
            {
              header: "Reference Number",
              render: (row: OnlineComplaint) => (
                <span className="font-semibold tabular-nums text-dark">{row.reference_no}</span>
              ),
            },
            {
              header: "Complainant",
              render: (row: OnlineComplaint) => (
                <div>
                  <p className="font-medium text-dark">{row.complainant_name}</p>
                  <p className="text-xs text-gray-500">
                    {row.resident ? "On the register" : "Non-resident"}
                  </p>
                </div>
              ),
            },
            { header: "Respondent", render: (row: OnlineComplaint) => row.respondent_name },
            {
              /* The case's own once accepted; until then, what the complainant chose. */
              header: "Nature of the Case",
              render: (row: OnlineComplaint) => {
                const nature = row.lupon_case?.case_classification ?? row.case_classification;

                return nature ? (
                  <span>
                    {nature}
                    {!row.lupon_case && <span className="block text-[11px] text-gray-400">as the complainant chose</span>}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Not given</span>
                );
              },
            },
            {
              header: "Sent",
              render: (row: OnlineComplaint) => (
                <span className="text-xs text-gray-500">
                  {new Date(row.created_at).toLocaleDateString("en-PH")}
                </span>
              ),
            },
            {
              header: "Status",
              render: (row: OnlineComplaint) => <StatusBadge status={row.status} />,
            },
            {
              header: "Case Number",
              render: (row: OnlineComplaint) =>
                row.lupon_case ? (
                  <Link
                    to={`/lupon/cases/${row.lupon_case.id}`}
                    className="font-semibold tabular-nums text-primary hover:underline"
                  >
                    {row.lupon_case.case_number}
                  </Link>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                ),
            },
            {
              header: "",
              render: (row: OnlineComplaint) => (
                <div className="flex justify-end">
                  <RowAction
                    label={
                      row.status === "For Office Verification"
                        ? "Review / Verify Case"
                        : "View Details"
                    }
                    icon={FiEye}
                    tone="primary"
                    onClick={() => setReviewing(row)}
                  />
                </div>
              ),
            },
          ]}
          rows={rows}
          rowKey={(row) => row.id}
          numbered
          total={total}
          loading={loading}
          searchable
          onSearch={(text) => { setSearch(text); setPage(1); }}
          searchValue={search}
          searchPlaceholder="Search by Reference Number, Complainant, Respondent, Nature of the Case or Case Number…"
          emptyMessage={search ? "No online complaint matches that search." : "No complaints have been begun online."}
          page={page}
          lastPage={lastPage}
          onPageChange={setPage}
        />
      </Card>

      <ComplaintReview
        complaint={reviewing}
        onClose={() => setReviewing(null)}
        onAccept={accept}
        onReject={reject}
        busy={busy}
      />
    </div>
  );
}
