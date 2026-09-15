import { FiSend, FiCheckSquare, FiRotateCcw, FiFileText } from "react-icons/fi";
import { Link } from "react-router-dom";
import Card from "../../../../shared/ui/Card";
import DataTable from "../../../../shared/ui/DataTable";
import { formatWallClock } from "../../../../shared/lib/datetime";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import RowAction, { RowActions } from "../../../../shared/ui/RowAction";
import { asDate, HEARING_TYPES } from "../../lib/hearings";
import type { HearingCalendarState } from "../../hooks/useHearingCalendar";
import type { LuponHearing } from "../../types";

/**
 * The hearing calendar.
 */
export function HearingTable({ ctx }: { ctx: HearingCalendarState }) {
  const {
    openSummons, openOutcome, openReset, openForms, rows, total, loading, page, lastPage,
    setPage, view,
  } = ctx;

  return (
    <Card>
      <DataTable
        columns={[
          {
            header: "Case No.",
            render: (h: LuponHearing) =>
              h.lupon_case ? (
                <Link
                  to={`/lupon/cases/${h.lupon_case.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {h.lupon_case.case_number}
                </Link>
              ) : (
                "—"
              ),
          },
          {
            header: "Title",
            render: (h: LuponHearing) => (
              <span className="block max-w-xs truncate" title={h.lupon_case?.case_title}>
                {h.lupon_case?.case_title ?? "—"}
              </span>
            ),
          },
          {
            header: "Parties",
            render: (h: LuponHearing) => (
              <span className="block max-w-xs truncate text-xs text-gray-500">
                {h.lupon_case?.complainant_display_name ?? "—"}
                {h.lupon_case?.complainant_is_resident === false && " (non-resident)"} vs{" "}
                {h.lupon_case?.respondent_display_names || "—"}
              </span>
            ),
          },
          { header: "Type", render: (h: LuponHearing) => h.hearing_type },
          { header: "Schedule", render: (h: LuponHearing) => formatWallClock(h.scheduled_at) },
          {
            header: "Summons",
            render: (h: LuponHearing) => {
              if (!h.summons_issued) {
                return <span className="text-xs text-gray-400">Not issued</span>;
              }
              return h.summons_served_date ? (
                <span className="text-xs text-success">Served {asDate(h.summons_served_date)}</span>
              ) : (
                <span className="text-xs font-semibold text-warning">Awaiting service</span>
              );
            },
          },
          {
            header: "Attendance",
            render: (h: LuponHearing) =>
              h.complainant_present === null || h.complainant_present === undefined ? (
                "—"
              ) : (
                <span className="text-xs text-gray-500">
                  C: {h.complainant_present ? "Present" : "Absent"} · R:{" "}
                  {h.respondent_present ? "Present" : "Absent"}
                </span>
              ),
          },
          { header: "Status", render: (h: LuponHearing) => <StatusBadge status={h.status} /> },
          {
            header: "Actions",
            render: (h: LuponHearing) => (
              <RowActions>
                {h.status === "Scheduled" && (
                  <>
                    <RowAction
                      label="Record summons"
                      icon={FiSend}
                      onClick={() => openSummons(h)}
                    />
                    <RowAction
                      label="Record the outcome"
                      icon={FiCheckSquare}
                      tone="primary"
                      onClick={() => openOutcome(h)}
                    />
                    <RowAction
                      label="Reschedule"
                      icon={FiRotateCcw}
                      onClick={() => openReset(h)}
                    />
                  </>
                )}
                <RowAction label="KP forms" icon={FiFileText} onClick={() => openForms(h)} />
              </RowActions>
            ),
          },
        ]}
        rows={rows}
        rowKey={(h) => h.id}
        numbered
        total={total}
        searchable
        searchPlaceholder="Search by case number, title or type…"
        getSearchText={(h) =>
          `${h.lupon_case?.case_number ?? ""} ${h.lupon_case?.case_title ?? ""} ${
            h.lupon_case?.complainant_display_name ?? ""
          } ${h.lupon_case?.respondent_display_names ?? ""} ${h.hearing_type} ${h.status}`
        }
        filters={[
          { label: "Type", getValue: (h) => h.hearing_type, options: HEARING_TYPES },
          { label: "Status", getValue: (h) => h.status },
        ]}
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
