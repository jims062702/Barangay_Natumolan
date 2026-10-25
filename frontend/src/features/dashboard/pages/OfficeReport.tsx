import { useEffect, useState, type ReactNode } from "react";
import { FiPrinter } from "react-icons/fi";
import Card from "../../../shared/ui/Card";
import PageHeader from "../../../shared/ui/PageHeader";
import { RowsSkeleton } from "../../../shared/ui/Skeleton";
import { useZoneNames } from "../../population/lib/useZones";
import { dashboardApi } from "../api";
import { PageLoading, usePageLoad, type PageLoad } from "../../../shared/ui/PageLoad";
import {
  MonthPicker,
  POPULATION_PARTS,
  ReportSection,
  SECTION_LABELS,
  monthRange,
  type PopulationPart,
  type Report,
} from "../components/ReportSections";
import { printConsolidatedReport } from "../lib/consolidatedPrint";

export const filterSelect =
  "cursor-pointer rounded-full border border-gray bg-white px-4 py-2 text-sm text-dark outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25";

/**
 * An office's OWN report — for the Health Station and the Population Office,
 * the two that had none.
 *
 * Which office's report it is comes from the server, from the office signed
 * in — not from the address — so a desk cannot open another's by editing the
 * URL. The figures are built by the same code as that office's section of the
 * consolidated return, so the two never disagree about the same month.
 */
export default function OfficeReport({ filters, pageLoad: shared }: {
  /* Controls a page wrapping this one puts first in the filter row — the
     Health Station's choice of which report to read. */
  filters?: ReactNode;
  /* The wrapping page's first load, when it has one: switching to this
     report from another is a filter change, not a new page, and must not
     bring the page's skeleton back. */
  pageLoad?: PageLoad;
} = {}) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const own = usePageLoad();
  const pageLoad = shared ?? own;
  /* Bumped by "Try again": the load is an effect, so this re-runs it. */
  const [attempt, setAttempt] = useState(0);
  const [month, setMonth] = useState(() => new Date().toLocaleDateString("en-CA").slice(0, 7));
  /*
   * The Population Office's two filters. What is chosen is what is drawn,
   * and so what is PRINTED — one zone's report for that zone's captain, the
   * age table alone for a programme that asks only for that — and the title
   * says which, so a printout is never mistaken for the whole barangay's.
   */
  const [zone, setZone] = useState("");
  const [part, setPart] = useState<PopulationPart>("all");
  const zones = useZoneNames();

  useEffect(() => {
    setLoading(true);
    dashboardApi.officeReport({ params: { ...monthRange(month), zone: zone || undefined } })
      .then((r) => setReport(r.data.data))
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [month, zone, attempt]);

  const section = report?.sections?.[0];
  const isPopulation = section === "population";

  const narrowedTo = isPopulation
    ? [
        zone || null,
        part !== "all" ? POPULATION_PARTS.find(([value]) => value === part)?.[1] : null,
      ].filter(Boolean).join(" · ")
    : "";

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => setAttempt((n) => n + 1)} />;

  return (
    <div>
      <PageHeader
        /*
          THE PAGE IS CALLED WHAT THE MENU CALLS IT.

          The heading read "Health Station Report — September 2026" under a
          trail that said "Health Station > Reports", so the reader had two
          names for one page and had to work out which was theirs. Which
          month, which office and which zone are a description of THIS
          reading of the page, so they moved to the line below.
        */
        title="Reports"
        subtitle={[
          section ? `${SECTION_LABELS[section]}’s figures` : "This office’s figures",
          report ? `for ${report.period.label}` : "for the month",
          isPopulation && zone ? `· ${zone} only` : "",
          !isPopulation && narrowedTo ? `· ${narrowedTo}` : "",
        ].filter(Boolean).join(" ")}
        actions={
          <button
            type="button"
            onClick={() => (report && section ? printConsolidatedReport(report, section) : report ? printConsolidatedReport(report, "all") : window.print())}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPrinter className="h-4 w-4" aria-hidden="true" /> Print report
          </button>
        }
      />

      <div className="print-hide mb-6 flex flex-wrap items-center justify-end gap-2">
        {filters}
        {isPopulation && (
          <>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              aria-label="Report on one zone"
              className={filterSelect}
            >
              <option value="">Zone: All zones</option>
              {zones.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select
              value={part}
              onChange={(e) => setPart(e.target.value as PopulationPart)}
              aria-label="Which part of the report to show and print"
              className={filterSelect}
            >
              {POPULATION_PARTS.map(([value, label]) => (
                <option key={value} value={value}>Show: {label}</option>
              ))}
            </select>
          </>
        )}
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {loading ? (
        <Card><RowsSkeleton rows={6} what="the figures" /></Card>
      ) : !report || !section ? (
        <Card>
          <p className="py-8 text-center text-sm text-gray-400">The report could not be loaded.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <ReportSection section={section} report={report} part={isPopulation ? part : "all"} />
          <p className="text-xs text-gray-400">
            Covering {report.period.from} to {report.period.to}.
          </p>
        </div>
      )}
    </div>
  );
}
