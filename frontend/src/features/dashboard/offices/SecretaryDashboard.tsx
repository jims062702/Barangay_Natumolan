import { useEffect, useState } from "react";
import { FiCalendar, FiClock, FiFileText, FiMail, FiBookOpen } from "react-icons/fi";
import { Link } from "react-router-dom";
import PageHeader from "../../../shared/ui/PageHeader";
import { PageLoading, settleAll, usePageLoad } from "../../../shared/ui/PageLoad";
import StatTile from "../../../shared/ui/StatTile";
import Card from "../../../shared/ui/Card";
import StatusBadge from "../../../shared/ui/StatusBadge";
import RevealGroup from "../../../shared/ui/RevealGroup";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { luponApi } from "../../lupon/api";
import { councilApi } from "../../council/api";
import type { LuponHearing } from "../../lupon/types";
import type { Session } from "../../council/types";

export default function SecretaryDashboard() {
  const [todayHearings, setTodayHearings] = useState<LuponHearing[]>([]);
  const [upcomingHearings, setUpcomingHearings] = useState<LuponHearing[]>([]);
  const [unservedSummons, setUnservedSummons] = useState<LuponHearing[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [tick, setTick] = useState(0);

  const pageLoad = usePageLoad();

  useAutoRefresh(() => setTick((t) => t + 1), REFRESH.dashboard);
  usePulse("lupon_cases", () => setTick((t) => t + 1));

  useEffect(() => {
    void Promise.allSettled([
      luponApi.hearings({ params: { when: "today" } }).then((r) => {
        setTodayHearings(r.data.data.data ?? []);
      }),
      luponApi.hearings({ params: { when: "upcoming" } }).then((r) => {
        setUpcomingHearings(r.data.data.data ?? []);
      }),
      luponApi.hearings({ params: { unserved: true } }).then((r) => {
        setUnservedSummons(r.data.data.data ?? []);
      }),
      councilApi.sessions({ params: { page: 1 } }).then((r) => {
        setRecentSessions(r.data.data.data ?? []);
      }),
    ]).then((results) => settleAll(pageLoad, results));
  }, [tick]);

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => setTick((t) => t + 1)} />;

  return (
    <div>
      <PageHeader
        title="Barangay Secretary Dashboard"
        subtitle="Mediation hearings, summons administration, and Sangguniang Barangay session records"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/sessions"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray bg-white px-4 py-2 text-sm font-semibold text-dark shadow-sm transition hover:border-primary/50"
            >
              <FiBookOpen className="h-4 w-4" aria-hidden="true" /> Record Session
            </Link>
            <Link
              to="/lupon/hearings"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              <FiCalendar className="h-4 w-4" aria-hidden="true" /> Hearing Schedule
            </Link>
          </div>
        }
      />

      <RevealGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Today's Hearings"
          value={todayHearings.length}
          icon={FiCalendar}
          tone={todayHearings.length > 0 ? "warning" : undefined}
          hint={todayHearings.length > 0 ? `${todayHearings.filter(h => h.status === "Scheduled").length} standing` : "None scheduled today"}
        />
        <StatTile
          label="Upcoming Hearings"
          value={upcomingHearings.length}
          icon={FiClock}
          hint="Next booked sittings"
        />
        <StatTile
          label="Summons Requiring Action"
          value={unservedSummons.length}
          icon={FiMail}
          tone={unservedSummons.length > 0 ? "danger" : undefined}
          hint={unservedSummons.length > 0 ? "Unserved summons" : "All summons served"}
        />
        <StatTile
          label="Council Sessions"
          value={recentSessions.length}
          icon={FiFileText}
          hint="Recorded sessions"
        />
      </RevealGroup>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* Today's Hearings */}
        <Card
          title="Today's Mediation Hearings"
          action={
            <Link to="/lupon/hearings" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          }
        >
          {todayHearings.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No mediation hearings scheduled for today.</p>
          ) : (
            <ul className="divide-y divide-gray/70">
              {todayHearings.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-dark">
                      {h.lupon_case?.complainant_display_name ?? "—"}
                      <span className="text-gray-400"> vs. </span>
                      {h.lupon_case?.respondent_display_names || "—"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      <Link to="/lupon/hearings/calendar" className="font-medium text-primary hover:underline">
                        {h.lupon_case?.case_number ?? "—"}
                      </Link>
                      {h.lupon_case?.case_title ? ` · ${h.lupon_case.case_title}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="whitespace-nowrap text-sm font-semibold text-dark">
                      {formatTime(h.scheduled_at)}
                    </p>
                    <StatusBadge status={h.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Summons Requiring Action */}
        <Card
          title="Summons Requiring Action"
          action={
            <Link to="/lupon/hearings/for-summons" className="text-sm font-medium text-primary hover:underline">
              For Summons
            </Link>
          }
        >
          {unservedSummons.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No unserved summons pending service.</p>
          ) : (
            <ul className="divide-y divide-gray/70">
              {unservedSummons.slice(0, 5).map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-dark">
                      {h.lupon_case?.complainant_display_name ?? "—"} vs. {h.lupon_case?.respondent_display_names || "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Case: <span className="font-medium text-primary">{h.lupon_case?.case_number ?? "—"}</span> · {h.hearing_type} #{h.hearing_sequence ?? 1}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="inline-flex rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning">
                      Needs Service
                    </span>
                    <p className="mt-0.5 text-xs text-gray-400">{formatDate(h.scheduled_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* Council Sessions */}
        <Card
          title="Recent Council Session Records"
          action={
            <Link to="/sessions" className="text-sm font-medium text-primary hover:underline">
              All Sessions
            </Link>
          }
        >
          {recentSessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No council session records found.</p>
          ) : (
            <ul className="divide-y divide-gray/70">
              {recentSessions.slice(0, 5).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-dark">
                      Session {s.session_number} ({s.session_type})
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {s.agenda || "No agenda summary recorded"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={s.status} />
                    <p className="mt-0.5 text-xs text-gray-400">{s.session_date}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Upcoming Mediation Hearings */}
        <Card
          title="Upcoming Hearings"
          action={
            <Link to="/lupon/hearings/upcoming" className="text-sm font-medium text-primary hover:underline">
              View Calendar
            </Link>
          }
        >
          {upcomingHearings.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No upcoming hearings scheduled.</p>
          ) : (
            <ul className="divide-y divide-gray/70">
              {upcomingHearings.slice(0, 5).map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-dark">
                      {h.lupon_case?.complainant_display_name ?? "—"} vs. {h.lupon_case?.respondent_display_names || "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {h.lupon_case?.case_number ?? "—"} · {h.hearing_type}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-dark">{formatDate(h.scheduled_at)}</p>
                    <p className="text-xs text-gray-400">{formatTime(h.scheduled_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const h = Number(iso?.slice(11, 13));
  if (Number.isNaN(h)) return "—";
  return `${h % 12 === 0 ? 12 : h % 12}:${iso.slice(14, 16)} ${h < 12 ? "AM" : "PM"}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = (iso?.slice(0, 10) ?? "").split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

