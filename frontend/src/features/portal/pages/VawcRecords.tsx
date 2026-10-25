import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiFolder,
  FiInbox,
  FiPlus,
  FiShield,
} from "react-icons/fi";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import Modal from "../../../shared/ui/Modal";
import PageHeader from "../../../shared/ui/PageHeader";
import StatusBadge from "../../../shared/ui/StatusBadge";
import { RowsSkeleton } from "../../../shared/ui/Skeleton";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";
import type { IdCheckSummary } from "../../../shared/residentCard/ResidentIdCheck";
import { VawcReportForm, type ReportReceipt } from "../../vawc/components/online/VawcReportForm";
import { portalApi } from "../api";

export interface VawcOnlineReport {
  id: number;
  reference_no: string;
  status: string;
  sent_at: string | null;
  occurred_on: string | null;
  relationship: string | null;
  respondent_name: string | null;
  place: string | null;
  visit_required: boolean;
  confirmed_in_person: boolean;
  narrative: string | null;
  safe_contact: string | null;
  safe_time: string | null;
  vawc_case_id: number | null;
  office_note: string | null;
  next_step: string;
}

export interface VawcCase {
  id: number;
  case_code: string;
  my_role: string;
  reported_by_type: string | null;
  relationship_to_offender: string | null;
  violence_type: string | null;
  violence_types: string[];
  risk_level: string;
  currently_in_danger: string | null;
  status: string;
  report_date: string | null;
  closed_at: string | null;
  respondent_name: string;
  assigned_officer: string;
  protection_orders_count: number;
  referrals_count: number;
  followups_count: number;
  has_agreement: boolean;
}

export interface VawcProtectionOrder {
  id: number;
  case_code: string;
  vawc_case_id: number;
  status: string;
  applied_on: string | null;
  issued_on: string | null;
  expires_on: string | null;
  issued_by: string;
  issued_by_name: string | null;
  in_effect: boolean;
  days_left: number | null;
  notes: string | null;
  created_at: string | null;
}

export interface VawcTrackingEvent {
  case_code: string;
  date: string | null;
  event_type: string;
  title: string;
  status: string;
  details: string;
  badge?: string;
}

type View = "reports" | "cases" | "bpo" | "tracking";

const TAB_CONFIG: Record<
  View,
  { label: string; icon: typeof FiInbox; blurb: string; empty: string }
> = {
  reports: {
    label: "Online Complaints",
    icon: FiInbox,
    blurb: "Online complaint submissions, verification status, and scheduled intake with the VAW Desk.",
    empty: "You have not submitted any VAWC online complaints.",
  },
  cases: {
    label: "Confidential Cases",
    icon: FiFolder,
    blurb: "Official cases recorded and handled by the Barangay VAW Desk pursuant to RA 9262.",
    empty: "You do not have any active or recorded VAWC cases.",
  },
  bpo: {
    label: "Protection Orders (BPO)",
    icon: FiShield,
    blurb: "Barangay Protection Orders issued under RA 9262 §14 with immediate 15-day effect.",
    empty: "No Barangay Protection Orders have been applied for or issued for your records.",
  },
  tracking: {
    label: "Referrals & Tracking",
    icon: FiClock,
    blurb: "Chronological log of case actions, law enforcement referrals, and safety monitoring.",
    empty: "No actions or tracking events have been recorded yet.",
  },
};

