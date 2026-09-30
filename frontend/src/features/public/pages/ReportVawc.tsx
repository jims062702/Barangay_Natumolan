import { useState } from "react";
import { FiArrowLeft, FiCheckCircle } from "react-icons/fi";
import { Link } from "react-router-dom";
import type { IdCheckSummary } from "../../../shared/residentCard/ResidentIdCheck";
import { VawcReportForm, type ReportReceipt } from "../../vawc/components/online/VawcReportForm";
import logo from "../../../assets/logo/barangay-logo.png";
import { publicApi } from "../api";

/* "vawc": a man's card is refused, and the number on her record comes back to fill in. */
const verify = async (code: string) => (await publicApi.verifyResidentId({ code, purpose: "vawc" })).data.data as IdCheckSummary;
const send = async (body: FormData, config: object) => {
  const r = await publicApi.sendVawcReport(body, config);

  return { ...r.data.data, message: r.data.message } as ReportReceipt;
};

/**
 * VAWC ONLINE COMPLAINT — filed by a WOMAN who is a registered resident of
 * Barangay Natumolan (the office's rules, 2026-09-29 and 2026-09-30).
 *
 * There is no "I live elsewhere" here and no guest complaint: the form
 * starts with the complainant's Barangay Resident ID, and nothing else opens
 * until the register has verified it — and a man's card is refused there.
 * Somebody who cannot file here is told, in the one line under that step,
 * where to go in person — nothing about them is recorded.
 *
 * 911 is the only number on this page: the national emergency line, which
 * certainly answers.
 */
export default function ReportVawc() {
  const [receipt, setReceipt] = useState<ReportReceipt | null>(null);

  return (
    <div className="min-h-screen bg-secondary px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <Link to="/" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
          <FiArrowLeft aria-hidden="true" /> Back to website
        </Link>

        <div className="mb-6 text-center">
          <img src={logo} alt="Barangay Natumolan logo" className="mx-auto h-16 w-16 rounded-full object-cover" />
          <h1 className="mt-3 text-2xl font-bold text-dark">VAWC Online Complaint</h1>
          <p className="mx-auto mt-1 max-w-xl text-sm leading-relaxed text-gray-500">
            Violence against women and their children — to the Barangay Natumolan VAW Desk. Filed by a woman who is a
            registered resident. Confidential.
          </p>
        </div>

        <p className="mb-5 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-center text-sm font-semibold text-dark">
          In danger right now? Call 911.
        </p>

        {receipt ? (
          <div className="rounded-3xl border border-success/30 bg-white p-6 shadow-sm" data-testid="vawc-receipt">
            <div className="flex items-center gap-2">
              <FiCheckCircle className="h-6 w-6 text-success" aria-hidden="true" />
              <p className="text-lg font-bold text-dark">Complaint received</p>
            </div>
            <p className="mt-2 text-sm text-gray-600">Reference number</p>
            <p className="font-mono text-2xl font-bold tracking-wide text-primary">{receipt.reference_no}</p>
            <p className="mt-4 text-sm leading-relaxed text-dark">{receipt.message}</p>
            <p className="mt-4 text-xs text-gray-500">
              Keep the reference number. If you have a resident portal account, the complaint is also listed under
              “VAWC Online Complaint”.
            </p>
          </div>
        ) : (
          <VawcReportForm
            mode="public"
            verify={verify}
            send={send}
            onSent={setReceipt}
          />
        )}
      </div>
    </div>
  );
}
