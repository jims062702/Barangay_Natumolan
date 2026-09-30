import { Link } from "react-router-dom";
import Card from "../../../../shared/ui/Card";
import DataTable from "../../../../shared/ui/DataTable";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import { asDate } from "../../lib/hearings";
import type { HearingCalendarState } from "../../hooks/useHearingCalendar";
import type { LuponCase } from "../../types";

/**
 * The two lists the hearing room keeps beside the calendar: complaints the
 * complainant took back, and cases certified to court.
 *
 * Each carries the words that go with it. "Withdrawn" with no reason is a
 * case nobody can explain a year later, and a certificate to file action is
 * only as good as what it rests on.
 */
export function ClosedCaseTable({ ctx }: { ctx: HearingCalendarState }) {
  const { view, cases, total, loading, page, lastPage, setPage } = ctx;
  const cfa = view === "cfa";

  return (
    <Card>
      <DataTable
        columns={[
          {
            header: "Case Number",
            render: (c: LuponCase) => (
              /* One line: a case number is read as one thing, and broken
                 across three rows it stopped looking like a number. */
              <Link to={`/lupon/cases/${c.id}`} className="whitespace-nowrap font-medium text-primary hover:underline">
                {c.case_number}
              </Link>
            ),
          },
          {
            /* The case is named by its nature — the same column the docket shows. */
            header: "Nature of the Case",
            render: (c: LuponCase) => c.case_classification ?? "—",
          },
          {
            header: "Complainant",
            render: (c: LuponCase) => <span className="text-xs text-dark">{c.complainant_display_name ?? "—"}</span>,
          },
          {
            header: "Respondent",
            render: (c: LuponCase) => <span className="text-xs text-dark">{c.respondent_display_names || "—"}</span>,
          },
          { header: "Filed", render: (c: LuponCase) => asDate(c.date_filed) },
          { header: cfa ? "Certified" : "Withdrawn", render: (c: LuponCase) => asDate(c.date_resolved) },
          {
            header: cfa ? "What it rests on" : "Reason",
            render: (c: LuponCase) => (
              <span className="block max-w-sm text-xs text-gray-600" title={c.closure_reason ?? ""}>
                {c.closure_reason || "—"}
              </span>
            ),
          },
          { header: "Status", render: (c: LuponCase) => <StatusBadge status={c.current_stage} /> },
        ]}
        rows={cases}
        rowKey={(c) => c.id}
        numbered
        total={total}
        searchable
        searchPlaceholder="Search by Case Number, Nature of the Case, Complainant or Respondent…"
        getSearchText={(c) =>
          `${c.case_number} ${c.case_title} ${c.case_classification ?? ""} ${c.complainant_display_name ?? ""} ${c.respondent_display_names ?? ""} ${c.closure_reason ?? ""}`
        }
        loading={loading}
        page={page}
        lastPage={lastPage}
        onPageChange={setPage}
        emptyMessage={cfa ? "No case has been certified to file action." : "No complaint has been withdrawn."}
      />
    </Card>
  );
}
