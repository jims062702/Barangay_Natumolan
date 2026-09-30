import { feeStanding, TONE_CLASSES } from "../../lib/filingFee";
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
  const { rows, total, loading, page, lastPage, setPage, search, setSearch } = ctx;

  return (
    <Card>
      <DataTable
        columns={[
          {
            header: "Case Number",
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
          /* One column: the case is named by its nature (the title follows it). */
          { header: "Nature of the Case", render: (c: LuponCase) => c.case_classification },
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

            The summons cannot go out until the Lupon has seen the receipt, and
            that fact lived only inside the case — so finding which cases were
            ready meant opening them one at a time. Here it is one look down
            a column.

            Two states: Paid once the Lupon has seen the receipt, Unpaid
            until then — the Lupon's own job, with nobody else to wait on.
          */
          {
            header: "Filing fee",
            render: (c: LuponCase) => {
              const paid = (c.payments ?? []).some((p) => p.kind === "Filing" && p.status === "Paid");
              /* The three days, when the fee is still owed: the day it is due, and how long is left. */
              const standing = feeStanding(c) ?? (paid
                ? { tone: "success" as const, label: "Paid", detail: "" }
                : { tone: "warning" as const, label: "Unpaid", detail: "" });

              return (
                <span className="inline-flex flex-col items-start gap-0.5" data-testid="fee-standing">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[standing.tone]}`}>
                    {standing.label}
                  </span>
                  {standing.label !== "Paid" && standing.detail && (
                    <span className="max-w-[13rem] text-[11px] leading-snug text-gray-500">{standing.detail}</span>
                  )}
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
        /* Asked of the server, so a case on another page is still found —
           a complainant's slip says KP-2026-0003, and that has to be enough. */
        onSearch={(text) => {
          setSearch(text);
          setPage(1);
        }}
        searchValue={search}
        searchPlaceholder="Search by Case Number, Nature of the Case, Complainant or Respondent…"
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
