import { FiCheck, FiPrinter } from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import DataTable from "../../../../shared/ui/DataTable";
import RowAction, { RowActions } from "../../../../shared/ui/RowAction";
import { asDate, deskForStage } from "../../lib/hearings";
import type { HearingCalendarState } from "../../hooks/useHearingCalendar";
import type { LuponCase } from "../../types";

/**
 * What has been HANDED to this desk and has no sitting yet.
 *
 * The list the office was missing. A case used to arrive by having three
 * Tuesdays appear on a calendar the moment the fee was confirmed — nothing
 * was forwarded to anybody, so the Secretary had no way to tell a case that
 * had reached them from one that had not, and asked the fair question: what
 * is it I am supposed to print?
 *
 * Two desks read this one screen, and each row says whose it is:
 *
 *   For Summons         the Barangay Secretary prints, and three Tuesdays
 *                       with the Punong Barangay follow
 *   For Lupon Summons   the three Tuesdays are spent with no agreement, so
 *                       the Lupon prints and three Thursdays follow
 *
 * The Print button is drawn only on the rows this reader can actually act
 * on. The rest stay visible, because knowing that a case is with the other
 * desk is worth as much as being able to work your own.
 */
export function ForSummonsTable({ ctx }: { ctx: HearingCalendarState }) {
  const { cases, total, loading, page, lastPage, setPage, issueSummons, mayIssue, openCaseFile, generatingSummonId } = ctx;

  const printed = (c: LuponCase) => !!c.papers_printed_at;

  return (
    <Card>
      <DataTable
        columns={[
          {
            header: "Case Number",
            className: "whitespace-nowrap min-w-[130px]",
            /* Opens the case, not the docket — the Secretary is refused
               there, and this is the desk that has to read it. */
            render: (c: LuponCase) => (
              <button
                type="button"
                onClick={() => openCaseFile(c.id)}
                className="cursor-pointer whitespace-nowrap font-medium text-primary hover:underline"
              >
                {c.case_number}
              </button>
            ),
          },
          {
            /* The case is named by its nature — the same column the docket shows. */
            header: "Nature of the Case",
            className: "whitespace-nowrap min-w-[130px]",
            render: (c: LuponCase) => (
              <span className="text-xs font-medium text-dark whitespace-nowrap">
                {c.case_classification ?? "—"}
              </span>
            ),
          },
          {
            header: "Complainant",
            className: "whitespace-nowrap min-w-[140px]",
            render: (c: LuponCase) => (
              <span className="text-xs font-medium text-dark whitespace-nowrap">
                {c.complainant_display_name ?? "—"}
              </span>
            ),
          },
          {
            header: "Respondent",
            className: "whitespace-nowrap min-w-[140px]",
            render: (c: LuponCase) => (
              <span className="text-xs font-medium text-dark whitespace-nowrap">
                {c.respondent_display_names || "—"}
              </span>
            ),
          },
          /*
           * NO "FILED" COLUMN either. A Lupon case number IS its filing
           * date — 2026-09-24-06 is the sixth case filed that day — so the
           * column repeated the one beside it and pushed the Actions column
           * off the edge of the screen. The date is still there; it is just
           * already being read.
           */
          {
            /*
             * NO "STAGE" COLUMN. The stage badge would read "For Summons"
             * beside a desk column reading "Secretary" and a note reading
             * "three Tuesdays" — three ways of saying one thing, on a table
             * that was already running off the side of the screen. The two
             * that answer a reader's actual questions are kept: whose is it,
             * and what happens when they press the button.
             */
            header: "Whose desk",
            className: "whitespace-nowrap min-w-[110px]",
            render: (c: LuponCase) => (
              <span className="whitespace-nowrap text-xs text-dark font-medium">
                {deskForStage(c.current_stage) === "Lupon" ? "The Lupon" : "The Secretary"}
              </span>
            ),
          },
          {
            /*
             * THE ONE QUESTION THIS SCREEN EXISTS TO ANSWER.
             *
             * The row used to vanish the moment it was printed, so "has the
             * notice of hearing and the summons gone out on this case?"
             * could only be answered by an absence — no use to a clerk
             * interrupted mid-press, or to a second clerk arriving after.
             */
            header: "Notice & summons",
            className: "whitespace-nowrap min-w-[140px]",
            render: (c: LuponCase) =>
              printed(c) ? (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-success">
                  <FiCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Printed {asDate(c.papers_printed_at)}
                </span>
              ) : (
                <span className="whitespace-nowrap text-xs font-medium text-warning">Not yet printed</span>
              ),
          },
          /*
           * NO "PRINTING BOOKS" COLUMN. Adding "Notice & summons" — the one
           * question this screen exists to answer — pushed the Actions
           * column off the right edge, and this was the cell to give up:
           * the desk column already says whose sittings follow, and the box
           * that opens on the button spells out the three days before
           * anything is printed.
           */
          {
            header: "Actions",
            className: "whitespace-nowrap text-right min-w-[120px]",
            render: (c: LuponCase) => {
              if (!mayIssue(c)) {
                return <span className="text-xs text-gray-400 whitespace-nowrap">With the other desk</span>;
              }

              const isGenerating = generatingSummonId === c.id;

              return (
                <RowActions>
                  <RowAction
                    label={
                      isGenerating
                        ? "Loading document…"
                        : printed(c)
                          ? "Print the notice and summons again"
                          : "Print the notice of hearing and the summons"
                    }
                    icon={FiPrinter}
                    tone={printed(c) ? undefined : "primary"}
                    disabled={generatingSummonId !== null}
                    onClick={() => issueSummons(c)}
                  />
                </RowActions>
              );
            },
          },
        ]}
        rows={cases}
        rowKey={(c) => c.id}
        total={total}
        searchable
        tableClassName="min-w-[55rem]"
        searchPlaceholder="Search by Case Number, Nature of the Case, Complainant or Respondent…"
        getSearchText={(c) =>
          `${c.case_number} ${c.case_title ?? ""} ${c.case_classification ?? ""} ${c.complainant_display_name ?? ""} ${c.respondent_display_names ?? ""}`
        }
        loading={loading}
        page={page}
        lastPage={lastPage}
        onPageChange={setPage}
        emptyMessage="No case has reached this stage yet."
      />
    </Card>
  );
}
