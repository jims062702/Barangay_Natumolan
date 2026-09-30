import { useEffect, useState, type ReactNode } from "react";
import { FiDownload, FiPrinter } from "react-icons/fi";
import { errorMessage } from "../../../shared/lib/api";
import { formatWallClock } from "../../../shared/lib/datetime";
import { toast } from "../../../shared/lib/toast";
import { usePulse } from "../../../shared/hooks/usePulse";
import Card from "../../../shared/ui/Card";
import PageHeader from "../../../shared/ui/PageHeader";
import { filterSelect } from "../../dashboard/pages/OfficeReport";
import { download } from "../../resident/components/transfer/download";
import { useZoneNames } from "../../population/lib/useZones";
import { healthApi } from "../api";
import { filterYears, fmtDate, MONTHS } from "../lib/records";
import type { HealthReport, RecordKind } from "../types";
import { PageLoading, usePageLoad, type PageLoad } from "../../../shared/ui/PageLoad";

/**
 * The station's monthly and yearly reports — Child Health & Nutrition,
 * Maternal Health, Prenatal Records — read on the Reports page.
 *
 * Every figure is a count of records by their own date, done on the server;
 * the Excel and CSV files are the same report, built from the same data, so
 * a download cannot say something this page does not. PDF is the browser's
 * print, as every other report in the system is.
 *
 * The choices live on the Reports page (and in its address), so a report
 * can be linked to and comes back as it was left.
 */

const DATE_KEYS = new Set(["record_date", "birth_date", "registered", "lmp", "edc", "visit_date"]);

export interface RecordReportChoice {
  year: number;
  month: number;
  zone: string;
}