export default function VawcRecords() {
  const { pathname } = useLocation();

  const view: View = pathname.endsWith("/cases")
    ? "cases"
    : pathname.endsWith("/bpo")
      ? "bpo"
      : pathname.endsWith("/tracking")
        ? "tracking"
        : "reports";

  const [reports, setReports] = useState<VawcOnlineReport[]>([]);
  const [cases, setCases] = useState<VawcCase[]>([]);
  const [orders, setOrders] = useState<VawcProtectionOrder[]>([]);
  const [tracking, setTracking] = useState<VawcTrackingEvent[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReportReceipt | null>(null);
  const [selectedReport, setSelectedReport] = useState<VawcOnlineReport | null>(null);
  const [selectedCase, setSelectedCase] = useState<VawcCase | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<VawcProtectionOrder | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<VawcTrackingEvent | null>(null);

  const [loading, setLoading] = useState(true);
  const pageLoad = usePageLoad();
  const [attempt, setAttempt] = useState(0);

  const loadData = () => {
    portalApi
      .vawcRecords()
      .then((r) => {
        const data = r.data.data;
        setReports(data.reports ?? []);
        setCases(data.cases ?? []);
        setOrders(data.protection_orders ?? []);
        setTracking(data.tracking ?? []);
      })
      .then(
        () => pageLoad.done(),
        (error) => {
          pageLoad.fail(error);
          throw error;
        },
      )
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const verify = async (code: string) =>
    (await portalApi.checkResidentCard({ code, purpose: "vawc" })).data.data as IdCheckSummary;

  const send = async (body: FormData, config: object) => {
    const r = await portalApi.sendVawcReport(body, config);
    return { ...r.data.data, message: r.data.message } as ReportReceipt;
  };

  if (pageLoad.state !== "ready") {
    return <PageLoading load={pageLoad} onRetry={() => setAttempt((n) => n + 1)} />;
  }

  const currentTab = TAB_CONFIG[view];

  return (
    <div className="space-y-6">
      <PageHeader
        title={currentTab.label}
        subtitle={currentTab.blurb}
        actions={
          view === "reports" &&
          !formOpen && (
            <button
              type="button"
              onClick={() => {
                setReceipt(null);
                setFormOpen(true);
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
            >
              <FiPlus className="h-4 w-4" aria-hidden="true" /> File online complaint
            </button>
          )
        }
      />

      {/* Emergency & Confidentiality Alert Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-900 shadow-xs">
        <div className="flex items-center gap-2.5">
          <FiAlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <span className="font-bold">In immediate danger?</span>
            <span className="ml-1 text-xs sm:text-sm text-rose-800">
              Call <strong>911</strong> or contact PNP Women's Desk immediately.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-rose-700">
          <FiShield className="h-4 w-4" />
          <span>Strictly Confidential · RA 9262</span>
        </div>
      </div>

      {/* VIEW 1: ONLINE COMPLAINTS */}
      {view === "reports" && (
        <div className="space-y-5">
          {receipt && (
            <div className="rounded-3xl border border-success/30 bg-emerald-50/60 p-5 shadow-xs">
              <p className="flex items-center gap-2 font-bold text-dark">
                <FiCheckCircle className="h-5 w-5 text-success" aria-hidden="true" />
                Complaint received — {receipt.reference_no}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-dark">{receipt.message}</p>
            </div>
          )}

          {formOpen && (
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-base font-bold text-dark">File a VAWC Online Complaint</h3>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="cursor-pointer text-xs font-semibold text-gray-500 hover:text-gray-800"
                >
                  Close form
                </button>
              </div>
              <VawcReportForm
                mode="portal"
                verify={verify}
                send={send}
                onSent={(r) => {
                  setReceipt(r);
                  setFormOpen(false);
                  loadData();
                }}
              />
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="cursor-pointer rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-dark hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <Card title="Submitted Online Complaints">
            {loading ? (
              <RowsSkeleton rows={3} what="online complaints" />
            ) : (
              <DataTable
                columns={[
                  {
                    header: "Reference No.",
                    render: (r: VawcOnlineReport) => (
                      <span className="font-bold tabular-nums text-primary">{r.reference_no}</span>
                    ),
                  },
                  {
                    header: "Date Sent",
                    render: (r: VawcOnlineReport) => (
                      <span className="whitespace-nowrap text-sm text-gray-600">
                        {r.sent_at ? new Date(r.sent_at).toLocaleDateString("en-PH") : "—"}
                      </span>
                    ),
                  },
                  {
                    header: "Status",
                    render: (r: VawcOnlineReport) => <StatusBadge status={r.status} />,
                  },
                  {
                    header: "Desk Verification",
                    render: (r: VawcOnlineReport) => (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.confirmed_in_person
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {r.confirmed_in_person ? "Verified in person" : "Verification pending"}
                      </span>
                    ),
                  },
                  {
                    header: "What happens next",
                    render: (r: VawcOnlineReport) => (
                      <span className="text-xs leading-relaxed text-gray-600 line-clamp-2">
                        {r.next_step}
                      </span>
                    ),
                  },
                  {
                    header: "Action",
                    render: (r: VawcOnlineReport) => (
                      <button
                        type="button"
                        onClick={() => setSelectedReport(r)}
                        className="cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                      >
                        <FiEye className="h-3.5 w-3.5" /> Details
                      </button>
                    ),
                  },
                ]}
                rows={reports}
                rowKey={(r) => r.reference_no}
                emptyMessage={TAB_CONFIG.reports.empty}
              />
            )}
          </Card>
        </div>
      )}

      {/* VIEW 2: CONFIDENTIAL CASES */}
      {view === "cases" && (
        <div className="space-y-5">
          <Card title="My VAWC Cases">
            {loading ? (
              <RowsSkeleton rows={3} what="confidential cases" />
            ) : (
              <DataTable
                columns={[
                  {
                    header: "Case Code",
                    render: (c: VawcCase) => (
                      <span className="font-bold tabular-nums text-primary">{c.case_code}</span>
                    ),
                  },
                  {
                    header: "Role",
                    render: (c: VawcCase) => (
                      <span className="inline-flex rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                        {c.my_role}
                      </span>
                    ),
                  },
                  {
                    header: "Date Reported",
                    render: (c: VawcCase) => (
                      <span className="whitespace-nowrap text-sm text-gray-600">
                        {c.report_date ? new Date(c.report_date).toLocaleDateString("en-PH") : "—"}
                      </span>
                    ),
                  },
                  {
                    header: "Violence Kind",
                    render: (c: VawcCase) => (
                      <div className="flex flex-wrap gap-1">
                        {(c.violence_types && c.violence_types.length > 0
                          ? c.violence_types
                          : [c.violence_type || "VAWC"]
                        ).map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ),
                  },
                  {
                    header: "Risk Level",
                    render: (c: VawcCase) => {
                      const level = c.risk_level || "Not Assessed";
                      const colors: Record<string, string> = {
                        Critical: "bg-red-50 text-red-700 border-red-200",
                        High: "bg-orange-50 text-orange-700 border-orange-200",
                        Medium: "bg-amber-50 text-amber-700 border-amber-200",
                        Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
                        "Not Assessed": "bg-gray-50 text-gray-600 border-gray-200",
                      };
                      return (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                            colors[level] ?? colors["Not Assessed"]
                          }`}
                        >
                          {level}
                        </span>
                      );
                    },
                  },
                  {
                    header: "Status",
                    render: (c: VawcCase) => <StatusBadge status={c.status} />,
                  },
                  {
                    header: "Assigned Officer",
                    render: (c: VawcCase) => (
                      <span className="text-xs font-medium text-gray-700">
                        {c.assigned_officer}
                      </span>
                    ),
                  },
                  {
                    header: "Action",
                    render: (c: VawcCase) => (
                      <button
                        type="button"
                        onClick={() => setSelectedCase(c)}
                        className="cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                      >
                        <FiEye className="h-3.5 w-3.5" /> View Case
                      </button>
                    ),
                  },
                ]}
                rows={cases}
                rowKey={(c) => c.case_code}
                emptyMessage={TAB_CONFIG.cases.empty}
              />
            )}
          </Card>
        </div>
      )}

      {/* VIEW 3: PROTECTION ORDERS (BPO) */}
      {view === "bpo" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs text-indigo-950 sm:text-sm">
            <h4 className="flex items-center gap-2 font-bold text-indigo-900">
              <FiShield className="h-4 w-4 text-indigo-600" /> Republic Act 9262 §14 — Barangay Protection Order (BPO)
            </h4>
            <p className="mt-1 leading-relaxed text-indigo-800">
              A Barangay Protection Order (BPO) is ordered by the Punong Barangay or an available Kagawad directing the respondent to cease and desist from causing or threatening violence. It is effective for <strong>15 calendar days</strong> from issuance.
            </p>
          </div>

          <Card title="Barangay Protection Orders">
            {loading ? (
              <RowsSkeleton rows={3} what="protection orders" />
            ) : (
              <DataTable
                columns={[
                  {
                    header: "Case Code",
                    render: (po: VawcProtectionOrder) => (
                      <span className="font-bold tabular-nums text-primary">{po.case_code}</span>
                    ),
                  },
                  {
                    header: "Status",
                    render: (po: VawcProtectionOrder) => <StatusBadge status={po.status} />,
                  },
                  {
                    header: "Applied On",
                    render: (po: VawcProtectionOrder) => (
                      <span className="whitespace-nowrap text-sm text-gray-600">
                        {po.applied_on ? new Date(po.applied_on).toLocaleDateString("en-PH") : "—"}
                      </span>
                    ),
                  },
                  {
                    header: "Issued On",
                    render: (po: VawcProtectionOrder) => (
                      <span className="whitespace-nowrap text-sm text-gray-600">
                        {po.issued_on ? new Date(po.issued_on).toLocaleDateString("en-PH") : "Pending"}
                      </span>
                    ),
                  },
                  {
                    header: "Effective Until",
                    render: (po: VawcProtectionOrder) => (
                      <span className="whitespace-nowrap text-sm text-gray-600">
                        {po.expires_on ? new Date(po.expires_on).toLocaleDateString("en-PH") : "—"}
                      </span>
                    ),
                  },
                  {
                    header: "Validity",
                    render: (po: VawcProtectionOrder) => {
                      if (po.in_effect) {
                        return (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-300">
                            Active · {po.days_left} day(s) left
                          </span>
                        );
                      }
                      if (po.status === "Issued" && !po.in_effect) {
                        return (
                          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                            Expired (15 days)
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                          Application under review
                        </span>
                      );
                    },
                  },
                  {
                    header: "Issued By",
                    render: (po: VawcProtectionOrder) => (
                      <span className="text-xs text-gray-700">
                        {po.issued_by} {po.issued_by_name ? `(${po.issued_by_name})` : ""}
                      </span>
                    ),
                  },
                  {
                    header: "Action",
                    render: (po: VawcProtectionOrder) => (
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(po)}
                        className="cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                      >
                        <FiEye className="h-3.5 w-3.5" /> Order details
                      </button>
                    ),
                  },
                ]}
                rows={orders}
                rowKey={(po) => String(po.id)}
                emptyMessage={TAB_CONFIG.bpo.empty}
              />
            )}
          </Card>
        </div>
      )}

      {/* VIEW 4: REFERRALS & TRACKING */}
      {view === "tracking" && (
        <div className="space-y-5">
          <Card title="Case Tracking & Referrals Timeline">
            {loading ? (
              <RowsSkeleton rows={4} what="tracking events" />
            ) : (
              <DataTable
                columns={[
                  {
                    header: "Date",
                    render: (e: VawcTrackingEvent) => (
                      <span className="whitespace-nowrap text-sm font-medium text-dark">
                        {e.date ? new Date(e.date).toLocaleDateString("en-PH") : "—"}
                      </span>
                    ),
                  },
                  {
                    header: "Case Code",
                    render: (e: VawcTrackingEvent) => (
                      <span className="font-bold tabular-nums text-primary">{e.case_code}</span>
                    ),
                  },
                  {
                    header: "Activity Type",
                    render: (e: VawcTrackingEvent) => (
                      <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-800">
                        {e.event_type}
                      </span>
                    ),
                  },
                  {
                    header: "Event",
                    render: (e: VawcTrackingEvent) => (
                      <span className="text-sm font-semibold text-dark">{e.title}</span>
                    ),
                  },
                  {
                    header: "Status",
                    render: (e: VawcTrackingEvent) => <StatusBadge status={e.status} />,
                  },
                  {
                    header: "Details",
                    render: (e: VawcTrackingEvent) => (
                      <span className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {e.details}
                      </span>
                    ),
                  },
                  {
                    header: "Action",
                    render: (e: VawcTrackingEvent) => (
                      <button
                        type="button"
                        onClick={() => setSelectedEvent(e)}
                        className="cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                      >
                        <FiEye className="h-3.5 w-3.5" /> Details
                      </button>
                    ),
                  },
                ]}
                rows={tracking}
                rowKey={(e: VawcTrackingEvent) => `${e.case_code}-${e.date}-${e.title}`}
                emptyMessage={TAB_CONFIG.tracking.empty}
              />
            )}
          </Card>
        </div>
      )}

      {/* MODAL 1: ONLINE COMPLAINT DETAILS */}
      <Modal
        open={selectedReport !== null}
        onClose={() => setSelectedReport(null)}
        title={selectedReport ? `Complaint Details · ${selectedReport.reference_no}` : "Complaint Details"}
      >
        {selectedReport && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div>
                <span className="text-xs text-gray-500">Reference Number</span>
                <p className="text-base font-bold text-dark">{selectedReport.reference_no}</p>
              </div>
              <div>
                <StatusBadge status={selectedReport.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-gray-500">Date Filed</span>
                <p className="font-semibold text-gray-800">
                  {selectedReport.sent_at ? new Date(selectedReport.sent_at).toLocaleString("en-PH") : "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Incident Date</span>
                <p className="font-semibold text-gray-800">{selectedReport.occurred_on || "—"}</p>
              </div>
              <div>
                <span className="text-gray-500">Place of Incident</span>
                <p className="font-semibold text-gray-800">{selectedReport.place || "—"}</p>
              </div>
              <div>
                <span className="text-gray-500">Relationship to Offender</span>
                <p className="font-semibold text-gray-800">{selectedReport.relationship || "—"}</p>
              </div>
              <div>
                <span className="text-gray-500">Respondent Name (as reported)</span>
                <p className="font-semibold text-gray-800">{selectedReport.respondent_name || "—"}</p>
              </div>
              <div>
                <span className="text-gray-500">Safe Contact Provided</span>
                <p className="font-semibold text-gray-800">{selectedReport.safe_contact || "—"}</p>
              </div>
            </div>

            {selectedReport.narrative && (
              <div className="rounded-xl bg-gray-50 p-3 text-xs">
                <span className="font-semibold text-gray-700">Narrative Summary:</span>
                <p className="mt-1 text-gray-600 leading-relaxed italic">{selectedReport.narrative}</p>
              </div>
            )}

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
              <span className="font-bold text-primary">What happens next:</span>
              <p className="mt-1 text-gray-700 leading-relaxed">{selectedReport.next_step}</p>
            </div>

            {selectedReport.office_note && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
                <span className="font-semibold text-amber-800">Office Notes from VAW Desk:</span>
                <p className="mt-1 text-amber-900 leading-relaxed">{selectedReport.office_note}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* MODAL 2: CONFIDENTIAL CASE SUMMARY */}
      <Modal
        open={selectedCase !== null}
        onClose={() => setSelectedCase(null)}
        title={selectedCase ? `Case Summary · ${selectedCase.case_code}` : "Case Summary"}
      >
        {selectedCase && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div>
                <span className="text-xs text-gray-500">VAWC Case Code</span>
                <p className="text-base font-bold text-dark">{selectedCase.case_code}</p>
              </div>
              <div>
                <StatusBadge status={selectedCase.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-gray-500">Your Role</span>
                <p className="font-semibold text-primary">{selectedCase.my_role}</p>
              </div>
              <div>
                <span className="text-gray-500">Date Reported</span>
                <p className="font-semibold text-gray-800">
                  {selectedCase.report_date ? new Date(selectedCase.report_date).toLocaleDateString("en-PH") : "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Assigned VAWC Officer</span>
                <p className="font-semibold text-gray-800">{selectedCase.assigned_officer}</p>
              </div>
              <div>
                <span className="text-gray-500">Assessed Risk Level</span>
                <p className="font-semibold text-gray-800">{selectedCase.risk_level}</p>
              </div>
              <div>
                <span className="text-gray-500">Relationship to Offender</span>
                <p className="font-semibold text-gray-800">{selectedCase.relationship_to_offender || "—"}</p>
              </div>
              <div>
                <span className="text-gray-500">Respondent Name (on record)</span>
                <p className="font-semibold text-gray-800">{selectedCase.respondent_name}</p>
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 p-3 text-xs space-y-2">
              <span className="font-bold text-gray-700">Actions on Record:</span>
              <ul className="list-inside list-disc text-gray-600 space-y-1">
                <li>Protection Orders (BPO): {selectedCase.protection_orders_count} recorded</li>
                <li>Agency Referrals (PNP / DSWD / Hospital): {selectedCase.referrals_count} completed</li>
                <li>Safety Follow-ups & Monitoring: {selectedCase.followups_count} conducted</li>
                <li>
                  Dialogue Undertaking / Agreement:{" "}
                  {selectedCase.has_agreement ? "Recorded on file" : "None"}
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 leading-relaxed">
              <p>
                <strong>Need assistance regarding this case?</strong> You can contact or visit the Barangay VAW Desk at the Barangay Hall during office hours.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: BPO ORDER DETAILS */}
      <Modal
        open={selectedOrder !== null}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Protection Order · ${selectedOrder.case_code}` : "Protection Order"}
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div>
                <span className="text-xs text-gray-500">Associated Case</span>
                <p className="text-base font-bold text-dark">{selectedOrder.case_code}</p>
              </div>
              <div>
                <StatusBadge status={selectedOrder.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-gray-500">Application Date</span>
                <p className="font-semibold text-gray-800">
                  {selectedOrder.applied_on ? new Date(selectedOrder.applied_on).toLocaleDateString("en-PH") : "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Issuance Date</span>
                <p className="font-semibold text-gray-800">
                  {selectedOrder.issued_on ? new Date(selectedOrder.issued_on).toLocaleDateString("en-PH") : "Pending"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Effective Until</span>
                <p className="font-semibold text-gray-800">
                  {selectedOrder.expires_on ? new Date(selectedOrder.expires_on).toLocaleDateString("en-PH") : "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Issuing Official</span>
                <p className="font-semibold text-gray-800">
                  {selectedOrder.issued_by} {selectedOrder.issued_by_name ? `(${selectedOrder.issued_by_name})` : ""}
                </p>
              </div>
            </div>

            {selectedOrder.in_effect && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
                <span className="font-bold flex items-center gap-1.5">
                  <FiCheckCircle className="h-4 w-4 text-emerald-600" /> Currently Active and Enforceable
                </span>
                <p className="mt-1">
                  This Barangay Protection Order has <strong>{selectedOrder.days_left} calendar day(s)</strong> remaining in effect.
                </p>
              </div>
            )}

            {selectedOrder.notes && (
              <div className="rounded-xl bg-gray-50 p-3 text-xs">
                <span className="font-semibold text-gray-700">Order Notes / Terms:</span>
                <p className="mt-1 text-gray-600 leading-relaxed">{selectedOrder.notes}</p>
              </div>
            )}

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
              <strong>Need longer protection?</strong> A BPO lasts 15 days. If further protection is required, you may apply for a Temporary Protection Order (TPO) or Permanent Protection Order (PPO) at the Family Court or Municipal Trial Court. The Barangay VAW Desk can assist you with the court referral.
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 4: TRACKING EVENT DETAILS */}
      <Modal
        open={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent ? `Action Record · ${selectedEvent.case_code}` : "Action Record"}
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div>
                <span className="text-xs text-gray-500">Associated Case</span>
                <p className="text-base font-bold text-dark">{selectedEvent.case_code}</p>
              </div>
              <div>
                <StatusBadge status={selectedEvent.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-gray-500">Date</span>
                <p className="font-semibold text-gray-800">
                  {selectedEvent.date ? new Date(selectedEvent.date).toLocaleDateString("en-PH") : "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Event Type</span>
                <p className="font-semibold text-gray-800">{selectedEvent.event_type}</p>
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 p-3 text-xs">
              <span className="font-bold text-gray-700">{selectedEvent.title}</span>
              <p className="mt-1.5 text-gray-600 leading-relaxed">{selectedEvent.details}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
