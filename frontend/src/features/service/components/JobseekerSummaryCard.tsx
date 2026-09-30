import { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import Card from "../../../shared/ui/Card";
import { inputClasses } from "../../../shared/ui/FormField";
import FormPreview from "../../../shared/print/FormPreview";
import { SignatoryFields, useSignatories } from "../../../shared/print/SignatoryFields";
import { withoutHon } from "../../../shared/print/formKit";
import { serviceApi } from "../api";
import { jobseekerHtml, type JobseekerSummary } from "../lib/jobseekerForm";

type Payload = JobseekerSummary & { signatories: Record<string, string | null> };

/**
 * The First-Time Jobseeker summary the barangay sends the DILG — "As of" the
 * current month, worked out by the system, and dated the day it prints.
 */
export function JobseekerSummaryCard() {
  const thisYear = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    serviceApi.jobseekerSummary({ params: { year } })
      .then((r) => setData(r.data.data as Payload))
      .catch(() => setFailed(true));
  }, [year]);

  const s = data?.signatories ?? {};
  const defaults = [
    { key: "secretary", label: "Prepared by (Barangay Secretary)", value: s.secretary ?? "" },
    { key: "punong_barangay", label: "Reviewed and approved (Punong Barangay)", value: withoutHon(s.punong_barangay) },
  ];
  const signatories = useSignatories(defaults);

  const html = useMemo(
    () => (data ? jobseekerHtml(data, {
      secretary: signatories.names.secretary ?? "",
      punong_barangay: signatories.names.punong_barangay ?? "",
    }) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(data), JSON.stringify(signatories.names)],
  );

  return (
    <Card title="First-Time Jobseekers — Monthly Summary of Availees/Beneficiaries" className="mt-6">
      <div className="-mt-2 mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Every First-Time Jobseeker certificate the office took up (RA 11261), by the month it was asked
          for. For the DILG, through the municipality. Legal paper.
        </p>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          aria-label="Summary year"
          className={`${inputClasses} w-auto cursor-pointer rounded-full py-2`}
        >
          {Array.from({ length: 5 }, (_, i) => thisYear - i).map((y) => <option key={y}>{y}</option>)}
        </select>
      </div>

      {data && data.unanswered > 0 && (
        <p className="mb-4 flex gap-2 rounded-xl border border-warning/40 bg-warning/5 px-4 py-2.5 text-xs text-dark">
          <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          {data.unanswered} availee{data.unanswered === 1 ? " is" : "s are"} missing an educational level,
          OSY/ISY or sex. They are counted in the month's total, but not in those columns — answer it on
          the certificate's record and the summary follows.
        </p>
      )}

      <SignatoryFields defaults={defaults} state={signatories} />

      {failed ? (
        <p className="py-6 text-center text-sm text-gray-400">The summary needs a connection to the server.</p>
      ) : html ? (
        <FormPreview html={html} title={`Monthly Summary of Availees/Beneficiaries ${year}`} printLabel="Print summary" />
      ) : (
        <p className="py-6 text-center text-sm text-gray-400">Loading the summary…</p>
      )}
    </Card>
  );
}
