import { FiCalendar, FiCheckCircle, FiMail, FiPrinter, FiSlash } from "react-icons/fi";
import StatTile from "../../../shared/ui/StatTile";
import PageHeader from "../../../shared/ui/PageHeader";
import { useHearingCalendar } from "../hooks/useHearingCalendar";
import { HearingTable } from "../components/hearings/HearingTable";
import { ClosedCaseTable } from "../components/hearings/ClosedCaseTable";
import { ForSummonsTable } from "../components/hearings/ForSummonsTable";
import { WithdrawModal } from "../components/hearings/WithdrawModal";
import { CaseFileModal } from "../components/hearings/CaseFileModal";
import { ResultModal } from "../components/hearings/ResultModal";
import { KpFormsModal } from "../components/hearings/KpFormsModal";
import { type View } from "../lib/hearings";
import { PageLoading } from "../../../shared/ui/PageLoad";

/**
 * The hearing room: one list per address.
 *
 * SIX LISTS, SIX ADDRESSES, AND NO NAVIGATION ON THE PAGE. There used to be
 * a row of pills here repeating what the sidebar already offered — the same
 * four destinations, two clicks apart, one of them a dropdown hiding three
 * more. A screen that carries its own copy of the menu is a screen with two
 * answers to "where am I", and Today/Upcoming/Past could not be linked to
 * at all because they were a piece of state rather than a place.
 *
 * Now every list is somewhere the sidebar goes and somewhere a link can
 * reach, and this page renders whichever one its route names.
 */
export default function Hearings({ section = "today" }: { section?: View }) {
  const view: View = section;
  const ctx = useHearingCalendar(view);
  const { sittings, unprinted, scheduled, awaitingSummons, completed, cancelled, total } = ctx;

  /*
   * THE SUBTITLE DESCRIBES THE LIST, NOT WHAT THE READER MAY DO WITH IT.
   *
   * Three offices open these screens and only one of them works any given
   * row. "Start one to take the minutes" and "print the summons, move a
   * sitting, or withdraw a complaint" were written for the Barangay
   * Secretary, and the Punong Barangay and the Lupon read them at the top
   * of a list where every row says "The Secretary's" and carries no button
   * — the page offering work it would then refuse. What each reader can do
   * is on their own rows, which is the only place it can be said truly.
   */
  /*
   * THE PAGE NAMES ITSELF, and names what the sidebar called it.
   *
   * All six of these screens were titled "Hearing & KP Forms", so the
   * heading, the breadcrumb and the tab all read the same thing whichever
   * one was open — the reader had only the highlighted menu entry to tell
   * them where they were. The title now matches the entry they clicked.
   */
  const title = {
    today: "Today's Hearing",
    upcoming: "Upcoming Hearing",
    past: "Past Hearings",
    cancelled: "Cancelled",
    cfa: "CFA Cases",
    "for-summons": "For Summons",
  }[view];

  const subtitle = {
    today: "The sittings the hall holds today",
    upcoming: "Sittings still to be held, and the day each is set for",
    past: "Sittings already held, and what was decided at each",
    cancelled: "Complaints the complainant took back",
    cfa: "Cases certified to file action before the courts",
    "for-summons": "Forwarded to this desk and waiting on a summons — printing books the sittings",
  }[view];

  if (ctx.pageLoad.state !== "ready") return <PageLoading load={ctx.pageLoad} onRetry={() => ctx.load()} />;

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          /*
           * The Secretary takes the minutes at these sittings and writes the
           * report on them. Printing what is on screen — this list, with its
           * parties, dates and outcomes — is that report, so it does not
           * have to be typed a second time.
           */
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPrinter className="h-4 w-4" aria-hidden="true" /> Print report
          </button>
        }
      />

      {/*
        The tiles follow the list, because a count of something that cannot
        happen in this window is noise. "Completed" on Today's list is
        always the sittings that already ran today — read as a total it
        looked like the day was over.
      */}
      <div
        className={`mb-6 grid grid-cols-1 gap-4 ${
          view === "today" || !sittings ? "sm:grid-cols-1" : "sm:grid-cols-2"
        }`}
      >
        {sittings ? (
          <>
            {view !== "past" && <StatTile label="Scheduled" value={scheduled} icon={FiCalendar} />}
            {view === "upcoming" && (
              <StatTile
                label="Summons not yet printed"
                value={awaitingSummons}
                icon={FiMail}
                tone="warning"
                hint="Neither party has been told the schedule"
              />
            )}
            {view === "past" && (
              <>
                <StatTile label="Completed" value={completed} icon={FiCheckCircle} tone="success" />
                <StatTile label="Cancelled" value={cancelled} icon={FiSlash} tone="danger" />
              </>
            )}
          </>
        ) : view === "for-summons" ? (
          /*
           * WHAT IS WAITING, not how many rows there are.
           *
           * The register keeps a case after its papers are printed, so the
           * row count became the whole live docket — a tile reading
           * "Waiting on a summons: 9" above a list where eight were long
           * since printed. It counts the ones still to be done.
           */
          <StatTile
            label="Not yet printed"
            value={unprinted}
            icon={FiMail}
            tone="warning"
            hint="Nothing is on any calendar until the paper is printed"
          />
        ) : (
          <StatTile
            label={view === "cfa" ? "Certified to file action" : "Withdrawn complaints"}
            value={total}
            icon={view === "cfa" ? FiCheckCircle : FiSlash}
            tone={view === "cfa" ? undefined : "danger"}
          />
        )}
      </div>

      {sittings ? (
        <HearingTable ctx={ctx} />
      ) : view === "for-summons" ? (
        <ForSummonsTable ctx={ctx} />
      ) : (
        <ClosedCaseTable ctx={ctx} />
      )}

      {/* The case behind a row: the complaint, the parties, every sitting.
          Read-only, and the only way the Secretary can read the dispute
          they are writing the minutes of. */}
      <CaseFileModal caseFor={ctx.caseFor} onClose={() => ctx.setCaseFor(null)} />

      {/* The complainant takes the complaint back. */}
      <WithdrawModal ctx={ctx} />

      {/* What was decided at a sitting, read back. */}
      <ResultModal ctx={ctx} />

      {/* Prescribed KP forms, the summons among them. */}
      <KpFormsModal ctx={ctx} />
    </div>
  );
}
