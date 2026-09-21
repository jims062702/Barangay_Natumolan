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
            /*
             * A case filed with no line has no id to open yet: the server has
             * never seen it. It is shown, because the clerk filed it and it
             * has to be visible somewhere — but as plain text, since a link
             * to /lupon/cases/-1 would land on an error page.
             */
            render: (c: LuponCase) => (c.id < 0 ? (
              <span className="font-medium text-gray-500" title="Waiting to be sent to the office record">
                {c.case_number}
              </span>
            ) : (
              <Link to={`/lupon/cases/${c.id}`} className="font-medium text-primary hover:underline">
                {c.case_number}
              </Link>
            )),
          },
          { header: "Title", render: (c: LuponCase) => c.case_title },
          { header: "Classification", render: (c: LuponCase) => c.case_classification },
          /*
            TWO COLUMNS, not one cell with two labelled lines.

            They are the two sides of a dispute, and a clerk scanning the
            docket is looking down ONE of them — "is my respondent already on
            here?". Stacked under a single heading, each name needed its own
            label to say which side it was, both lines truncated at half the
            width they deserved, and neither column could be read down.
          */
          {
            header: "Complainant",
            render: (c: LuponCase) => (
              <span className="text-xs">
                {c.complainant_display_name ?? "—"}
                {/* Only ever on this side: it describes who FILED. A
                    respondent from outside the barangay cannot exist —
                    that is what gives the Lupon jurisdiction. */}
                {c.complainant_is_resident === false && (
                  <span className="ml-1 rounded-full bg-gray px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                    non-resident
                  </span>
                )}
              </span>
            ),
          },
          {
            header: "Respondent",
            render: (c: LuponCase) => (
              <span className="text-xs">{c.respondent_display_names || "—"}</span>
            ),
          },
          {
            header: "Filed",
            render: (c: LuponCase) => new Date(c.date_filed).toLocaleDateString("en-PH"),
          },
          /*
            THE FEE, ON THE DOCKET.

            The summons cannot go out until the Clerk marks it settled, and
            that fact lived only inside the case — so finding which cases were
            ready meant opening them one at a time. Here it is one look down
            a column.

            Three states, and the third is not the second: "not asked for
            yet" is the Lupon's own job still to do, while "with the Clerk"
            is a wait on somebody else.
          */
          {
            header: "Filing fee",
            render: (c: LuponCase) => {
              const fee = (c.payments ?? []).find(
                (p) => p.kind === "Filing" && p.status !== "Cancelled",
              );

              if (!fee) {
                return <span className="text-xs text-gray-400">Not sent yet</span>;
              }

              return fee.status === "Paid" ? (
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                  Paid
                </span>
              ) : (
                <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
                  With the Clerk
                </span>
              );
            },
          },
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
        searchPlaceholder="Search by case number, title or party…"
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
