import { useEffect, useState } from "react";
import { FiPrinter } from "react-icons/fi";
import Card from "../../../shared/ui/Card";
import PageHeader from "../../../shared/ui/PageHeader";
import { RowsSkeleton } from "../../../shared/ui/Skeleton";
import { dashboardApi } from "../api";

type Section = "lupon" | "vawc" | "health";

interface Consolidated {
  period: { from: string; to: string; label: string };
  /* Which sections THIS office may read, decided by the server from the
     office it signed in as. The page draws a tab per entry and nothing
     else — a desk cannot reach another's figures by editing the address. */
  sections: Section[];
  lupon?: {
    filed: number;
    by_classification: { label: string; total: number }[];
    settled: number;
    open_now: number;
    referred_out: number;
    hearings_held: number;
    hearings_scheduled: number;
    fees_settled: number;
  };
  vawc?: { opened: number; open_now: number; note: string };
  health?: { visits: number; immunizations: number; maternal_records: number };
}

const TAB_LABELS: Record<Section, string> = {
  lupon: "Katarungang Pambarangay",
  vawc: "VAWC Desk",
  health: "Health Station",
};

/** One labelled figure in a report table. */
function Line({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <tr>
      <td className="border-b border-gray/60 py-2 pr-4 text-sm text-gray-600">
        {label}
        {hint && <span className="block text-xs text-gray-400">{hint}</span>}
      </td>
      <td className="border-b border-gray/60 py-2 text-right text-sm font-bold tabular-nums text-dark">
        {value}
      </td>
    </tr>
  );
}

/**
 * The barangay's three desks in one return.
 *
 * The Secretary writes the reports and the Punong Barangay signs them, and
 * both were doing it by opening three screens and copying figures across —
 * which is exactly where a transcription error becomes a submitted return.
 *
 * ALL TABLES, NO CHARTS. This page exists to be printed and filed. A bar
 * chart on a barangay's mono laser is a row of grey blocks; a table of
 * figures is still a table of figures a year later.
 *
 * THE VAWC SECTION IS TWO NUMBERS, and that is deliberate. A consolidated
 * report is read in session and filed where others can see it. How many
 * cases the desk opened is a figure the barangay is entitled to; anything
 * that could identify one of them is not, and never appears here.
 */
export default function ConsolidatedReport() {
  const [report, setReport] = useState<Consolidated | null>(null);
  const [loading, setLoading] = useState(true);
  /* Null until the first answer says which sections this office has. */
  const [tab, setTab] = useState<Section | null>(null);

  useEffect(() => {
    dashboardApi.consolidatedReport()
      .then((r) => {
        const data: Consolidated = r.data.data;
        setReport(data);
        /*
         * The first section the office may read.
         *
         * A desk with one section never sees a tab strip at all — there is
         * nothing to choose between, and a single tab is a control that
         * does nothing.
         */
        setTab(data.sections?.[0] ?? null);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const sections = report?.sections ?? [];

  return (
    <div>
      <PageHeader
        title="Consolidated Report"
        subtitle={
          report
            ? `${sections.map((x) => TAB_LABELS[x]).join(", ")} — ${report.period.label}`
            : "Figures for your office"
        }
        actions={
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPrinter className="h-4 w-4" aria-hidden="true" /> Print report
          </button>
        }
      />

      {loading ? (
        <Card><RowsSkeleton rows={6} what="the figures" /></Card>
      ) : !report ? (
        <Card>
          <p className="py-8 text-center text-sm text-gray-400">
            The report could not be loaded.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/*
            A tab per section the office may read — and none at all when it
            may read only one. A single tab is a control that does nothing,
            and the heading already names what is on screen.
          */}
          {sections.length > 1 && (
            <div className="flex flex-wrap gap-2 print-hide">
              {sections.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                    tab === key ? "bg-primary text-white" : "bg-secondary text-dark hover:bg-primary/10"
                  }`}
                >
                  {TAB_LABELS[key]}
                </button>
              ))}
            </div>
          )}

          {tab === "lupon" && report.lupon && (
            <Card title="Katarungang Pambarangay" className="print-plain">
              <table className="w-full">
                <tbody>
                  <Line label="Cases filed" value={report.lupon.filed} />
                  <Line label="Cases settled" value={report.lupon.settled} />
                  <Line
                    label="Cases referred out"
                    value={report.lupon.referred_out}
                    hint="To the VAWC desk, or to the barangay with jurisdiction"
                  />
                  <Line label="Cases still open" value={report.lupon.open_now} hint="At the end of the period" />
                  <Line label="Hearings held" value={report.lupon.hearings_held} />
                  <Line label="Hearings scheduled" value={report.lupon.hearings_scheduled} />
                  {/*
                    A COUNT, not a sum. The barangay keeps its own book of the
                    money; this system never touched a peso, so a figure in
                    pesos here could only disagree with the real one.
                  */}
                  <Line
                    label="Filing fees settled"
                    value={report.lupon.fees_settled}
                    hint="Complainants the Clerk has marked paid"
                  />
                </tbody>
              </table>

              {report.lupon.by_classification.length > 0 && (
                <>
                  <p className="mb-2 mt-5 text-sm font-semibold text-dark">Cases by nature</p>
                  <table className="w-full">
                    <tbody>
                      {report.lupon.by_classification.map((row) => (
                        <Line key={row.label} label={row.label} value={row.total} />
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </Card>
          )}

          {tab === "vawc" && report.vawc && (
            <Card title="VAWC Desk" className="print-plain">
              <table className="w-full">
                <tbody>
                  <Line label="Cases opened" value={report.vawc.opened} />
                  <Line label="Cases still open" value={report.vawc.open_now} />
                </tbody>
              </table>
              <p className="mt-3 rounded-xl bg-secondary px-3.5 py-2.5 text-xs leading-relaxed text-gray-600">
                {report.vawc.note}
              </p>
            </Card>
          )}

          {tab === "health" && report.health && (
            <Card title="Health Station" className="print-plain">
              <table className="w-full">
                <tbody>
                  <Line label="Patient visits" value={report.health.visits} />
                  <Line label="Immunizations given" value={report.health.immunizations} />
                  <Line label="Maternal records" value={report.health.maternal_records} />
                </tbody>
              </table>
            </Card>
          )}

          <p className="text-xs text-gray-400">
            Covering {report.period.from} to {report.period.to}.
          </p>
        </div>
      )}
    </div>
  );
}
