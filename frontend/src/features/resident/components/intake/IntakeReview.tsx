import { FiEdit2 } from "react-icons/fi";
import { Link } from "react-router-dom";
import Card from "../../../../shared/ui/Card";
import { confirmAction } from "../../../../shared/lib/confirm";
import { RELATIONS } from "./relations";
import type { ResidentIntakeState } from "../../hooks/useResidentIntake";

/**
 * The last look before the household goes on the register.
 */
export function IntakeReview({ ctx }: { ctx: ResidentIntakeState }) {
  const {
    duplicates, total, selectedHousehold, personSummary, form, manualSectors, makeOwner,
    members, otherParentName, setStep, saving, residentName, register,
  } = ctx;

  return (
    <div className="space-y-4">
      {/*
        Everybody the server thinks is already on the register, together.
        Asked one at a time, the fourth prompt is answered without being
        read — which is worse than not asking.
      */}
      {duplicates && duplicates.length > 0 && (
        <Card>
          <p className="mb-3 text-sm font-bold text-warning">
            Check these before continuing
          </p>
          <div className="space-y-3">
            {duplicates.map((entry) => (
              <div key={entry.who} className="rounded-xl bg-warning/10 px-4 py-3">
                <p className="text-sm font-semibold text-dark">
                  {entry.name}{" "}
                  <span className="font-normal text-gray-500">({entry.who})</span>
                </p>
                <ul className="mt-2 space-y-1">
                  {entry.namesakes.map((n) => (
                    <li key={n.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-dark">
                        {n.full_name}
                        {n.resident_number ? ` · ${n.resident_number}` : ""}
                        {n.zone_purok ? ` · ${n.zone_purok}` : ""}
                      </span>
                      <Link
                        to={`/residents/${n.id}`}
                        target="_blank"
                        className="shrink-0 font-semibold text-primary hover:underline"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            If these are genuinely different people, continue. If one of them is the same
            person, go back and remove them from this household — registering them twice
            splits their records, and the split has to be repaired later.
          </p>
        </Card>
      )}

      <Card>
        <p className="mb-4 rounded-xl bg-primary/10 px-4 py-2.5 text-sm text-dark">
          <strong>{total}</strong> {total === 1 ? "person" : "people"} will be added to the
          registry
          {selectedHousehold
            ? ` in household ${selectedHousehold.household_number}`
            : " with no household set"}
          .
        </p>

        <div className="space-y-3">
          {personSummary(
            form,
            manualSectors,
            "Household owner",
            makeOwner ? "Set as owner" : undefined
          )}
          {members.map((m, index) => (
            <div key={index}>
              {personSummary(
                m.form,
                m.livesOutside ? [] : m.manualSectors,
                m.relationship ||
                  (RELATIONS.find((r) => r.value === m.relation)?.label ?? "Member"),
                m.livesOutside
                  ? "Lives outside — not counted"
                  : m.relation === "none"
                    ? "No family link"
                    : undefined,
                index
              )}
              {m.relation === "spouse" && m.unionType === "Live-in" && (
                <p className="mt-1 pl-4 text-xs text-gray-500">
                  Recorded as <span className="font-semibold text-dark">living together</span>,
                  not married.
                </p>
              )}
              {m.relation === "child" && m.otherParent && (
                <p className="mt-1 pl-4 text-xs text-gray-500">
                  Other parent: <span className="font-semibold text-dark">{otherParentName(m)}</span>
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStep("form")}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-gray bg-white py-2.5 text-sm font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
          >
            <FiEdit2 className="h-4 w-4" aria-hidden="true" /> Something is wrong — go back
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              if (
                !(await confirmAction({
                  title:
                    total === 1
                      ? `Register ${residentName}?`
                      : `Register all ${total} people?`,
                  text: "They will be added to the resident registry with their family links.",
                  confirmText: "Yes, register",
                }))
              )
                return;
              // Duplicates already shown and read: confirming here is the
              // clerk saying these are different people.
              await register(duplicates !== null);
            }}
            className="flex-1 cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {saving
              ? "Registering…"
              : duplicates
                ? "These are different people — register"
                : `Confirm & register ${total === 1 ? "" : `all ${total}`}`.trim()}
          </button>
        </div>
      </Card>
    </div>
  );
}
