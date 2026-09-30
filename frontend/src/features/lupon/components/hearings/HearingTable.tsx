import { FiClock, FiCornerUpLeft, FiEye, FiPlay, FiPrinter } from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import DataTable from "../../../../shared/ui/DataTable";
import { formatWallClock } from "../../../../shared/lib/datetime";
import { deskForType, worksSitting } from "../../lib/hearings";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import RowAction, { RowActions } from "../../../../shared/ui/RowAction";
import type { HearingCalendarState } from "../../hooks/useHearingCalendar";
import type { LuponHearing } from "../../types";

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
  } = ctx;

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
       * OPENS THE CASE, not the docket.
       *
       * This was a link to /lupon/cases, which the Barangay Secretary is
       * refused — so the officer who writes the minutes could not read the
       * complaint they were writing about. It opens the case file instead:
       * the complaint, the parties and every sitting, read-only.
       */
      render: (h: LuponHearing) =>
        h.lupon_case ? (
          <button
            type="button"
            onClick={() => openCaseFile(h.lupon_case?.id)}
            className="cursor-pointer font-medium text-primary hover:underline"
          >
            {h.lupon_case.case_number}
          </button>
        ) : (
          "—"
        ),
    },
    {
      /* The case is named by its nature — the same column the docket shows. */
      header: "Nature of the Case",
      render: (h: LuponHearing) => (
        <span className="block max-w-xs truncate">
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
    /* The date, where the date is the news. Today's list is today. */
    ...(view === "today"
      ? []
      : [{
          header: "Schedule",
          render: (h: LuponHearing) => (
            <div>
              <span className="whitespace-nowrap">{formatWallClock(h.scheduled_at)}</span>
              {/*
                TWO THINGS THE APPOINTMENT ITSELF CANNOT SAY.

                Ten cases on one Tuesday do not fit six ninety-minute slots
                between eight and five, so some are handed an hour past
                closing and want one chosen by hand. And when a sitting
                overruns, the one after it starts late — said here rather
                than by quietly rewriting the hour, because the summons in
                that party's hand names it.
              */}
              {h.past_closing && h.status === "Scheduled" && (
                <span className="mt-0.5 block text-[11px] font-medium text-warning">
                  Past closing — set an hour
                </span>
              )}
              {!!h.delayed_minutes && h.delayed_minutes > 0 && (
                <span className="mt-0.5 block text-[11px] font-medium text-danger">
                  Running {h.delayed_minutes} min late
                </span>
              )}
            </div>
          ),
        }]),
    ...(view === "past"
      ? [{
          header: "Outcome",
          render: (h: LuponHearing) => (
            <span className="text-xs text-dark">{h.outcome || "—"}</span>
          ),
        }]
      : []),
    { header: "Status", render: (h: LuponHearing) => <StatusBadge status={h.status} /> },
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

        /* Not this desk's, and not yet decided: there is nothing to say
           beyond whose it is. */
        if (!mine && open) {
          return (
            <span className="text-xs text-gray-400">
              {deskForType(h.hearing_type) === "Lupon" ? "The Lupon's" : "The Secretary's"}
            </span>
          );
        }

        return (
          <RowActions>
            {view === "today" && open && (
              <RowAction
                label="Start the sitting"
                icon={FiPlay}
                tone="primary"
                onClick={() => startSession(h)}
              />
            )}

            {/*
              PAST SITTINGS CARRY NO MINUTES BUTTON.
              The minutes are written in the room, on the day, with the
              parties in front of the Punong Barangay — a screen that let
              them be entered a week later is a screen that lets the record
              be composed after the fact. Today's list is the only place a
              sitting is written up.
            */}

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

            {/* What was decided — or, where the sitting was stood down,
                why it never sat. The button says which, because those are
                two different things to open. */}
            {!open && (
              <RowAction
                label={h.status === "Cancelled" ? "Why it did not sit" : "View the result"}
                icon={FiEye}
                onClick={() => setResultFor(h)}
              />
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
        rows={rows}
        rowKey={(h) => h.id}
        numbered
        total={total}
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
    </Card>
  );
}
