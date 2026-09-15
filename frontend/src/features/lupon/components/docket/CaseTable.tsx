import { FiArrowRight } from "react-icons/fi";
import { Link } from "react-router-dom";
import Card from "../../../../shared/ui/Card";
import DataTable from "../../../../shared/ui/DataTable";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import { nextStep } from "../../lib/docket";
import type { LuponDocketState } from "../../hooks/useLuponDocket";
import type { LuponCase } from "../../types";

/**
 * The docket, with each case's next step.
 */
export function CaseTable({ ctx }: { ctx: LuponDocketState }) {
  const { rows, total, loading, page, lastPage, setPage } = ctx;

  return (
    <Card>
      <DataTable
        columns={[
          {
            header: "Case #",
            render: (c: LuponCase) => (
              <Link to={`/lupon/cases/${c.id}`} className="font-medium text-primary hover:underline">
                {c.case_number}
              </Link>
            ),
          },
          { header: "Title", render: (c: LuponCase) => c.case_title },
          { header: "Classification", render: (c: LuponCase) => c.case_classification },
          {
            header: "Parties",
            render: (c: LuponCase) => (
              <span className="text-xs">
                {c.complainant_display_name ?? "—"}
                {/* Badge sits with the complainant — it describes who filed,
                    not who was complained against. */}
                {c.complainant_is_resident === false && (
                  <span className="mx-1 rounded-full bg-gray px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                    non-resident
                  </span>
                )}{" "}
                vs {c.respondent_display_names || "—"}
              </span>
            ),
          },
          {
            header: "Filed",
            render: (c: LuponCase) => new Date(c.date_filed).toLocaleDateString("en-PH"),
          },
          { header: "Jurisdiction", render: (c: LuponCase) => <StatusBadge status={c.jurisdiction_status} /> },
          { header: "Stage", render: (c: LuponCase) => <StatusBadge status={c.current_stage} /> },
          {
            header: "Next step",
            render: (c: LuponCase) => {
              const step = nextStep(c);
              return (
                <Link
                  to={step.to}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  {step.label}
                  <FiArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              );
            },
          },
        ]}
        rows={rows}
        rowKey={(c) => c.id}
        numbered
        total={total}
        searchable
        searchPlaceholder="Search by case #, title, or party…"
        getSearchText={(c) =>
          `${c.case_number} ${c.case_title} ${c.case_classification} ${
            c.complainant_display_name ?? ""
          } ${c.respondent_display_names ?? ""}`
        }
        filters={[{ label: "Stage", getValue: (c) => c.current_stage }]}
        loading={loading}
        page={page}
        lastPage={lastPage}
        onPageChange={setPage}
        emptyMessage="No cases on the docket."
      />
    </Card>
  );
}
