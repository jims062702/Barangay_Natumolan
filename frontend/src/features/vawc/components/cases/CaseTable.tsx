import { FiEye, FiEdit2 } from "react-icons/fi";
import { Link } from "react-router-dom";
import Card from "../../../../shared/ui/Card";
import DataTable from "../../../../shared/ui/DataTable";
import { formatWallClock } from "../../../../shared/lib/datetime";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import RowAction, { RowActions } from "../../../../shared/ui/RowAction";
import { RiskBadge } from "../RiskBadge";
import { NextDue } from "../NextDue";
import type { CaseRegistryState } from "../../hooks/useCaseRegistry";
import type { VawcCase } from "../../types";

/**
 * The docket: every case, by code — never by the survivor's name.
 */
export function CaseTable({ ctx }: { ctx: CaseRegistryState }) {
  const { openEdit, rows, total, loading, page, lastPage, setPage } = ctx;

  return (
    <Card>
      <DataTable
        columns={[
          {
            header: "Case Code",
            render: (c: VawcCase) => (
              <Link to={`/vawc/cases/${c.id}`} className="font-mono font-semibold text-primary hover:underline">
                {c.case_code}
              </Link>
            ),
          },
          { header: "Violence Type", render: (c: VawcCase) => c.violence_type },
          /*
           * Risk and the next visit, which are what the docket is opened
           * for. Everything else on this row is filing; these two are the
           * work.
           */
          { header: "Risk", render: (c: VawcCase) => <RiskBadge level={c.risk_level} /> },
          {
            header: "Next follow-up",
            render: (c: VawcCase) => <NextDue on={c.next_followup_date} />,
          },
          {
            header: "Reported",
            render: (c: VawcCase) => formatWallClock(c.report_date),
          },
          {
            header: "Children Involved",
            render: (c: VawcCase) => (c.children_involved ? `Yes (${c.children_count})` : "No"),
          },
          { header: "Officer", render: (c: VawcCase) => c.officer?.name ?? "—" },
          { header: "Status", render: (c: VawcCase) => <StatusBadge status={c.status} /> },
          {
            header: "Actions",
            render: (c: VawcCase) => (
              <RowActions>
                <RowAction
                  label="Open case"
                  icon={FiEye}
                  tone="primary"
                  to={`/vawc/cases/${c.id}`}
                />
                <RowAction label="Edit case" icon={FiEdit2} onClick={() => openEdit(c)} />
              </RowActions>
            ),
          },
        ]}
        rows={rows}
        rowKey={(c) => c.id}
        numbered
        total={total}
        searchable
        searchPlaceholder="Search by case code…"
        getSearchText={(c) => `${c.case_code} ${c.violence_type} ${c.status} ${c.risk_level ?? ""}`}
        filters={[
          { label: "Status", getValue: (c) => c.status },
          { label: "Violence Type", getValue: (c) => c.violence_type },
          /*
           * The docket is opened to find the urgent ones. Cases nobody has
           * judged group under their own label rather than vanishing — an
           * unjudged case is not a safe one.
           */
          { label: "Risk", getValue: (c) => c.risk_level ?? "Not assessed" },
        ]}
        loading={loading}
        page={page}
        lastPage={lastPage}
        onPageChange={setPage}
        emptyMessage="No cases in the registry."
      />
    </Card>
  );
}
