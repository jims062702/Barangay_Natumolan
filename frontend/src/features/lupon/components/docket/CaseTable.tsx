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
            header: "Case Docket",
            className: "whitespace-nowrap font-semibold text-primary",
            render: (c: LuponCase) => (
              <span className="font-semibold text-primary" title={`Case Docket #${c.docket_number ?? "—"}`}>
                #{c.docket_number ?? "—"}
              </span>
            ),
          },
          {
            header: "Case Number",
            className: "whitespace-nowrap font-medium min-w-[130px]",
            render: (c: LuponCase) => {
              if (!c.case_number) {
                return (
                  <Link
                    to={`/lupon/cases/${c.id}`}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-amber-600 hover:text-amber-800 hover:underline"
                    title="Case number will be assigned once filing fee is paid"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    Pending Payment
                  </Link>
                );
              }
              return c.id < 0 ? (
                <span className="font-medium text-gray-500 whitespace-nowrap" title="Waiting to be sent to the office record">
                  {c.case_number}
                </span>
              ) : (
                <Link to={`/lupon/cases/${c.id}`} className="font-medium text-primary hover:underline whitespace-nowrap">
                  {c.case_number}
                </Link>
              );
            },
          },
          /* One column: the case is named by its nature (the title follows it). */
          {
            header: "Nature of the Case",
            className: "whitespace-nowrap font-medium text-dark text-xs min-w-[130px]",
            render: (c: LuponCase) => c.case_classification,
          },
          {
            header: "Complainant",
            className: "whitespace-nowrap min-w-[140px]",
            render: (c: LuponCase) => (
              <span className="text-xs font-medium text-dark inline-flex items-center gap-1.5 whitespace-nowrap">
                {c.complainant_display_name ?? "—"}
                {c.complainant_is_resident === false && (
                  <span className="rounded-full bg-gray px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 whitespace-nowrap">
                    non-resident
                  </span>
                )}
              </span>
            ),
          },
          {
            header: "Respondent",
            className: "whitespace-nowrap min-w-[140px]",
            render: (c: LuponCase) => (
              <span className="text-xs font-medium text-dark whitespace-nowrap">{c.respondent_display_names || "—"}</span>
            ),
          },
          {
            header: "Filed",
            className: "whitespace-nowrap text-xs text-gray-600 min-w-[90px]",
            render: (c: LuponCase) => new Date(c.date_filed).toLocaleDateString("en-PH"),
          },
          {
            header: "Filing fee",
            className: "whitespace-nowrap min-w-[95px]",
            render: (c: LuponCase) => {
              const paid = (c.payments ?? []).some((p) => p.kind === "Filing" && p.status === "Paid");
              const standing = feeStanding(c) ?? (paid
                ? { tone: "success" as const, label: "Paid", detail: "" }
                : { tone: "warning" as const, label: "Unpaid", detail: "" });

              return (
                <span className="inline-flex flex-col items-start gap-0.5 whitespace-nowrap" data-testid="fee-standing">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[standing.tone]}`}>
                    {standing.label}
                  </span>
                  {standing.label !== "Paid" && standing.detail && (
                    <span className="max-w-[13rem] text-[11px] leading-snug text-gray-500 whitespace-nowrap">{standing.detail}</span>
                  )}
                </span>
              );
            },
          },
          {
            header: "Stage",
            className: "whitespace-nowrap min-w-[150px]",
            render: (c: LuponCase) => {
              const stageLabel = c.current_stage_label || (
                ["For Lupon Summons", "Conciliation"].includes(c.current_stage)
                  ? "Lupon"
                  : ["Filed", "For Summons", "Mediation"].includes(c.current_stage)
                    ? "Punong Barangay"
                    : c.current_stage
              );
              return (
                <div className="flex flex-col gap-1 items-start whitespace-nowrap">
                  <span className="font-semibold text-xs text-dark">{stageLabel}</span>
                  <StatusBadge status={c.hearing_stage || c.current_stage} />
                </div>
              );
            },
          },
          {
            header: "Next Hearing",
            className: "whitespace-nowrap min-w-[170px]",
            render: (c: LuponCase) => {
              if (c.current_stage === "CFA") {
                const dateText = c.date_resolved
                  ? `Already Filed CFA · ${new Date(c.date_resolved).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`
                  : (c.next_hearing_info?.day_time || "Already Filed CFA");
                return (
                  <div className="flex flex-col gap-0.5 whitespace-nowrap">
                    <span className="font-semibold text-xs text-rose-600">
                      {c.next_hearing_info?.title || "CFA Issued"}
                    </span>
                    <span className="text-[11px] text-gray-600 font-mono">
                      {dateText}
                    </span>
                  </div>
                );
              }

              if (!c.next_hearing_info || c.next_hearing_info.schedule === "—") {
                return <span className="text-xs text-gray-400">—</span>;
              }
              return (
                <div className="flex flex-col gap-0.5 whitespace-nowrap">
                  <span className="font-semibold text-xs text-primary">{c.next_hearing_info.title}</span>
                  <span className="text-[11px] text-gray-600 font-mono">{c.next_hearing_info.day_time}</span>
                </div>
              );
            },
          },
          {
            header: "Next step",
            className: "whitespace-nowrap text-right min-w-[140px]",
            render: (c: LuponCase) => {
              const step = nextStep(c);
              return (
                <Link
                  to={step.to}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white whitespace-nowrap"
                >
                  {step.label}
                  <FiArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                </Link>
              );
            },
          },
        ]}
        rows={rows}
        rowKey={(c) => c.id}
        total={total}
        searchable
        tableClassName="min-w-[70rem]"
        /* Asked of the server, so a case on another page is still found —
           a complainant's slip says KP-2026-0003, and that has to be enough. */
        onSearch={(text) => {
          setSearch(text);
          setPage(1);
        }}
        searchValue={search}
        searchPlaceholder="Search by Case Docket #, Case Number, Nature of the Case, Complainant or Respondent…"
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
