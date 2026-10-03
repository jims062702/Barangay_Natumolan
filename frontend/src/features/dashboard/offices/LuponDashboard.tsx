import { useEffect, useState } from "react";
import { FiAlertCircle, FiBookOpen, FiCalendar, FiClock } from "react-icons/fi";
import { Link } from "react-router-dom";
import { formatWallClock, parseWallClock } from "../../../shared/lib/datetime";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { PageLoading, settleAll, usePageLoad } from "../../../shared/ui/PageLoad";
import Card from "../../../shared/ui/Card";
import StatTile from "../../../shared/ui/StatTile";
import PageHeader from "../../../shared/ui/PageHeader";
import RevealGroup from "../../../shared/ui/RevealGroup";
import { luponApi } from "../../lupon/api";
import { dashboardApi } from "../api";
import type { LuponHearing, LuponSettlement } from "../../lupon/types";

interface Deadlines {
  upcoming_hearings: LuponHearing[];
  repudiation_window: LuponSettlement[];
  pending_compliance: LuponSettlement[];
}

function daysLeft(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

export default function LuponDashboard() {
  const [deadlines, setDeadlines] = useState<Deadlines | null>(null);
  const [pendingCases, setPendingCases] = useState(0);

  // Live updates: bump `tick` to re-run the fetches below.
  const [tick, setTick] = useState(0);
  useAutoRefresh(() => setTick((t) => t + 1), REFRESH.dashboard);

  /* And within a second when somebody else touches one. */
  usePulse("lupon_cases", () => setTick((t) => t + 1));

  /* Its skeleton until the first answer, then the page — see PageLoad. A
     refresh after that keeps the page; only a first load that gets NO
     answer at all shows the error. */
  const pageLoad = usePageLoad();

  useEffect(() => {
    void Promise.allSettled([
      luponApi.deadlines().then((r) => setDeadlines(r.data.data)),
      dashboardApi.summary().then((r) => setPendingCases(r.data.data.quick_stats?.pending_cases ?? 0)),
    ]).then((results) => settleAll(pageLoad, results));
  }, [tick]);

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => setTick((t) => t + 1)} />;

  return (
    <div>
      <PageHeader
        title="Lupon Tagapamayapa Dashboard"
        subtitle="Docket, hearings, and settlement deadlines under the Katarungang Pambarangay"
        actions={
          <Link
            to="/lupon/cases"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiBookOpen className="h-4 w-4" aria-hidden="true" /> Open case docket
          </Link>
        }
      />

      <RevealGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active Docket" value={pendingCases} icon={FiBookOpen} />
        <StatTile label="Upcoming Hearings" value={deadlines?.upcoming_hearings.length ?? 0} icon={FiCalendar} tone="warning" />
        <StatTile label="In Repudiation Window" value={deadlines?.repudiation_window.length ?? 0} icon={FiClock} tone="danger" />
        <StatTile label="Pending Compliance" value={deadlines?.pending_compliance.length ?? 0} icon={FiAlertCircle} tone="success" />
      </RevealGroup>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Hearings schedule">
          {(() => {
            const upcoming = deadlines?.upcoming_hearings ?? [];
            const pbHearings = upcoming.filter((h) => h.hearing_type === "Mediation");
            const luponHearings = upcoming.filter((h) => h.hearing_type === "Conciliation");

            if (upcoming.length === 0) {
              return <p className="py-6 text-center text-sm text-gray-400">No hearings scheduled.</p>;
            }

            return (
              <div className="space-y-5">
                {/* Punong Barangay section */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-dark">Punong Barangay (Tuesday)</span>
                    <span className="text-[11px] text-gray-500 font-medium">{pbHearings.length} scheduled</span>
                  </div>
                  {pbHearings.length === 0 ? (
                    <p className="rounded-lg bg-gray-50 p-2.5 text-xs text-gray-400">No Punong Barangay hearings scheduled.</p>
                  ) : (
                    <ul className="divide-y divide-gray/70">
                      {pbHearings.map((h) => {
                        const hearingDate = parseWallClock(h.scheduled_at);
                        const dateFormatted = hearingDate && !isNaN(hearingDate.getTime())
                          ? hearingDate.toLocaleDateString("en-PH", {
                              weekday: "long",
                              month: "short",
                              day: "numeric",
                            })
                          : "";
                        const timeText = dateFormatted
                          ? `${dateFormatted} · ${h.schedule_time_range || formatWallClock(h.scheduled_at)}`
                          : (h.formatted_schedule ?? formatWallClock(h.scheduled_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }));

                        return (
                          <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                            <div>
                              <p className="text-sm font-semibold text-dark">
                                {timeText}
                              </p>
                              <p className="text-xs text-gray-500">
                                {h.lupon_case?.id ? (
                                  <Link
                                    to={`/lupon/cases/${h.lupon_case.id}`}
                                    className="font-semibold text-primary hover:underline"
                                  >
                                    {h.lupon_case.case_number}
                                  </Link>
                                ) : (
                                  <span className="font-semibold text-primary">{h.lupon_case?.case_number}</span>
                                )}
                                {h.lupon_case?.case_title ? ` · ${h.lupon_case.case_title}` : ""}
                              </p>
                            </div>
                            <span className="shrink-0 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                              {h.schedule_time_range ?? "2 hrs"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Lupon section */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-dark">Lupon (Thursday)</span>
                    <span className="text-[11px] text-gray-500 font-medium">{luponHearings.length} scheduled (Max 7/day)</span>
                  </div>
                  {luponHearings.length === 0 ? (
                    <p className="rounded-lg bg-gray-50 p-2.5 text-xs text-gray-400">No Lupon hearings scheduled.</p>
                  ) : (
                    <ul className="divide-y divide-gray/70">
                      {luponHearings.map((h) => {
                        const hearingDate = parseWallClock(h.scheduled_at);
                        const dateFormatted = hearingDate && !isNaN(hearingDate.getTime())
                          ? hearingDate.toLocaleDateString("en-PH", {
                              weekday: "long",
                              month: "short",
                              day: "numeric",
                            })
                          : "";
                        const timeText = dateFormatted
                          ? `${dateFormatted} · ${h.schedule_time_range || formatWallClock(h.scheduled_at)}`
                          : (h.formatted_schedule ?? formatWallClock(h.scheduled_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }));

                        return (
                          <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                            <div>
                              <p className="text-sm font-semibold text-dark">
                                {timeText}
                              </p>
                              <p className="text-xs text-gray-500">
                                {h.lupon_case?.id ? (
                                  <Link
                                    to={`/lupon/cases/${h.lupon_case.id}`}
                                    className="font-semibold text-primary hover:underline"
                                  >
                                    {h.lupon_case.case_number}
                                  </Link>
                                ) : (
                                  <span className="font-semibold text-primary">{h.lupon_case?.case_number}</span>
                                )}
                                {h.lupon_case?.case_title ? ` · ${h.lupon_case.case_title}` : ""}
                              </p>
                            </div>
                            <span className="shrink-0 rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 border border-purple-200">
                              {h.schedule_time_range ?? "2 hrs"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            );
          })()}
        </Card>

        <Card title="10-day repudiation countdown">
          {(deadlines?.repudiation_window ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              No settlements inside the repudiation period.
            </p>
          ) : (
            <ul className="divide-y divide-gray/70">
              {deadlines?.repudiation_window.map((settlement) => {
                const days = daysLeft(settlement.repudiation_deadline);
                return (
                  <li key={settlement.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-semibold text-dark">
                        {settlement.lupon_case?.case_number} — {settlement.settlement_type}
                      </p>
                      <p className="text-xs text-gray-500">
                        Agreed {new Date(settlement.date_agreed).toLocaleDateString("en-PH")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                        days <= 2 ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
                      }`}
                    >
                      {days} day{days === 1 ? "" : "s"} left
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-gray-400">
            An amicable settlement becomes final after 10 days unless properly
            repudiated — lapsed settlements are finalized automatically.
          </p>
        </Card>
      </div>
    </div>
  );
}