export default function HealthRecordReport({
  kind,
  period,
  choice,
  onChoose,
  filters,
  pageLoad: shared,
}: {
  kind: RecordKind;
  period: "monthly" | "yearly";
  choice: RecordReportChoice;
  onChoose: (patch: Partial<RecordReportChoice>) => void;
  /** Which report, and which period — put first in the filter row. */
  filters: ReactNode;
  /** The Reports page's first load, shared with the station summary. */
  pageLoad?: PageLoad;
}) {
  const zones = useZoneNames();
  const { year, month, zone } = choice;
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const own = usePageLoad();
  const pageLoad = shared ?? own;

  const params = { year, month: period === "monthly" ? month : undefined, zone_purok: zone || undefined };

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    healthApi.recordsReport(kind, { params })
      .then((r) => setReport(r.data.data))
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch((err) => !silent && toast(errorMessage(err), "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    /* A different report is not this one reloading: the old figures go
       rather than sit under the new title while the new ones come. */
    setReport(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, period, year, month, zone]);

  usePulse("health", () => load(true));

  const exportAs = async (format: "csv" | "xlsx") => {
    const query = new URLSearchParams(
      Object.entries({ ...params, format }).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]),
    );
    try {
      await download(`/health/reports/records/${kind}?${query}`, `${kind}-report.${format}`);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const heading = report?.title
    ?? `${kind === "child" ? "Child Health & Nutrition" : kind === "maternal" ? "Maternal Health" : "Prenatal Records"} ${period === "monthly" ? "Monthly" : "Annual"} Report`;
  const button = "inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray px-4 py-2 text-sm font-semibold text-dark transition-colors hover:border-primary hover:text-primary";
  const peak = Math.max(1, ...(report?.months ?? []).map((m) => m.total));

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => load()} />;

  return (
    <div>
      {/* On paper a monthly register is thirteen columns wide: landscape,
          and cells that wrap rather than run off the sheet. Only while this
          report is open. */}
      <style>{`@media print { @page { size: A4 landscape; margin: 10mm; } }`}</style>
      <PageHeader
        /* The page is called what the menu calls it; which report this is
           goes on the line below, as the station summary does. */
        title="Reports"
        subtitle={`${heading} — counted from the records, by each record's own date`}
        actions={
          <div className="flex flex-wrap gap-2 print-hide">
            <button type="button" onClick={() => window.print()} className={button}>
              <FiPrinter className="h-4 w-4" aria-hidden="true" /> Print / PDF
            </button>
            <button type="button" onClick={() => exportAs("xlsx")} className={button}>
              <FiDownload className="h-4 w-4" aria-hidden="true" /> Excel
            </button>
            <button type="button" onClick={() => exportAs("csv")} className={button}>
              <FiDownload className="h-4 w-4" aria-hidden="true" /> CSV
            </button>
          </div>
        }
      />

      <div className="print-hide mb-6 flex flex-wrap items-center justify-end gap-2">
        {filters}
        <select aria-label="Year" value={year} onChange={(e) => onChoose({ year: Number(e.target.value) })} className={filterSelect}>
          {filterYears().map((y) => <option key={y} value={y}>Year: {y}</option>)}
        </select>
        {period === "monthly" && (
          <select aria-label="Month" value={month} onChange={(e) => onChoose({ month: Number(e.target.value) })} className={filterSelect}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>Month: {m}</option>)}
          </select>
        )}
        <select aria-label="Zone / Purok" value={zone} onChange={(e) => onChoose({ zone: e.target.value })} className={filterSelect}>
          <option value="">Zone: All zones</option>
          {zones.map((z) => <option key={z} value={z}>Zone: {z}</option>)}
        </select>
      </div>

      <Card className="print-plain">
        {!report ? (
          <p className="py-10 text-center text-sm text-gray-400">{loading ? "Generating the report…" : "The report could not be generated."}</p>
        ) : (
          <div className="space-y-6" data-testid="health-report">
            <header className="border-b border-gray pb-4 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{report.barangay}</p>
              <h2 className="mt-1 text-lg font-bold text-dark">{report.title}</h2>
              <p className="text-sm text-gray-600">
                {report.period === "monthly" ? "Month" : "Year"}: <span className="font-semibold">{report.period_label}</span>
                {" · "}Zone: <span className="font-semibold">{report.zone_label}</span>
              </p>
              <p className="text-xs text-gray-500">Generated {formatWallClock(report.generated_at)}</p>
            </header>

            <div className="flex items-baseline gap-3">
              <span className="text-sm text-gray-600">
                {report.kind === "child" ? "Total Child Health Records" : report.kind === "maternal" ? "Total Maternal Records" : "Total Prenatal Records"}
                {report.period === "yearly" ? " for the Year" : ""}
              </span>
              <span className="text-3xl font-bold tabular-nums text-primary" data-testid="report-total">{report.total}</span>
            </div>

            {report.period === "monthly" ? (
              report.rows && report.rows.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-gray">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        {report.columns?.map((c) => <th key={c.key} className="whitespace-nowrap px-3 py-2 print:whitespace-normal print:px-1">{c.label}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray/70">
                      {report.rows.map((row, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 tabular-nums text-gray-500">{i + 1}</td>
                          {report.columns?.map((c) => (
                            <td key={c.key} className="whitespace-nowrap px-3 py-2 tabular-nums print:whitespace-normal print:px-1 print:py-1 print:text-[9pt]">
                              {row[c.key] === null || row[c.key] === "" ? "—" : DATE_KEYS.has(c.key) ? fmtDate(String(row[c.key])) : String(row[c.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-gray py-8 text-center text-sm text-gray-500" data-testid="report-empty">
                  No records found for the selected period.
                </p>
              )
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Month</th>
                      <th className="px-3 py-2 text-right">Records</th>
                      <th className="px-3 py-2 print-hide"><span className="sr-only">Share of the year</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray/70">
                    {report.months?.map((m) => (
                      <tr key={m.month}>
                        <td className="px-3 py-2">{m.label}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{m.total}</td>
                        <td className="w-1/2 px-3 py-2 print-hide">
                          <div className="h-2 rounded-full bg-secondary">
                            <div className="h-2 rounded-full bg-primary" style={{ width: `${(m.total / peak) * 100}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-secondary/40 font-bold">
                      <td className="px-3 py-2">TOTAL</td>
                      <td className="px-3 py-2 text-right tabular-nums">{report.total}</td>
                      <td className="print-hide" />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {report.summaries.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {report.summaries.map((s) => (
                  <section key={s.title} className="rounded-2xl border border-gray p-4">
                    <h3 className="mb-2 text-sm font-semibold text-dark">{s.title}</h3>
                    {s.rows.length === 0 ? (
                      <p className="text-xs text-gray-400">No records.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray/70">
                          {s.rows.map((r) => (
                            <tr key={r.label}>
                              <td className="py-1.5">{r.label}</td>
                              <td className="py-1.5 text-right font-semibold tabular-nums">{r.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-400">
              A descriptive count of what was recorded. Nothing in this report is a diagnosis or an assessment.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
