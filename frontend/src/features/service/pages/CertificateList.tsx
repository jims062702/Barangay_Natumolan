import { FiPlus } from "react-icons/fi";
import PageHeader from "../../../shared/ui/PageHeader";
import { FLOW } from "../lib/certificateFlow";
import { useCertificateDesk } from "../hooks/useCertificateDesk";
import { CertificateTable } from "../components/certificates/CertificateTable";
import { NewCertificateModal } from "../components/certificates/NewCertificateModal";
import { CertificateDetailModal } from "../components/certificates/CertificateDetailModal";
import { PageLoading } from "../../../shared/ui/PageLoad";

export default function CertificateList() {
  const ctx = useCertificateDesk();
  const {
    openCreate,
  } = ctx;

  if (ctx.pageLoad.state !== "ready") return <PageLoading load={ctx.pageLoad} onRetry={() => ctx.load()} />;

  return (
    <div>
      <PageHeader
        title="Certificates"
        subtitle="Accept → print → release, with public QR/reference verification"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" /> New certificate
          </button>
        }
      />

      {/* How the workflow moves */}
      <div className="mb-4 rounded-2xl border border-gray bg-white px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-dark">Workflow:</span>
          {FLOW.map((stage, index) => (
            <span key={stage} className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 font-semibold ${
                  stage === "Ready to Claim" || stage === "Released"
                    ? "bg-success/10 text-success"
                    : stage === "Pending"
                      ? "bg-warning/10 text-warning"
                      : "bg-primary/10 text-primary"
                }`}
              >
                {index + 1}. {stage}
              </span>
              {index < FLOW.length - 1 && <span className="text-gray-400">→</span>}
            </span>
          ))}
        </div>
        <p className="mt-2 text-gray-500">
          Three presses, all the clerk's: <strong>accept</strong>, <strong>print</strong>,
          <strong> release</strong>. There is no approval step and no signature to click — the
          Punong Barangay signs the paper on its way to the counter. The resident is notified
          automatically when it is <strong>ready to claim</strong> and again when they have
          <strong> received</strong> it.
        </p>
      </div>

      <CertificateTable ctx={ctx} />

      <NewCertificateModal ctx={ctx} />

      <CertificateDetailModal ctx={ctx} />
    </div>
  );
}

