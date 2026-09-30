import Card from "../../../../shared/ui/Card";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import { formatWallClock } from "../../../../shared/lib/datetime";
import type { LuponCaseState } from "../../hooks/useLuponCase";
import type { LuponCase } from "../../types";
import { useAuth } from "../../../../shared/auth/AuthContext";

/**
 * Every hearing held or set, and the summons behind each.
 */
export function HearingsCard({ ctx, caseData }: { ctx: LuponCaseState; caseData: LuponCase }) {
  const { setMediationOpen, setConciliationOpen } = ctx;
  /*
   * Recording what happened at a sitting is the Punong Barangay's, because
   * the PB is the one who sat at it. The Lupon secretary keeps the docket
   * and takes the minutes; they do not decide what the mediation concluded.
   */
  const isPb = useAuth().user?.role === "Punong Barangay";

  /*
   * EARLIEST FIRST.
   *
   * The list came back newest-first, so the sitting the office is actually
   * going to — the next one — was at the bottom, under two later dates
   * nobody has reached yet. A calendar is read forwards.
   */
  const hearings = [...(caseData.hearings ?? [])].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
  );

  return (
    /*
     * NO "SCHEDULE" BUTTON, and that is the point of the new flow.
     *
     * Confirming the filing fee puts the Punong Barangay's Tuesdays on the
     * calendar, and a failed mediation puts the Lupon's Thursdays there.
     * A hand-set date beside those was a second calendar: the office booked
     * a sitting here that the summons never mentioned.
     */
    <Card title="Hearings & summons">
      {hearings.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">No hearings yet.</p>
      ) : (
        <ul className="space-y-3">
          {hearings.map((hearing) => (
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
      {isPb ? (
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
      ) : (
        <p className="mt-4 rounded-xl bg-secondary px-3.5 py-2.5 text-xs leading-relaxed text-gray-500">
          The Punong Barangay records what was concluded at a sitting — they are the one who sat
          at it. The minutes of each sitting are written on the hearing itself.
        </p>
      )}
    </Card>
  );
}
