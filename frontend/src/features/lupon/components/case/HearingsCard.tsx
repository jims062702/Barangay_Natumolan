import { FiPlus } from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import { formatWallClock } from "../../../../shared/lib/datetime";
import type { LuponCaseState } from "../../hooks/useLuponCase";
import type { LuponCase } from "../../types";

/**
 * Every hearing held or set, and the summons behind each.
 */
export function HearingsCard({ ctx, caseData }: { ctx: LuponCaseState; caseData: LuponCase }) {
  const { setHearingOpen, setMediationOpen, setConciliationOpen } = ctx;

  return (
    <Card
      title="Hearings & summons"
      action={
        <button type="button" onClick={() => setHearingOpen(true)} className="cursor-pointer text-sm font-medium text-primary hover:underline">
          <FiPlus className="h-4 w-4" aria-hidden="true" /> Schedule
        </button>
      }
    >
      {(caseData.hearings ?? []).length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">No hearings yet.</p>
      ) : (
        <ul className="space-y-3">
          {caseData.hearings?.map((hearing) => (
            <li key={hearing.id} className="rounded-xl bg-secondary p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-dark">{hearing.hearing_type}</p>
                <StatusBadge status={hearing.status} />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {formatWallClock(hearing.scheduled_at)}
                {hearing.summons_issued && " · Summons issued"}
              </p>
              {hearing.outcome && <p className="mt-1 text-xs font-medium text-primary">{hearing.outcome}</p>}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMediationOpen(true)}
          className="cursor-pointer rounded-full border border-primary/30 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
        >
          Record mediation
        </button>
        <button
          type="button"
          onClick={() => setConciliationOpen(true)}
          className="cursor-pointer rounded-full border border-primary/30 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
        >
          Record conciliation
        </button>
      </div>
    </Card>
  );
}
