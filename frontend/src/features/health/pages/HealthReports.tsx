import { useSearchParams } from "react-router-dom";
import { usePageLoad } from "../../../shared/ui/PageLoad";
import OfficeReport, { filterSelect } from "../../dashboard/pages/OfficeReport";
import { manilaMonth, manilaYear } from "../lib/records";
import type { RecordKind } from "../types";
import HealthRecordReport, { type RecordReportChoice } from "./HealthRecordReport";
import BarangayMonthlyReport from "./BarangayMonthlyReport";

/**
 * The Health Station's Reports — one page, one row of filters.
 *
 * The monthly and yearly reports of the three record books used to sit
 * under each book in the sidebar, six entries for what is one question:
 * "which report, for when?". They are chosen here instead:
 *
 *   Report   Station summary · Child Health & Nutrition · Maternal Health ·
 *            Prenatal Records
 *   Period   Monthly · Yearly (the record books)
 *
 * The choice is kept in the address, so a report can be linked to, and the
 * old per-book addresses land on the right one.
 */

type ReportKind = "summary" | "barangay-monthly" | RecordKind;

const REPORTS: [ReportKind, string][] = [
  ["summary", "Health Station summary"],
  /* The station's own one-page form, as it hands it in. */
  ["barangay-monthly", "Barangay Monthly Report"],
  ["child", "Child Health & Nutrition"],
  ["maternal", "Maternal Health"],
  ["prenatal", "Prenatal Records"],
];

const isKind = (v: string | null): v is ReportKind => REPORTS.some(([k]) => k === v);

export default function HealthReports() {
  const [params, setParams] = useSearchParams();
  /* ONE first load for the page, whichever report it opens on. Changing the
     Report filter swaps the view below; it is still the same page, so the
     page's skeleton does not come back — the new report loads in place. */
  const pageLoad = usePageLoad();

  const report: ReportKind = isKind(params.get("report")) ? (params.get("report") as ReportKind) : "summary";
  const period = params.get("period") === "yearly" ? "yearly" : "monthly";
  const year = Number(params.get("year")) || manilaYear();
  const month = Math.min(12, Math.max(1, Number(params.get("month")) || manilaMonth()));
  const zone = params.get("zone") ?? "";

  /* Every change rewrites the address rather than adding a history entry:
     Back leaves the page, it does not step through filter changes. */
  const choose = (patch: Record<string, string | number>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === "" || value === null) next.delete(key);
      else next.set(key, String(value));
    });
    setParams(next, { replace: true });
  };

  const filters = (
    <>
      <select aria-label="Report" value={report} onChange={(e) => choose({ report: e.target.value })} className={filterSelect}>
        {REPORTS.map(([value, label]) => <option key={value} value={value}>Report: {label}</option>)}
      </select>
      {report !== "summary" && report !== "barangay-monthly" && (
        <select aria-label="Period" value={period} onChange={(e) => choose({ period: e.target.value })} className={filterSelect}>
          <option value="monthly">Period: Monthly</option>
          <option value="yearly">Period: Yearly</option>
        </select>
      )}
    </>
  );

  if (report === "summary") {
    return <OfficeReport filters={filters} pageLoad={pageLoad} />;
  }

  if (report === "barangay-monthly") {
    return (
      <BarangayMonthlyReport
        year={year}
        month={month}
        onChoose={(patch) => choose(patch as Record<string, string | number>)}
        filters={filters}
        pageLoad={pageLoad}
      />
    );
  }

  const choice: RecordReportChoice = { year, month, zone };

  return (
    <HealthRecordReport
      kind={report}
      period={period}
      choice={choice}
      onChoose={(patch) => choose(patch as Record<string, string | number>)}
      filters={filters}
      pageLoad={pageLoad}
    />
  );
}
