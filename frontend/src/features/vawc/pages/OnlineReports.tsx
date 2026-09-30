import { useEffect, useRef, useState } from "react";
import { FiAlertTriangle, FiCheck, FiExternalLink, FiInbox, FiX } from "react-icons/fi";
import { Link, useSearchParams } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import Modal from "../../../shared/ui/Modal";
import PageHeader from "../../../shared/ui/PageHeader";
import StatTile from "../../../shared/ui/StatTile";
import StatusBadge from "../../../shared/ui/StatusBadge";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";
import ResidentPicker from "../../resident/components/ResidentPicker";
import type { Resident } from "../../../shared/types";
import { ValidIdViewer } from "../../lupon/components/online/ValidIdViewer";
import { vawcApi } from "../api";

interface ReportRow {
  id: number;
  reference_no: string;
  status: string;
  sent_at: string | null;
  filed_via: string;
  resident: { id: number; name: string; resident_number: string; zone_purok: string | null } | null;
  /** The respondent as she wrote it. */
  respondent_name: string | null;
  /** The register's record, once the desk has chosen it (or chosen by her, before 2026-09-30). */
  respondent: { id: number; name: string; resident_number: string; zone_purok: string | null } | null;
  threatened: boolean;
  in_danger_now: boolean;
  visit_required: boolean;
  case_code: string | null;
  vawc_case_id: number | null;
}

