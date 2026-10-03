import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import PageHeader from "../../../shared/ui/PageHeader";
import Card from "../../../shared/ui/Card";
import StatTile from "../../../shared/ui/StatTile";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { luponApi } from "../api";
import { CaseFileModal } from "../components/hearings/CaseFileModal";
import type { LuponCase, LuponHearing } from "../types";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";
import { useAuth } from "../../../shared/auth/AuthContext";

/**
 * The Punong Barangay's month (Tuesdays) or Lupon's conciliation month (Thursdays).
 *
 * Distinct calendars per office:
 * - Lupon: Thursday conciliation hearings for forwarded unsettled cases.
 * - PB / Secretary: Tuesday mediation hearings.
 */
export default function HearingCalendar() {
  const { user } = useAuth();
  const isPbUser = user?.role === "Punong Barangay";
  const defaultType = (user?.office === "Lupon" && !isPbUser) ? "Conciliation" : "Mediation";
  const [hearingType, setHearingType] = useState<"Mediation" | "Conciliation">(defaultType);

  const isLupon = hearingType === "Conciliation";

  const [month, setMonth] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 7));
  const [hearings, setHearings] = useState<LuponHearing[]>([]);
  const [capacities, setCapacities] = useState<Record<string, { date: string; count: number; max: number; is_full: boolean }>>({});
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();
  const [caseFor, setCaseFor] = useState<LuponCase | null>(null);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    luponApi.hearingCalendar({ params: { month, hearing_type: hearingType } })
      .then((r) => {
        setHearings(r.data.data.hearings ?? []);
        setCapacities(r.data.data.capacities ?? {});
      })
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, hearingType]);

  useAutoRefresh(() => load(true), REFRESH.staff);
  usePulse("lupon_cases", () => load(true));

  /** The case behind a sitting, read-only — the whole dispute, before the room. */
  const openCase = async (caseId?: number | null) => {
    if (!caseId) return;
    try {
      const response = await luponApi.hearingCase(caseId);
      setCaseFor(response.data.data);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  /*
   * The grid: whole weeks, Sunday to Saturday, so the month keeps the shape
   * a wall calendar has. Days from the months either side are drawn faint
   * rather than left blank — an empty corner reads as a missing day.
   */
  const weeks = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());

    const byDay = new Map<string, LuponHearing[]>();
    for (const h of hearings) {
      const key = h.scheduled_at.slice(0, 10);
      byDay.set(key, [...(byDay.get(key) ?? []), h]);
    }

    const out: { key: string; day: number; inMonth: boolean; sittings: LuponHearing[] }[][] = [];
    const cursor = new Date(start);
    while (out.length < 6) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        week.push({
          key,
          day: cursor.getDate(),
          inMonth: cursor.getMonth() === m - 1,
          sittings: byDay.get(key) ?? [],
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      out.push(week);
      /* Six rows only when the month needs them. */
      if (cursor.getMonth() !== m - 1 && out.length >= 5) break;
    }
    return out;
  }, [month, hearings]);

  const shift = (by: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + by, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthName = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
    .toLocaleDateString("en-US", { month: "long", year: "numeric" });

  /*
   * The WINDOW, not just the start.
   *
   * A sitting is allowed an hour and a half, and the next begins a quarter
   * of an hour after it ends. A tile showing only "8:00 AM" told the
   * Punong Barangay when to walk in and nothing about when the room is
   * theirs until — which is the half of it they plan the day around.
   */
  const window = (iso: string) => {
    /*
     * READ OFF THE STRING, NEVER PARSED.
     *
     * The column holds Manila wall-clock and Laravel serialises it with a
     * "Z" it has not earned — so `new Date(...)` reads 9:00 as nine UTC and
     * the tile said 5:00 PM for a nine o'clock sitting. The hour on the
     * summons is the hour in the column; arithmetic on the minutes is all
     * this needs.
     */
    const from = Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
    if (Number.isNaN(from)) return "—";

    const face = (mins: number) => {
      const h = Math.floor(mins / 60) % 24;
      return `${h % 12 === 0 ? 12 : h % 12}:${String(mins % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
    };
    return `${face(from)} – ${face(from + 120)}`;
  };

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => load()} />;

  return (
    <div>
      <PageHeader
        title={isLupon ? "Lupon Hearings Calendar" : "Punong Barangay Hearings Calendar"}
        subtitle={
          isLupon
            ? "Conciliation hearings on Thursdays for forwarded unsettled cases (Maximum 7 cases per Thursday)"
            : "The Punong Barangay's mediation sittings on Tuesdays (Maximum 7 cases per Tuesday)"
        }
      />

      {/* Stage Switcher (punong barangay sees only PB; other staff can switch) */}
      {!isPbUser && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setHearingType("Mediation")}
            className={`cursor-pointer rounded-full px-4 py-2 text-xs font-bold transition-all ${
              !isLupon
                ? "bg-primary text-white shadow-sm ring-2 ring-primary/20"
                : "bg-white text-gray-600 border border-gray hover:bg-gray-50"
            }`}
          >
            Punong Barangay (Tuesdays · Max 7 cases)
          </button>
          <button
            type="button"
            onClick={() => setHearingType("Conciliation")}
            className={`cursor-pointer rounded-full px-4 py-2 text-xs font-bold transition-all ${
              isLupon
                ? "bg-purple-700 text-white shadow-sm ring-2 ring-purple-500/20"
                : "bg-white text-gray-600 border border-gray hover:bg-gray-50"
            }`}
          >
            Lupon (Thursdays · Max 7 cases)
          </button>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatTile
          label={`Scheduled Sittings in ${monthName}`}
          value={hearings.filter((h) => h.status === "Scheduled").length}
          icon={FiCalendar}
          hint={isLupon ? "Thursday conciliations" : "Tuesday mediations"}
        />
        <StatTile
          label="Daily Hearing Capacity"
          value="7 cases max"
          icon={FiCalendar}
          tone="primary"
          hint={isLupon ? "Strictly 7 active cases per Thursday" : "Strictly 7 active cases per Tuesday"}
        />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="The month before"
            className="cursor-pointer rounded-full border border-gray p-2 text-gray-500 transition-colors hover:border-primary hover:text-primary"
          >
            <FiChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <p className="text-base font-semibold text-dark">{monthName}</p>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="The month after"
            className="cursor-pointer rounded-full border border-gray p-2 text-gray-500 transition-colors hover:border-primary hover:text-primary"
          >
            <FiChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          /*
            THE MONTH, HELD OPEN.
          */
          <div className="overflow-x-auto" aria-hidden="true">
            <span role="status" aria-live="polite" className="sr-only">Loading the month</span>
            <div className="min-w-[46rem]">
              <div className="grid grid-cols-7 gap-1.5 pb-1.5">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <p key={d} className="px-1 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {d}
                  </p>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 35 }).map((_, i) => (
                  <span key={i} className="block h-24 animate-pulse rounded-xl bg-gray" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Scrolls in its own box on a phone rather than taking the page
             sideways with it — seven columns do not fit 390px. */
          <div className="overflow-x-auto">
            <div className="min-w-[46rem]">
              <div className="grid grid-cols-7 gap-1.5 pb-1.5">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <p
                    key={d}
                    className={`px-1 text-center text-[11px] font-bold uppercase tracking-wide ${
                      (!isLupon && d === "Tue") || (isLupon && d === "Thu")
                        ? isLupon ? "text-purple-700 bg-purple-50 rounded py-0.5" : "text-primary bg-primary/10 rounded py-0.5"
                        : "text-gray-400"
                    }`}
                  >
                    {d} {((!isLupon && d === "Tue") || (isLupon && d === "Thu")) && "(Hearing Day)"}
                  </p>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {weeks.flat().map((cell) => {
                  const cellDate = new Date(`${cell.key}T00:00:00`);
                  const dayOfWeek = cellDate.getDay(); // 0 = Sun, 2 = Tue, 4 = Thu
                  const isHearingDay = !isLupon ? dayOfWeek === 2 : dayOfWeek === 4;
                  const dayCap = capacities[cell.key];
                  const scheduledCount = dayCap?.count ?? cell.sittings.filter((s) => s.status === "Scheduled").length;
                  const isFull = dayCap?.is_full ?? scheduledCount >= 7;

                  return (
                    <div
                      key={cell.key}
                      className={`min-h-24 rounded-xl border p-1.5 transition-colors ${
                        cell.inMonth
                          ? isHearingDay
                            ? isFull
                              ? "border-rose-300 bg-rose-50/30"
                              : "border-primary/30 bg-primary/[0.02]"
                            : "border-gray bg-white"
                          : "border-gray/40 bg-secondary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between px-0.5 pb-1">
                        <span
                          className={`text-xs font-bold ${
                            cell.inMonth
                              ? isHearingDay
                                ? isLupon ? "text-purple-700" : "text-primary"
                                : "text-dark"
                              : "text-gray-400"
                          }`}
                        >
                          {cell.day}
                        </span>

                        {cell.inMonth && isHearingDay && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-tight ${
                              isFull
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : scheduledCount > 0
                                ? "bg-blue-100 text-blue-800 border border-blue-200"
                                : "bg-gray-100 text-gray-500 border border-gray-200"
                            }`}
                            title={`${scheduledCount} out of 7 maximum cases scheduled for this day`}
                          >
                            {scheduledCount} / 7 {isFull ? "FULL" : "cases"}
                          </span>
                        )}
                      </div>

                    {/*
                      NO SCROLL INSIDE A DAY. A box that scrolls hides what
                      is in it behind a gesture nobody makes on a calendar,
                      so a Tuesday with four sittings showed two and kept
                      the rest. The day is as tall as its sittings.

                      It can no longer run away: the hall sits six times a
                      day at most (HearingCalendar::SITTINGS_PER_DAY), so a
                      row has a ceiling it did not have when every hearing
                      was booked at nine o'clock.
                    */}
                    <div className="mt-1 space-y-1">
                      {cell.sittings.map((h) => (
                        /*
                          The whole sitting on the tile: the hour, both
                          parties and whether it still stands. A tile that
                          said only "1 hearing" would send the reader back
                          to a list to find out whose.
                        */
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => openCase(h.lupon_case?.id)}
                          title={`${h.lupon_case?.case_number ?? ""} — ${h.lupon_case?.case_title ?? ""}`}
                          className={`block w-full cursor-pointer rounded-lg px-1.5 py-1 text-left transition-colors ${
                            h.status === "Scheduled"
                              ? "bg-primary/10 hover:bg-primary/20"
                              : "bg-gray/40 hover:bg-gray/60"
                          }`}
                        >
                          <span className="block text-[11px] font-semibold text-dark">
                            {h.schedule_time_range || window(h.scheduled_at)}
                          </span>
                          {/* Both parties on ONE line. Six sittings at three
                              lines each made a row tall enough to push the
                              rest of the month off the screen. */}
                          <span className="block truncate text-[11px] text-gray-600">
                            {h.lupon_case?.complainant_display_name ?? "—"}
                            {" vs. "}
                            {h.lupon_case?.respondent_display_names || "—"}
                          </span>
                          {/*
                            WHAT CAME OF IT, not merely that it happened.
                            "Completed" alone made the month a wall of
                            identical grey tiles whether the parties had
                            settled, failed to, or run out of sittings —
                            and the third spent Tuesday is the one that
                            matters most, because that is when the case
                            leaves the Punong Barangay.
                          */}
                          {h.result_label && (
                            <span className={`block text-[10px] font-semibold uppercase tracking-wide ${
                              /Settled$/.test(h.result_label) ? "text-success"
                                : /Move to Lupon/.test(h.result_label) ? "text-primary"
                                  : "text-gray-500"
                            }`}>
                              {h.result_label}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        )}

        {!loading && hearings.length === 0 && (
          <p className="pt-4 text-center text-sm text-gray-400">
            No sitting is booked in {monthName}.
          </p>
        )}
      </Card>

      {/* The dispute itself, read-only: what the complaint says, who the
          parties are, and what every sitting so far decided. */}
      <CaseFileModal caseFor={caseFor} onClose={() => setCaseFor(null)} />
    </div>
  );
}
