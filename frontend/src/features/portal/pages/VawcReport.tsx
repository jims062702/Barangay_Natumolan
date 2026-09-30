import { useEffect, useState } from "react";
import { FiCheckCircle, FiPlus } from "react-icons/fi";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import PageHeader from "../../../shared/ui/PageHeader";
import StatusBadge from "../../../shared/ui/StatusBadge";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";
import type { IdCheckSummary } from "../../../shared/residentCard/ResidentIdCheck";
import { VawcReportForm, type ReportReceipt } from "../../vawc/components/online/VawcReportForm";
import { portalApi } from "../api";

interface MyReport {
  reference_no: string;
  status: string;
  sent_at: string | null;
  visit_required: boolean;
  next_step: string;
}

/**
 * The resident's VAWC online complaints — sending one, and following each.
 *
 * On their portal because the office asked for it (2026-09-28). The same
 * form as the public page: her own Resident ID first — a woman's (2026-09-30)
 * — then the respondent in her own words; the VAW Desk finds them on the
 * register when it verifies. The list says only what answers "what happens
 * next?" — never what she wrote.
 */
export default function VawcReport() {
  const [mine, setMine] = useState<MyReport[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReportReceipt | null>(null);
  const pageLoad = usePageLoad();

  const load = () => {
    portalApi.vawcReports()
      .then((r) => setMine(r.data.data ?? []))
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => setMine([]));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const verify = async (code: string) => (await portalApi.checkResidentCard({ code, purpose: "vawc" })).data.data as IdCheckSummary;
  const send = async (body: FormData, config: object) => {
    const r = await portalApi.sendVawcReport(body, config);

    return { ...r.data.data, message: r.data.message } as ReportReceipt;
  };

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="VAWC Online Complaint"
        subtitle="Violence against women and their children — sent to the Barangay VAW Desk only, and kept confidential"
        actions={!formOpen && (
          <button
            type="button"
            onClick={() => { setReceipt(null); setFormOpen(true); }}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" /> New complaint
          </button>
        )}
      />

      <p className="mb-5 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-semibold text-dark">
        In danger right now? Call 911.
      </p>

      {receipt && (
        <div className="mb-5 rounded-3xl border border-success/30 bg-white p-5 shadow-sm" data-testid="vawc-receipt">
          <p className="flex items-center gap-2 font-bold text-dark">
            <FiCheckCircle className="h-5 w-5 text-success" aria-hidden="true" /> Complaint received — {receipt.reference_no}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-dark">{receipt.message}</p>
        </div>
      )}

      {formOpen && (
        <div className="mb-6">
          <VawcReportForm
            mode="portal"
            verify={verify}
            send={send}
            onSent={(r) => { setReceipt(r); setFormOpen(false); load(); }}
          />
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => setFormOpen(false)} className="cursor-pointer rounded-full border border-gray bg-white px-5 py-2.5 text-sm font-semibold text-dark hover:border-primary">
              Cancel
            </button>
          </div>
        </div>
      )}

      <Card title="Complaints you have sent">
        <DataTable
          columns={[
            { header: "Reference Number", render: (r: MyReport) => <span className="font-semibold tabular-nums text-dark">{r.reference_no}</span> },
            { header: "Sent", render: (r: MyReport) => (r.sent_at ? new Date(r.sent_at).toLocaleDateString("en-PH") : "—") },
            { header: "Status", render: (r: MyReport) => <StatusBadge status={r.status} /> },
            { header: "What happens next", render: (r: MyReport) => <span className="text-xs leading-relaxed text-gray-600">{r.next_step}</span> },
          ]}
          rows={mine}
          rowKey={(r) => r.reference_no}
          emptyMessage="You have not sent a VAWC online complaint."
        />
      </Card>
    </div>
  );
}
