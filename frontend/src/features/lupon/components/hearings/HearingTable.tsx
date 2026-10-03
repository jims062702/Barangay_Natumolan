import { useState } from "react";
import { FiCalendar, FiCheck, FiClock, FiCornerUpLeft, FiEdit2, FiEye, FiPlay, FiPlus, FiPrinter } from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import DataTable from "../../../../shared/ui/DataTable";
import { formatWallClock, parseWallClock } from "../../../../shared/lib/datetime";
import { deskForType, worksSitting } from "../../lib/hearings";
import { getHearingDisplayStatus } from "../case/HearingsCard";
import RowAction, { RowActions } from "../../../../shared/ui/RowAction";
import type { HearingCalendarState } from "../../hooks/useHearingCalendar";
import type { LuponCase, LuponHearing } from "../../types";
import { CaseSchedulesModal } from "./CaseSchedulesModal";
import { EditHearingTimeModal } from "./EditHearingTimeModal";

/**
 * The Punong Barangay's sittings.
 *
 * Today's list is the room as it stands: who is coming, and nothing else —
 * the schedule is today, the summons went out before, and attendance is
 * taken in the sitting itself. The other two views say when, because there
 * the date IS the information.
 */
export function HearingTable({ ctx }: { ctx: HearingCalendarState }) {
  const {
    view, rows, total, loading, page, lastPage, setPage, user,
    startSession, printSummons, openWithdraw, setResultFor, openCaseFile, setStartTime,
    openMinutes, timeEditFor, closeEditTime, load,
  } = ctx;

  const [schedulesForCase, setSchedulesForCase] = useState<Partial<LuponCase> | null>(null);

  // In Upcoming Hearing: ensure strictly 1 row per Case File
  const displayRows = view === "upcoming"
    ? rows.filter(
        (h, index, self) =>
          index ===
          self.findIndex(
            (other) =>
              (other.lupon_case_id && other.lupon_case_id === h.lupon_case_id) ||
              other.id === h.id
          )
      )
    : rows;

  const party = (name?: string | null, nonResident?: boolean) => (
    <span className="text-xs text-dark">
      {name || "—"}
      {/* Only ever on the complainant's side: a respondent from outside the
          barangay cannot exist — that is what gives jurisdiction. */}
      {nonResident === false && (
        <span className="ml-1 rounded-full bg-gray px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
          non-resident
        </span>
      )}
    </span>
  );

  const columns = [
    {
      header: "Case Number",
      /*
       * In upcoming view: opens the modal showing all schedules for this case file.
       * In other views: opens the case file modal.
       */
      render: (h: LuponHearing) =>
        h.lupon_case ? (
          <button
            type="button"
            onClick={() => {
              if (view === "upcoming") {
                setSchedulesForCase(h.lupon_case ?? null);
              } else {
                openCaseFile(h.lupon_case?.id);
              }
            }}
            className="cursor-pointer font-bold text-primary hover:underline text-left block text-xs whitespace-nowrap"
            title={view === "upcoming" ? "Click to view all hearing schedules for this case" : "Click to view case file"}
          >
            {h.lupon_case.case_number}
          </button>
        ) : (
          "—"
        ),
    },
    {
      header: "Nature of Case",
      render: (h: LuponHearing) => (
        <span className="block max-w-xs truncate font-medium text-dark text-xs">
          {h.lupon_case?.case_classification ?? "—"}
        </span>
      ),
    },
    {
      header: "Complainant",
      render: (h: LuponHearing) =>
        party(h.lupon_case?.complainant_display_name, h.lupon_case?.complainant_is_resident),
    },
    {
      header: "Respondent",
      render: (h: LuponHearing) => party(h.lupon_case?.respondent_display_names),
    },
    {
      header: "Hearing Stage",
      render: (h: LuponHearing) => {
        const isMediation = h.hearing_type === "Mediation";
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              isMediation
                ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "bg-purple-50 text-purple-700 border border-purple-200"
            }`}
          >
            {isMediation ? "Punong Barangay" : "Lupon"}
          </span>
        );
      },
    },
    {
      header: "Hearing Number",
      render: (h: LuponHearing) => {
        const stageHearings = (h.lupon_case?.hearings ?? [])
          .filter((x) => x.hearing_type === h.hearing_type)
          .sort((a, b) => (parseWallClock(a.scheduled_at)?.getTime() ?? 0) - (parseWallClock(b.scheduled_at)?.getTime() ?? 0));
        const seqIndex = stageHearings.findIndex((x) => x.id === h.id);
        const seq = seqIndex >= 0 ? seqIndex + 1 : (h.hearing_sequence ?? 1);
        return (
          <span className="text-xs font-bold text-dark whitespace-nowrap">
            Hearing #{seq}
          </span>
        );
      },
    },
    {
      header: "Schedule",
      render: (h: LuponHearing) => {
        const d = parseWallClock(h.scheduled_at);
        const dayName = d && !isNaN(d.getTime())
          ? d.toLocaleDateString("en-US", { weekday: "long" })
          : "";
        const dateStr = d && !isNaN(d.getTime())
          ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "";
        const caseHearings = h.lupon_case?.hearings ?? [];
        const totalSchedules = caseHearings.length > 0 ? caseHearings.length : 1;

        return (
          <div>
            <span className="block whitespace-nowrap font-medium text-dark text-xs">
              {dayName}
            </span>
            <span className="block whitespace-nowrap text-[11px] text-gray-500">
              {dateStr}
            </span>
            {view === "upcoming" && (
              <button
                type="button"
                onClick={() => setSchedulesForCase(h.lupon_case ?? null)}
                className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20 hover:underline"
                title="Click to view all hearing schedules in modal"
              >
                <FiCalendar className="h-2.5 w-2.5" />
                {totalSchedules > 1 ? `View all ${totalSchedules} schedules` : "View schedules"}
              </button>
            )}
          </div>
        );
      },
    },
    {
      header: "Time",
      render: (h: LuponHearing) => (
        <div>
          <span className="whitespace-nowrap font-semibold text-dark text-xs">
            {h.schedule_time_range || formatWallClock(h.scheduled_at, { hour: "numeric", minute: "2-digit" })}
          </span>
          {h.past_closing && h.status === "Scheduled" && (
            <span className="mt-0.5 block text-[10px] font-medium text-warning">
              Past closing — set hour
            </span>
          )}
          {!!h.delayed_minutes && h.delayed_minutes > 0 && (
            <span className="mt-0.5 block text-[10px] font-medium text-danger">
              Running {h.delayed_minutes} min late
            </span>
          )}
        </div>
      ),
    },
    ...(view === "past"
      ? [
          {
            header: "Minutes",
            render: (h: LuponHearing) => {
              const hasMin = !!((h.minutes && h.minutes.trim()) || (h.proceedings_notes && h.proceedings_notes.trim()));
              return hasMin ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  <FiCheck className="h-3 w-3" />
                  Minutes recorded
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                  Minutes not yet recorded
                </span>
              );
            },
          },
          {
            header: "Outcome",
            render: (h: LuponHearing) => (
              <span className="text-xs text-dark">{h.outcome || "—"}</span>
            ),
          },
        ]
      : []),
    {
      header: "Status",
      render: (h: LuponHearing) => {
        const displayStatus = getHearingDisplayStatus(h);
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${displayStatus.tone}`}
          >
            {displayStatus.label === "On-going" && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
            )}
            {displayStatus.label}
          </span>
        );
      },
    },
    /*
     * WHAT A ROW OFFERS DEPENDS ON WHEN THE SITTING IS — AND WHOSE IT IS.
     *
     * Every list showed the same handful of buttons to every office, so the
     * day's list offered a summons for a sitting starting in an hour, a
     * sitting held last week offered nothing at all, and the Punong Barangay
     * was handed the same controls as the officer who keeps the record.
     *
     * A button that cannot be the right thing to press is not greyed out
     * here — it is not drawn:
     *
     *   Today      start the sitting; the summons went out days ago
     *   Upcoming   print the summons again, move it, or take the case back
     *   Past       write up a sitting that was held but never minuted
     *   any list   read back what was decided, once it has been
     *
     * And none of them, on a sitting that is not this desk's. The Barangay
     * Secretary keeps the record of the Punong Barangay's Tuesdays, the
     * Lupon works its own Thursdays, and the Punong Barangay writes nothing:
     * they preside. The server refuses the same combinations (HearingDesk),
     * so this hides work that would be rejected rather than inventing a
     * permission of its own.
     */
    {
      header: "Actions",
      render: (h: LuponHearing) => {
        const open = h.status === "Scheduled";
        const mine = worksSitting(user, h);
        const hasMin = !!((h.minutes && h.minutes.trim()) || (h.proceedings_notes && h.proceedings_notes.trim()));

        /* Not this desk's, and not yet decided: there is nothing to say
           beyond whose it is. */
        if (!mine && open && !hasMin && view !== "past") {
          return (
            <span className="text-xs text-gray-400">
              {deskForType(h.hearing_type) === "Lupon" ? "The Lupon's" : "The Secretary's"}
            </span>
          );
        }

        return (
          <RowActions>
            {view === "today" && open && (
              <>
                <RowAction
                  label="Start the sitting"
                  icon={FiPlay}
                  tone="primary"
                  onClick={() => startSession(h)}
                />
                {mine && (
                  <RowAction
                    label={hasMin ? "Edit Minutes" : "Add Minutes"}
                    icon={hasMin ? FiEdit2 : FiPlus}
                    onClick={() => openMinutes(h, "edit")}
                  />
                )}
              </>
            )}

            {/*
              PAST SITTINGS:
              Secretary / authorized staff can always Add or Edit Minutes for past hearings,
              even if hearing_date < current_date or status is Completed.
            */}
            {view === "past" && (
              <>
                {hasMin ? (
                  <>
                    <RowAction
                      label="View Minutes"
                      icon={FiEye}
                      onClick={() => openMinutes(h, "view")}
                    />
                    {mine && (
                      <RowAction
                        label="Edit Minutes"
                        icon={FiEdit2}
                        tone="primary"
                        onClick={() => openMinutes(h, "edit")}
                      />
                    )}
                  </>
                ) : (
                  mine && (
                    <RowAction
                      label="Add Minutes"
                      icon={FiPlus}
                      tone="primary"
                      onClick={() => openMinutes(h, "edit")}
                    />
                  )
                )}
                <RowAction
                  label={h.status === "Cancelled" ? "Why it did not sit" : "View the result"}
                  icon={FiEye}
                  onClick={() => setResultFor(h)}
                />
              </>
            )}

            {/*
              A REPRINT, not the first printing. The summons that opened
              this case was printed from the "For summons" list, and that
              press is what booked these very days — by the time a sitting
              is on the calendar, the paper already exists. This is for the
              copy that went missing.
            */}
            {view === "upcoming" && open && (
              <>
                <RowAction
                  label="View all schedules"
                  icon={FiCalendar}
                  tone="primary"
                  onClick={() => setSchedulesForCase(h.lupon_case ?? null)}
                />
                <RowAction
                  label={h.summons_issued ? "Print the summons again" : "Print the summons"}
                  icon={FiPrinter}
                  onClick={() => printSummons(h)}
                />
                {/* The HOUR, not the day. No cancel and no reschedule: a
                    sitting the parties were summoned to is not called off
                    or moved to another date, but the hour on a day the
                    arithmetic overfilled is the office's to set. */}
                <RowAction
                  label="Set the hour this sitting begins"
                  icon={FiClock}
                  tone={h.past_closing ? "primary" : undefined}
                  onClick={() => setStartTime(h)}
                />
                <RowAction
                  label="Withdraw the complaint"
                  icon={FiCornerUpLeft}
                  tone="danger"
                  onClick={() => openWithdraw(h)}
                />
              </>
            )}

            {/* Upcoming hearings that are closed/cancelled */}
            {view === "upcoming" && !open && (
              <>
                <RowAction
                  label="View all schedules"
                  icon={FiCalendar}
                  tone="primary"
                  onClick={() => setSchedulesForCase(h.lupon_case ?? null)}
                />
                <RowAction
                  label={h.status === "Cancelled" ? "Why it did not sit" : "View the result"}
                  icon={FiEye}
                  onClick={() => setResultFor(h)}
                />
              </>
            )}

            {/* Today hearings that are closed */}
            {view === "today" && !open && (
              <>
                {hasMin && (
                  <RowAction
                    label="View Minutes"
                    icon={FiEye}
                    onClick={() => openMinutes(h, "view")}
                  />
                )}
                {mine && (
                  <RowAction
                    label="Edit Minutes"
                    icon={FiEdit2}
                    tone="primary"
                    onClick={() => openMinutes(h, "edit")}
                  />
                )}
                <RowAction
                  label={h.status === "Cancelled" ? "Why it did not sit" : "View the result"}
                  icon={FiEye}
                  onClick={() => setResultFor(h)}
                />
              </>
            )}
          </RowActions>
        );
      },
    },
  ];

  return (
    <Card>
      <DataTable
        columns={columns}
        rows={displayRows}
        rowKey={(h) => (view === "upcoming" ? (h.lupon_case_id ?? h.id) : h.id)}
        numbered
        total={view === "upcoming" ? displayRows.length : total}
        searchable
        searchPlaceholder="Search by Case Number, Nature of the Case, Complainant or Respondent…"
        getSearchText={(h) =>
          `${h.lupon_case?.case_number ?? ""} ${h.lupon_case?.case_title ?? ""} ${h.lupon_case?.case_classification ?? ""} ${
            h.lupon_case?.complainant_display_name ?? ""
          } ${h.lupon_case?.respondent_display_names ?? ""} ${h.status}`
        }
        filters={[{ label: "Status", getValue: (h) => h.status }]}
        loading={loading}
        page={page}
        lastPage={lastPage}
        onPageChange={setPage}
        emptyMessage={
          view === "today"
            ? "No hearings set for today."
            : view === "upcoming"
              ? "No upcoming hearings scheduled."
              : "No past hearings on record."
        }
      />

      {schedulesForCase && (
        <CaseSchedulesModal
          caseFor={schedulesForCase}
          onClose={() => setSchedulesForCase(null)}
          onViewCaseFile={(caseId) => {
            setSchedulesForCase(null);
            openCaseFile(caseId);
          }}
          onPrintSummons={printSummons}
          onSetStartTime={setStartTime}
          onStartSession={startSession}
          onOpenMinutes={openMinutes}
        />
      )}

      <EditHearingTimeModal
        hearing={timeEditFor}
        isOpen={timeEditFor !== null}
        onClose={closeEditTime}
        onSaved={load}
      />
    </Card>
  );
}
