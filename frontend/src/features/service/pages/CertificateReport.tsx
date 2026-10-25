import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import PageHeader from "../../../shared/ui/PageHeader";
import DataTable from "../../../shared/ui/DataTable";
import { RowsSkeleton } from "../../../shared/ui/Skeleton";
import BandChart from "../../../shared/ui/BandChart";
import RankedBars from "../../../shared/ui/RankedBars";
import PrintableFigures from "../../../shared/ui/PrintableFigures";
import ReplayOnView from "../../../shared/ui/ReplayOnView";
import PeriodFilter, {
  ALL_TIME,
  periodParams,
  type Period,
} from "../../../shared/ui/PeriodFilter";
import { lastSeen } from "../../../shared/offline/lastSeen";
import { buildOfflineReport, heldCertificates, type CertificateReport } from "../lib/offlineReport";
import { serviceApi } from "../api";
import { JobseekerSummaryCard } from "../components/JobseekerSummaryCard";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

/**
 * The windows a clerk is asked about, in the order they are asked.
 *
 * All five are shown at once rather than behind a picker, because the
 * question is never just "how many today" — it is "how many today, and is
 * that a lot?" A picker would make that comparison the clerk's own job.
 */
const WINDOWS: { key: string; label: string; note: string }[] = [
  { key: "today", label: "Today", note: "since midnight" },
  { key: "week", label: "This week", note: "Monday to Sunday" },
  { key: "month", label: "This month", note: "calendar month" },
  { key: "half_year", label: "This half-year", note: "Jan–Jun or Jul–Dec" },
  { key: "year", label: "This year", note: "calendar year" },
];

