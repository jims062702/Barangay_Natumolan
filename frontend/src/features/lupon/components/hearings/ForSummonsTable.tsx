import { FiCheck, FiPrinter } from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import DataTable from "../../../../shared/ui/DataTable";
import RowAction, { RowActions } from "../../../../shared/ui/RowAction";
import { asDate, deskForStage } from "../../lib/hearings";
import type { HearingCalendarState } from "../../hooks/useHearingCalendar";
import type { LuponCase } from "../../types";

/**
 * What has been HANDED to this desk and has no sitting yet.
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
            className: "px-2.5 whitespace-nowrap text-xs",
            render: (c: LuponCase) => (
              <button
                type="button"
                onClick={() => openCaseFile(c.id)}
                className="cursor-pointer whitespace-nowrap font-medium text-primary hover:underline text-xs"
              >
                {c.case_number}
              </button>
            ),
          },
          {
            header: "Nature of Case",
            className: "px-2.5 text-xs",
            render: (c: LuponCase) => (
              <span className="text-xs font-medium text-dark whitespace-nowrap">
                {c.case_classification ?? "—"}
              </span>
            ),
          },
          {
            header: "Complainant",
            className: "px-2.5 text-xs",
            render: (c: LuponCase) => (
              <span className="text-xs font-medium text-dark whitespace-nowrap">
                {c.complainant_display_name ?? "—"}
              </span>
            ),
          },
          {
            header: "Respondent",
            className: "px-2.5 text-xs",
            render: (c: LuponCase) => (
              <span className="text-xs font-medium text-dark whitespace-nowrap">
                {c.respondent_display_names || "—"}
              </span>
            ),
          },
          {
            header: "Whose desk",
            className: "px-2.5 whitespace-nowrap text-xs",
            render: (c: LuponCase) => (
              <span className="whitespace-nowrap text-xs text-dark font-medium">
                {deskForStage(c.current_stage) === "Lupon" ? "The Lupon" : "The Secretary"}
              </span>
            ),
          },
          {
            header: "Notice & summons",
            className: "px-2.5 whitespace-nowrap text-xs",
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
          {
            header: "Actions",
            className: "px-2.5 whitespace-nowrap text-right",
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