interface ReportDetail {
  id: number;
  reference_no: string;
  status: string;
  created_at: string;
  filed_via: string;
  violence_types: string[];
  narrative: string;
  occurred_on: string | null;
  place: string | null;
  respondent_name: string | null;
  respondent_address: string | null;
  relationship: string | null;
  threatened: boolean;
  in_danger_now: boolean;
  safe_contact: string | null;
  safe_time: string | null;
  visit_required: boolean;
  confirmed_in_person: boolean;
  office_note: string | null;
  vawc_case_id: number | null;
  vawc_case: { id: number; case_code: string } | null;
  resident: { id: number; full_name: string; resident_number: string; zone_purok: string | null; contact_number: string | null } | null;
  respondent: (Resident & { full_name: string }) | null;
  card: { status: string } | null;
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—");

function Flags({ row }: { row: Pick<ReportRow, "threatened" | "in_danger_now" | "visit_required"> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {row.in_danger_now && <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger">In danger when reported</span>}
      {row.threatened && <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger">Threatened</span>}
      {row.visit_required
        ? <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-gray-600">Confirm in person</span>
        : <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning">Visit optional</span>}
    </div>
  );
}

/**
 * VAWC online complaints residents sent, for the VAW Desk to verify.
 *
 * A threat reported sorts first. Opening one is written to its trail, as is
 * looking at her Resident ID. Verifying it opens a VAWC case — and it is HERE
 * that the respondent is found on the register (2026-09-30), as the Lupon
 * does with its online complaints: she wrote a name and where they live, and
 * the desk searches for that person and chooses them. A complaint with no
 * threat in it is verified only once she has confirmed it in person.
 *
 * The desk's notification ("New VAWC online complaint: VR-…") opens this
 * page with ?ref=, and that complaint is opened — and logged — at once.
 */
export default function OnlineReports() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [open, setOpen] = useState<ReportDetail | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  /* The person she named, found on the register by the desk. */
  const [respondent, setRespondent] = useState<Resident | null>(null);
  const [note, setNote] = useState("");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const pageLoad = usePageLoad();
  const [params] = useSearchParams();
  const linked = params.get("ref");
  const openFromLink = useRef<string | null>(linked);
  /* A second notification pressed while already here. */
  useEffect(() => {
    if (linked) openFromLink.current = linked;
  }, [linked]);

  const load = () => {
    vawcApi.onlineReports()
      .then((r) => {
        const found: ReportRow[] = r.data.data ?? [];
        setRows(found);
        if (openFromLink.current) {
          const match = found.find((row) => row.reference_no === openFromLink.current);
          openFromLink.current = null;
          if (match) void openReport(match.id);
        }
      })
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch((err) => toast(errorMessage(err), "error"));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [linked]);

  const openReport = async (id: number) => {
    try {
      const r = await vawcApi.onlineReport(id);
      const detail = r.data.data as ReportDetail;
      setOpen(detail);
      /* One she chose herself, on a complaint sent before the desk did the choosing. */
      setRespondent(detail.respondent ?? null);
      setConfirmed(false);
      setNote("");
      setDeclining(false);
      setReason("");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const accept = async () => {
    if (!open || !respondent) return;
    setBusy(true);
    try {
      const r = await vawcApi.acceptOnlineReport(open.id, {
        confirmed_in_person: confirmed,
        respondent_id: respondent.id,
        note: note.trim() || null,
      });
      toast(r.data.message);
      setOpen(null);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (!open) return;
    setBusy(true);
    try {
      const r = await vawcApi.declineOnlineReport(open.id, { reason: reason.trim() });
      toast(r.data.message);
      setOpen(null);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={load} />;

  const waiting = rows.filter((r) => r.status === "For Verification");
  const urgent = waiting.filter((r) => r.threatened || r.in_danger_now);

  return (
    <div>
      <PageHeader title="VAWC Online Complaints" subtitle="Complaints residents sent online — verify each one before it becomes a case" />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile label="Waiting to be verified" value={waiting.length} tone="warning" icon={FiInbox} />
        <StatTile label="With a threat reported" value={urgent.length} tone="danger" icon={FiAlertTriangle} />
      </div>

      <Card title="Complaints">
        <DataTable
          columns={[
            { header: "Reference Number", render: (r: ReportRow) => <span className="font-semibold tabular-nums text-dark">{r.reference_no}</span> },
            { header: "Sent", render: (r: ReportRow) => when(r.sent_at) },
            { header: "Complainant", render: (r: ReportRow) => r.resident ? <span>{r.resident.name}<span className="block text-xs text-gray-500">{r.resident.resident_number} · {r.resident.zone_purok ?? "—"}</span></span> : "—" },
            {
              header: "Respondent",
              render: (r: ReportRow) => r.respondent
                ? <span>{r.respondent.name}<span className="block text-xs text-gray-500">{r.respondent.resident_number} · {r.respondent.zone_purok ?? "—"}</span></span>
                : <span>{r.respondent_name ?? "—"}<span className="block text-xs text-gray-400">As she wrote it — found on the register when verified</span></span>,
            },
            { header: "Safety", render: (r: ReportRow) => <Flags row={r} /> },
            { header: "Status", render: (r: ReportRow) => <StatusBadge status={r.status} /> },
            { header: "Case Code", render: (r: ReportRow) => (r.vawc_case_id ? <Link to={`/vawc/cases/${r.vawc_case_id}`} className="font-semibold text-primary hover:underline">{r.case_code}</Link> : "—") },
            {
              header: "",
              render: (r: ReportRow) => (
                <button type="button" onClick={() => openReport(r.id)} aria-label={`Open ${r.reference_no}`} className="cursor-pointer rounded-full border border-gray px-4 py-1.5 text-xs font-semibold text-dark hover:border-primary hover:text-primary">
                  Open
                </button>
              ),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          emptyMessage="No VAWC complaints have been sent online."
        />
      </Card>

      <Modal open={open !== null} onClose={() => setOpen(null)} title={open ? `VAWC online complaint ${open.reference_no}` : "VAWC online complaint"} size="wide">
        {open && (
          <div className="space-y-5 text-sm" data-testid="online-report">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={open.status} />
              <span className="text-gray-500">Sent {when(open.created_at)} · {open.filed_via === "Portal" ? "from her portal" : "from the public page"}</span>
            </div>
            <Flags row={open} />

            <dl className="grid gap-3 rounded-2xl bg-secondary/60 p-4 sm:grid-cols-2">
              <div><dt className="text-xs text-gray-500">Complainant</dt><dd className="font-semibold text-dark">{open.resident?.full_name ?? "—"}</dd></div>
              <div><dt className="text-xs text-gray-500">Resident Number · Zone / Purok</dt><dd className="font-semibold text-dark">{open.resident?.resident_number} · {open.resident?.zone_purok ?? "—"}</dd></div>
              <div><dt className="text-xs text-gray-500">Kinds of harm</dt><dd className="font-semibold text-dark">{open.violence_types.join(", ")}</dd></div>
              <div><dt className="text-xs text-gray-500">When · where</dt><dd className="text-dark">{open.occurred_on ?? "—"} · {open.place ?? "—"}</dd></div>
              <div>
                <dt className="text-xs text-gray-500">Respondent, as she wrote it</dt>
                <dd className="text-dark">
                  <span className="font-semibold">{open.respondent_name ?? "Not given"}</span>
                  {open.respondent_address ? ` · ${open.respondent_address}` : ""}
                  {open.relationship ? ` — ${open.relationship}` : ""}
                  {open.status !== "For Verification" && open.respondent && (
                    <span className="block text-xs text-gray-500">
                      On the register: {open.respondent.full_name} · {open.respondent.resident_number} · {open.respondent.zone_purok ?? "—"}
                    </span>
                  )}
                </dd>
              </div>
              <div><dt className="text-xs text-gray-500">Safe way to reach her</dt><dd className="text-dark">{open.safe_contact ?? "Not given"}{open.safe_time ? ` (${open.safe_time})` : ""}</dd></div>
            </dl>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">What happened</p>
              <p className="whitespace-pre-wrap rounded-2xl border border-gray p-4 leading-relaxed text-dark">{open.narrative}</p>
            </div>

            <ValidIdViewer complaintId={open.id} idType="Barangay Resident ID" idNumber={open.resident?.resident_number} path={`/vawc/online-reports/${open.id}/id`} />

            {open.status === "For Verification" ? (
              <div className="space-y-3 rounded-2xl border border-gray p-4">
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4" />
                  <span>
                    <span className="font-semibold text-dark">She confirmed this complaint in person at the VAW Desk</span>
                    <span className="block text-xs text-gray-500">
                      {open.visit_required
                        ? "Required: no threat was reported, so the complaint is verified only after she confirms it here."
                        : "Optional: a threat was reported, so the desk may verify and act without her coming in first."}
                    </span>
                  </span>
                </label>
                {/*
                  She wrote a name; a protection order is served on a record.
                  The respondent is found on the register here — a resident,
                  and not the complainant herself — as the Lupon does before it
                  accepts an online complaint.
                */}
                <FormField
                  label="The respondent, on the register"
                  required
                  plain
                  hint="Required. Search the register for the person she named and choose them — the case is opened against that record."
                >
                  <ResidentPicker
                    value={respondent}
                    onChange={setRespondent}
                    residentsOnly
                    excludeIds={open.resident ? [open.resident.id] : []}
                    placeholder={open.respondent_name ? `Search for "${open.respondent_name}"…` : "Search by Name or Resident Number…"}
                  />
                </FormField>
                <FormField label="Note for the case" hint="Optional. Goes into the case's confidential notes.">
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputClasses} />
                </FormField>
                {declining && (
                  <FormField label="Why it is not accepted" required hint="She reads this on her portal — say what she can do instead.">
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} className={inputClasses} />
                  </FormField>
                )}
                {!declining && (!respondent || (open.visit_required && !confirmed)) && (
                  <p className="text-right text-xs text-gray-500" data-testid="accept-needs">
                    To verify: {!respondent ? "choose the respondent from the register" : ""}
                    {!respondent && open.visit_required && !confirmed ? ", and " : ""}
                    {open.visit_required && !confirmed ? "tick that she confirmed it in person" : ""}.
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  {declining ? (
                    <>
                      <button type="button" onClick={() => setDeclining(false)} className="cursor-pointer rounded-full border border-gray px-5 py-2 font-semibold text-dark hover:border-primary">Back</button>
                      <button type="button" onClick={decline} disabled={busy || reason.trim().length < 5} className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-danger px-5 py-2 font-semibold text-white disabled:opacity-50">
                        <FiX className="h-4 w-4" aria-hidden="true" /> Decline the complaint
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setDeclining(true)} className="cursor-pointer rounded-full border border-gray px-5 py-2 font-semibold text-dark hover:border-danger hover:text-danger">Decline…</button>
                      <button type="button" onClick={accept} disabled={busy || !respondent || (open.visit_required && !confirmed)} className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
                        <FiCheck className="h-4 w-4" aria-hidden="true" /> Verify and open a case
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : open.vawc_case ? (
              <Link to={`/vawc/cases/${open.vawc_case.id}`} className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">
                <FiExternalLink className="h-4 w-4" aria-hidden="true" /> Open case {open.vawc_case.case_code}
              </Link>
            ) : (
              <p className="rounded-2xl bg-secondary px-4 py-3 text-gray-600">Declined{open.office_note ? `: ${open.office_note}` : "."}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