export default function CertificateReport() {
  const [report, setReport] = useState<CertificateReport | null>(null);
  /* Starts on this month, which is what the page has always opened on. */
  const [period, setPeriod] = useState<Period>({ ...ALL_TIME, period: "month" });
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();
  /* Bumped by "Try again": the load is an effect, so this re-runs it. */
  const [attempt, setAttempt] = useState(0);
  /*
   * Set when the figures came off the device instead of the server.
   *
   * This report counts every certificate the barangay has, which is not
   * something the counter's own copy can work out. With no line it used to
   * fall through to "Nothing was requested in this period" — a report of
   * zero, which reads as a fact about the barangay rather than about the
   * connection. It now shows the last report the office actually saw for
   * the period asked for, dated; and if it has never seen one, it says so.
   */
  const [offline, setOffline] = useState(false);
  /** How many certificates the device counted, when it did the counting. */
  const [held, setHeld] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = periodParams(period);

    lastSeen<CertificateReport>(`certificates.report:${JSON.stringify(params)}`,
      () => serviceApi.certificateReport({ params }))
      .then(async (seen) => {
        if (!seen.stale) {
          setReport(seen.data);
          setOffline(false);
          setHeld(0);

          return;
        }

        /*
         * Counted here, from what the device holds.
         *
         * The certificate the clerk filed a minute ago is on this device and
         * nowhere else yet, and it is the one they are looking for. Showing
         * the last report the server gave would leave it out; showing zeros
         * would deny it outright.
         */
        const rows = await heldCertificates();
        setReport(buildOfflineReport(rows, period));
        setHeld(rows.length);
        setOffline(true);
      })
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [period, attempt]);

  /* Named by the server, so a month picked with no year says which year. */
  const chosenLabel = report?.window?.label ?? "";

  /*
   * The five windows as one chart.
   *
   * They are a ladder — today sits inside this week, inside this month — so
   * the line across their tops is the shape of how far back you have to look
   * before the number stops growing. Five separate tiles said the same
   * numbers and left that comparison to the clerk.
   */
  const ladder = WINDOWS.map((w) => ({
    label: w.label.replace("This ", ""),
    count: report?.counts[w.key] ?? 0,
  }));

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => setAttempt((n) => n + 1)} />;

  return (
    <div>
      <PageHeader
        title="Certificate Report"
        subtitle="How many certificates were asked for, and by whom"
      />

      {offline && (
        <div className="mb-4 rounded-2xl border border-warning/40 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-dark">
          <strong>No connection — counted on this device.</strong> These are the{" "}
          {held} certificate{held === 1 ? "" : "s"} this device holds: the counter&rsquo;s recent
          ones and anything filed here that has not been sent yet. The barangay&rsquo;s full
          totals need the line, so take this as what happened at this counter, not as the
          whole barangay&rsquo;s figures.
        </div>
      )}

      {/*
        Counted from when the certificate was ASKED for, not when it was
        released. A clerk reporting volume is reporting demand — a request
        made today and collected next week belongs to today.
      */}
      <Card className="mb-6">
        <p className="mb-4 text-xs leading-relaxed text-gray-500">
          Counted from the day each certificate was <strong>requested</strong>, not the day
          it was released — so a request made today and collected next week is counted
          today. Dates are Philippine time.
        </p>

        <h3 className="mb-1 text-sm font-semibold text-dark">How far back you have to look</h3>
        <p className="mb-2 text-[11px] text-gray-400">
          Always counted up to today, whichever period is chosen below.
        </p>

        {loading && !report ? (
          <RowsSkeleton rows={4} what="the counts" />
        ) : (
          <>
            <ReplayOnView className="print-hide">
              <BandChart data={ladder} unit="certificates" minHeight={220} angledLabels />
            </ReplayOnView>
            <PrintableFigures rows={ladder} labelHeader="Period" unitHeader="Certificates" />
          </>
        )}

        {/*
          A week runs Monday to Sunday, so at the start of a month it reaches
          back into the last one and can read higher than "this month". That
          is a week being a week, not a miscount — said here rather than left
          for somebody to discover and distrust.
        */}
        <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
          A week that straddles two months can total more than the month it ends in.
        </p>
      </Card>

      {/*
        One picker, the same one the VAWC and Lupon dockets use — and the only
        one that can reach a month or a year that is not this one.
      */}
      <div className="print-hide">
      <PeriodFilter
        value={period}
        onChange={setPeriod}
        years={report?.years ?? []}
        /* How many sit in each window, on the chip itself — the same figures
           the ladder above plots, so the strip is readable without it. */
        counts={report?.counts}
        showing={chosenLabel}
        count={report?.by_type.reduce((sum, row) => sum + row.total, 0)}
        noun="certificate"
      />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Certificate Requests by Type · ${chosenLabel}`} className="flex h-full flex-col">
          {report?.by_type.length ? (
            <>
              {/*
                Ranked bars, not columns. These names run to
                "Barangay Clearance with Picture", and under a column axis they
                turned sideways and were clipped mid-word — the axis reads
                "...gay Clearance", which is a different document. Read across,
                the name has the whole row and the order carries the meaning.
              */}
              <ReplayOnView className="flex min-h-0 flex-1 flex-col print-hide">
                <RankedBars
                  data={[...report.by_type]
                    .sort((a, b) => b.total - a.total)
                    .map((row) => ({
                      label: row.certificate_type,
                      count: row.total,
                    }))}
                  unit="certificates"
                />
              </ReplayOnView>
              <PrintableFigures
                /* Same order as the chart, or the printout and the screen
                   rank the same certificates differently. */
                rows={[...report.by_type]
                  .sort((a, b) => b.total - a.total)
                  .map((row) => ({
                    label: row.certificate_type,
                    count: row.total,
                  }))}
                labelHeader="Certificate"
                unitHeader="Requested"
              />
            </>
          ) : (
            /* Loading and empty are different answers and had the same words. */
            loading ? (
              <RowsSkeleton rows={4} what="the breakdown" />
            ) : (
              <p className="text-sm text-gray-400">Nothing was requested in this period.</p>
            )
          )}
        </Card>

        <Card title={`Where each one stands · ${chosenLabel}`} className="flex h-full flex-col">
          {Object.keys(report?.by_status ?? {}).length ? (
            <>
              <ReplayOnView className="flex min-h-0 flex-1 flex-col print-hide">
                <BandChart
                  data={Object.entries(report!.by_status).map(([status, total]) => ({
                    label: status,
                    count: total,
                  }))}
                  unit="certificates"
                  minHeight={260}
                  angledLabels
                />
              </ReplayOnView>
              <PrintableFigures
                rows={Object.entries(report!.by_status).map(([status, total]) => ({
                  label: status,
                  count: total,
                }))}
                labelHeader="Status"
                unitHeader="Certificates"
              />
            </>
          ) : (
            loading ? (
              <RowsSkeleton rows={3} what="the breakdown" />
            ) : (
              <p className="text-sm text-gray-400">Nothing to show.</p>
            )
          )}
        </Card>
      </div>

      {/*
        Who asked, and how often.

        Read two ways: it answers "how many has this resident asked for", and
        a name near the top is worth a second look — the same clearance
        requested four times in a month is usually one that was never
        collected.
      */}
      <Card title={`Who requested · ${chosenLabel}`} className="mt-6">
        <DataTable
          columns={[
            {
              header: "Resident",
              render: (r: CertificateReport["by_resident"][number]) => (
                <Link
                  to={`/population/residents/${r.resident_id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {r.name}
                </Link>
              ),
            },
            {
              header: "Resident Number",
              render: (r: CertificateReport["by_resident"][number]) => r.resident_number ?? "—",
            },
            {
              header: "Requested",
              render: (r: CertificateReport["by_resident"][number]) => (
                <span className="font-bold text-dark">{r.total}</span>
              ),
            },
          ]}
          rows={report?.by_resident ?? []}
          rowKey={(r) => r.resident_id}
          numbered
          total={(report?.by_resident ?? []).length}
          loading={loading}
          emptyMessage="Nobody requested a certificate in this period."
        />

        <p className="mt-3 text-[11px] text-gray-400">
          The twenty who asked most in this period.
        </p>
      </Card>

      <div className="print-hide">
        <JobseekerSummaryCard />
      </div>
    </div>
  );
}
