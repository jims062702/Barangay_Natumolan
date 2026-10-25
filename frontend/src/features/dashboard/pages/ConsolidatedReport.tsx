import { useEffect, useState } from "react";
import { FiPrinter } from "react-icons/fi";
import Card from "../../../shared/ui/Card";
import PageHeader from "../../../shared/ui/PageHeader";
import { RowsSkeleton } from "../../../shared/ui/Skeleton";
import { dashboardApi } from "../api";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";
import {
  MonthPicker,
  ReportSection,
  SECTION_LABELS,
  monthRange,
  type Report,
  type Section,
} from "../components/ReportSections";
import { printConsolidatedReport } from "../lib/consolidatedPrint";

/**
 * The consolidated return: every office's figures, for the Secretary to write
 * up and the Punong Barangay to sign.
 *
 * THEIRS ALONE. It used to be handed to the Lupon, VAWC and Health desks as
 * well, each seeing its own slice under a menu entry called "Consolidated
 * Report" that consolidated nothing — while Population and the Clerk's
 * certificates were not in it at all. Now it gathers all five offices, and
 * each office keeps a report of its own.
 *
 * "All offices" first, because that is the return that gets printed and
 * filed. A tab per office beside it, for reading one department at a time.
 */
type Tab = "all" | Section;

export default function ConsolidatedReport() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();
  /* Bumped by "Try again": the load is an effect, so this re-runs it. */
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<Tab>("all");
  const [month, setMonth] = useState(() => new Date().toLocaleDateString("en-CA").slice(0, 7));

  useEffect(() => {
    setLoading(true);
    dashboardApi.consolidatedReport({ params: monthRange(month) })
      .then((r) => setReport(r.data.data))
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [month, attempt]);

  const sections = report?.sections ?? [];
  const shown: Section[] = tab === "all" ? sections : [tab];

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => setAttempt((n) => n + 1)} />;

  return (
    <div>
      <PageHeader
        title="Consolidated Reports"
        /* The month moved down here from the heading: the page is called
           what the menu calls it, and WHICH month is a description of this
           reading of it rather than a second name for the page. */
        subtitle={report
          ? `Every office's figures in one return — ${report.period.label}`
          : "Every office's figures in one return"}
        actions={
          <button
            type="button"
            onClick={() => (report ? printConsolidatedReport(report, tab) : window.print())}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPrinter className="h-4 w-4" aria-hidden="true" /> Print report
          </button>
        }
      />

      <div className="print-hide mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", ...sections] as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                tab === key ? "bg-primary text-white" : "bg-secondary text-dark hover:bg-primary/10"
              }`}
            >
              {key === "all" ? "All offices" : SECTION_LABELS[key]}
            </button>
          ))}
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {loading ? (
        <Card><RowsSkeleton rows={6} what="the figures" /></Card>
      ) : !report ? (
        <Card>
          <p className="py-8 text-center text-sm text-gray-400">The report could not be loaded.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {shown.map((section) => (
            <ReportSection key={section} section={section} report={report} />
          ))}
          <p className="text-xs text-gray-400">
            Covering {report.period.from} to {report.period.to}.
          </p>
        </div>
      )}
    </div>
  );
}
