import { FiPlus } from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import { daysLeft } from "../../lib/caseStages";
import { luponApi } from "../../api";
import type { LuponCaseState } from "../../hooks/useLuponCase";
import type { LuponSettlement } from "../../types";

/**
 * The settlement, and whether its terms are being kept.
 */
export function SettlementCard({ ctx, settlement }: {
  ctx: LuponCaseState;
  settlement: LuponSettlement | null | undefined;
}) {
  const { setSettlementOpen, post, id } = ctx;

  return (
    <Card
      title="Settlement & compliance"
      action={
        !settlement && (
          <button type="button" onClick={() => setSettlementOpen(true)} className="cursor-pointer text-sm font-medium text-primary hover:underline">
            <FiPlus className="h-4 w-4" aria-hidden="true" /> Record
          </button>
        )
      }
    >
      {!settlement ? (
        <p className="py-4 text-center text-sm text-gray-400">No settlement recorded.</p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-dark">{settlement.settlement_type}</p>
            <StatusBadge status={settlement.status} />
          </div>
          <p className="rounded-xl bg-secondary p-3 text-dark">{settlement.terms}</p>
          <p className="text-xs text-gray-500">
            Agreed {new Date(settlement.date_agreed).toLocaleDateString("en-PH")} · Repudiation deadline{" "}
            {new Date(settlement.repudiation_deadline).toLocaleDateString("en-PH")}
          </p>
          {settlement.status === "Within Repudiation Period" && (
            <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs font-bold text-warning">
              {daysLeft(settlement.repudiation_deadline)} day(s) left in the 10-day repudiation window
            </p>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {settlement.status === "Within Repudiation Period" && (
              <>
                <button type="button" onClick={() => post(() => luponApi.caseSettlementAction(id, { action: "repudiate" }))} className="cursor-pointer rounded-full border border-danger/40 py-2 text-xs font-semibold text-danger hover:bg-danger hover:text-white">
                  Repudiate
                </button>
                <button type="button" onClick={() => post(() => luponApi.caseSettlementAction(id, { action: "finalize" }))} className="cursor-pointer rounded-full border border-success/40 py-2 text-xs font-semibold text-success hover:bg-success hover:text-white">
                  Mark final
                </button>
              </>
            )}
            {["Final", "Not Complied"].includes(settlement.status) && (
              <>
                <button type="button" onClick={() => post(() => luponApi.caseSettlementAction(id, { action: "mark_complied" }))} className="cursor-pointer rounded-full border border-success/40 py-2 text-xs font-semibold text-success hover:bg-success hover:text-white">
                  Complied
                </button>
                <button type="button" onClick={() => post(() => luponApi.caseSettlementAction(id, { action: "mark_not_complied" }))} className="cursor-pointer rounded-full border border-danger/40 py-2 text-xs font-semibold text-danger hover:bg-danger hover:text-white">
                  Not complied
                </button>
                <button type="button" onClick={() => post(() => luponApi.caseSettlementAction(id, { action: "execute" }))} className="cursor-pointer rounded-full border border-primary/40 py-2 text-xs font-semibold text-primary hover:bg-primary hover:text-white">
                  Execute
                </button>
              </>
            )}
            {!settlement.cfa_issued && (
              <button type="button" onClick={() => post(() => luponApi.caseSettlementAction(id, { action: "issue_cfa" }))} className="cursor-pointer rounded-full border border-gray py-2 text-xs font-semibold text-gray-500 hover:border-primary hover:text-primary">
                Issue CFA
              </button>
            )}
          </div>
          {settlement.cfa_issued && (
            <p className="text-xs font-semibold text-danger">Certificate to File Action issued.</p>
          )}
        </div>
      )}
    </Card>
  );
}
