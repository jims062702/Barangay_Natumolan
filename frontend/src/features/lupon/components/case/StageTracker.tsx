import { STAGES } from "../../lib/caseStages";
import type { LuponCase } from "../../types";

/**
 * Where the case stands on the Katarungang Pambarangay path.
 */
export function StageTracker({ caseData, reached }: { caseData: LuponCase; reached: Set<string> }) {
  return (
    <div className="mb-6 rounded-2xl border border-gray bg-white p-4">
      <div className="flex items-center gap-1 overflow-x-auto">
        {STAGES.map((stage, index) => {
          const here = caseData.current_stage === stage;
          const been = reached.has(stage);

          return (
            <div key={stage} className="flex items-center">
              <div
                className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold ${
                  here
                    ? "bg-primary text-white ring-2 ring-primary/30"
                    : been
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary text-gray-400"
                }`}
              >
                {index + 1}. {stage}
                {here && <span className="font-normal opacity-90">· now</span>}
              </div>
              {index < STAGES.length - 1 && (
                <span className="mx-1 h-0.5 w-6 bg-gray" aria-hidden="true" />
              )}
            </div>
          );
        })}

        {/*
          Arbitration is a branch off the main line, not a step along it —
          the flowchart draws it to one side, reachable from mediation or
          from conciliation when both parties agree to it.
        */}
        {(caseData.current_stage === "Arbitration" || reached.has("Arbitration")) && (
          <>
            <span className="mx-1 h-0.5 w-6 bg-gray" aria-hidden="true" />
            <div className="whitespace-nowrap rounded-full bg-warning/20 px-4 py-1.5 text-xs font-semibold text-amber-700">
              Arbitration · now
            </div>
          </>
        )}

        {["Dismissed", "Referred"].includes(caseData.current_stage) && (
          <>
            <span className="mx-1 h-0.5 w-6 bg-gray" aria-hidden="true" />
            <div className="whitespace-nowrap rounded-full bg-danger/10 px-4 py-1.5 text-xs font-semibold text-danger">
              {caseData.current_stage} · left the track
            </div>
          </>
        )}
      </div>

      {/* Which steps were skipped, said out loud rather than left as a gap. */}
      {["Dismissed", "Referred"].includes(caseData.current_stage)
        && !reached.has("Conciliation") && (
        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          No Pangkat ng Tagapagkasundo sat on this case — it left the track before
          conciliation.
        </p>
      )}
    </div>
  );
}
