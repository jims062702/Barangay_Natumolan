import { FiEdit2 } from "react-icons/fi";
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
 * Every settlement, with the deadline that matters most.
 */
export function SettlementTable({ ctx }: { ctx: SettlementDocketState }) {
  const { dueOnly, setPage, setDueOnly, open, rows, total, loading, page, lastPage } = ctx;

  return (
    <Card>
      <label className="mb-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-dark">
        <input
          type="checkbox"
          checked={dueOnly}
          onChange={(e) => {
            setPage(1);
            setDueOnly(e.target.checked);
          }}
          className="h-4 w-4 cursor-pointer accent-primary"
        />
        Show only obligations past their compliance deadline
      </label>

      <DataTable
        columns={[
          {
            header: "Case No.",
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
            header: "Parties",
            render: (s: LuponSettlement) => (
              <div className="min-w-0 text-xs">
                <p className="truncate text-dark">
                  <span className="text-gray-400">Complainant:</span>{" "}
                  {s.lupon_case?.complainant_display_name ?? "—"}
                  {s.lupon_case?.complainant_is_resident === false && (
                    <span className="ml-1 rounded-full bg-gray px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                      non-resident
                    </span>
                  )}
                </p>
                <p className="truncate text-dark">
                  <span className="text-gray-400">Respondent:</span>{" "}
                  {s.lupon_case?.respondent_display_names || "—"}
                </p>
              </div>
            ),
          },
          { header: "Type", render: (s: LuponSettlement) => s.settlement_type },
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
          {
            header: "Compliance due",
            render: (s: LuponSettlement) => (
              <Deadline
                date={s.compliance_deadline}
                active={["Final", "Not Complied"].includes(s.status)}
              />
            ),
          },
          {
            header: "Certificates",
            render: (s: LuponSettlement) => {
              const issued = [
                s.cfa_issued && { code: "CFA", title: "Certificate to File Action — may proceed to court" },
                s.cba_issued && { code: "CBA", title: "Certificate to Bar Action — barred from court" },
              ].filter(Boolean) as { code: string; title: string }[];

              return issued.length ? (
                <span className="text-xs font-semibold text-primary">
                  {issued.map((c, i) => (
                    <span key={c.code} title={c.title} className="cursor-help">
                      {i > 0 && " · "}
                      {c.code}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              );
            },
          },
          { header: "Status", render: (s: LuponSettlement) => <StatusBadge status={s.status} /> },
          {
            header: "Actions",
            render: (s: LuponSettlement) => (
              <RowActions>
                <RowAction label="Manage settlement" icon={FiEdit2} onClick={() => open(s)} />
              </RowActions>
            ),
          },
        ]}
        rows={rows}
        rowKey={(s) => s.id}
        numbered
        total={total}
        searchable
        searchPlaceholder="Search by case number, party, title or terms…"
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
