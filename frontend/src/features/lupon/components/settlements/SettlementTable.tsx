import { FiEye } from "react-icons/fi";
import { Link } from "react-router-dom";
import Card from "../../../../shared/ui/Card";
import DataTable from "../../../../shared/ui/DataTable";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import RowAction, { RowActions } from "../../../../shared/ui/RowAction";
import { asDate, STATUSES } from "../../lib/settlements";
import { Deadline } from "./Deadline";
import type { SettlementDocketState } from "../../hooks/useSettlementDocket";
import type { LuponSettlement } from "../../types";

/**
 * Every settlement, and how long a party still has to repudiate it.
 */
export function SettlementTable({ ctx }: { ctx: SettlementDocketState }) {
  const { setPage, open, rows, total, loading, page, lastPage } = ctx;

  /* No "past their compliance deadline" filter: there is no deadline on a
     settlement any more — see useSettlementDocket. */
  return (
    <Card>
      <DataTable
        columns={[
          {
            header: "Case Number",
            render: (s: LuponSettlement) =>
              s.lupon_case ? (
                <Link
                  to={`/lupon/cases/${s.lupon_case.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {s.lupon_case.case_number}
                </Link>
              ) : (
                "—"
              ),
          },
          {
            /*
              TWO COLUMNS, not one cell with two labelled lines.

              They are the two sides of a dispute, and whoever reads this list
              is looking down ONE of them. Stacked under a single heading each
              name needed a label to say which side it was, both truncated at
              half the width they deserved, and neither could be read down.
            */
            header: "Complainant",
            render: (s: LuponSettlement) => (
              <span className="text-xs text-dark">
                {s.lupon_case?.complainant_display_name ?? "—"}
                {s.lupon_case?.complainant_is_resident === false && (
                  <span className="ml-1 rounded-full bg-gray px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                    non-resident
                  </span>
                )}
              </span>
            ),
          },
          {
            header: "Respondent",
            render: (s: LuponSettlement) => (
              <span className="text-xs text-dark">
                {s.lupon_case?.respondent_display_names || "—"}
              </span>
            ),
          },
          /* No Type column: there is one kind of settlement now, and a column
             reading "Amicable Settlement" on every row says nothing. */
          { header: "Agreed", render: (s: LuponSettlement) => asDate(s.date_agreed) },
          {
            header: "Repudiation deadline",
            render: (s: LuponSettlement) => (
              <Deadline
                date={s.repudiation_deadline}
                active={s.status === "Within Repudiation Period"}
              />
            ),
          },
          { header: "Status", render: (s: LuponSettlement) => <StatusBadge status={s.status} /> },
          {
            header: "Actions",
            render: (s: LuponSettlement) => (
              <RowActions>
                <RowAction label="View the settlement" icon={FiEye} onClick={() => open(s)} />
              </RowActions>
            ),
          },
        ]}
        rows={rows}
        rowKey={(s) => s.id}
        numbered
        total={total}
        searchable
        searchPlaceholder="Search by Case Number, Complainant, Respondent or Terms…"
        getSearchText={(s) =>
          `${s.lupon_case?.case_number ?? ""} ${s.lupon_case?.case_title ?? ""} ${
            s.lupon_case?.complainant_display_name ?? ""
          } ${s.lupon_case?.respondent_display_names ?? ""} ${s.settlement_type} ${s.terms}`
        }
        filters={[
          { label: "Status", getValue: (s) => s.status, options: STATUSES },
          { label: "Type", getValue: (s) => s.settlement_type },
        ]}
        loading={loading}
        page={page}
        lastPage={lastPage}
        onPageChange={setPage}
        emptyMessage="No settlements recorded yet."
      />
    </Card>
  );
}
