import ChoiceGroup from "../../../../shared/ui/ChoiceGroup";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import type { Resident } from "../../../../shared/types";
import ResidentPicker from "../ResidentPicker";
import { COPY } from "./copy";
import HouseholdPicker from "../HouseholdPicker";
import { memberName } from "../family/memberFormat";
import type { AddRelativeState } from "../../hooks/useAddRelative";
import type { Entry, Relation } from "./types";

/**
 * Where this person lives: in the barangay or outside it, and in which household.
 */
export function EntryResidence({ ctx, entry, index, relation, resident }: {
  ctx: AddRelativeState;
  entry: Entry;
  index: number;
  relation: Relation;
  resident: Resident;
}) {
  const {
    updateEntry, subjectName, copy, chooseHouseMode, subjectHousehold, chooseGuardian,
    selectHousehold, setHhForIndex, toggleOwner,
  } = ctx;

  return (
    <div className="space-y-4 rounded-xl border border-gray bg-white p-4">
      <ChoiceGroup
        label="Where does this person live?"
        value={entry.livesOutside}
        onChange={(value) => updateEntry(index, { livesOutside: value })}
        options={[
          {
            value: false,
            label: "In Barangay Natumolan",
            hint: `Registered as a full resident record — the same information as Register Resident — and linked as ${subjectName}'s ${copy.verb}. Give an email address and their portal account is created and emailed to them.`,
          },
          {
            value: true,
            label: "Outside the barangay",
            hint: "Recorded so the family is complete, but NOT as a barangay resident: no portal account, and not counted in the population. Only a name, a number and an address are needed. If they move here later the record can be converted, and the family links come with them.",
          },
        ]}
      />

      {entry.livesOutside === false && (
        <div className="border-t border-gray pt-4">
          <ChoiceGroup
            label="Which household?"
            value={entry.houseMode}
            onChange={(value) => chooseHouseMode(index, value)}
            options={[
              { value: "same" as const, label: `Same as ${subjectName}` },
              ...(relation === "child"
                ? [
                    {
                      value: "guardian" as const,
                      label: "With their guardian",
                      hint: "For a child who does not live with this parent — left with a lola, a tita, a neighbour. The household is taken from that person, and they are recorded as the child's guardian in the same step.",
                    },
                  ]
                : []),
              { value: "other" as const, label: "A different household" },
            ]}
          />

          {entry.houseMode === "" ? (
            <p className="mt-3 text-xs text-warning">
              Not answered yet — saved like this, they will have no household on
              record.
            </p>
          ) : entry.houseMode === "same" ? (
            <p className="mt-3 text-xs text-gray-500">
              {subjectHousehold
                ? `Household ${subjectHousehold.household_number}${
                    subjectHousehold.street_address
                      ? ` · ${subjectHousehold.street_address}`
                      : ""
                  }`
                : `${subjectName} has no household on record, so none is assigned here either.`}
            </p>
          ) : entry.houseMode === "guardian" ? (
            <div className="mt-3 space-y-3">
              <ResidentPicker
                value={entry.guardian}
                onChange={(person) => chooseGuardian(index, person)}
                excludeIds={[resident.id]}
              />
              {entry.guardian && (
                <>
                  <FormField
                    label="How are they related to the child?"
                    hint="Or that they are not related at all — whoever the child was left with."
                  >
                    <select
                      value={entry.guardianRelation}
                      onChange={(e) =>
                        updateEntry(index, { guardianRelation: e.target.value })
                      }
                      className={inputClasses}
                    >
                      <option value="">Not specified</option>
                      {COPY.guardian.labels.map((label) => (
                        <option key={label}>{label}</option>
                      ))}
                    </select>
                  </FormField>
                  <p className="rounded-xl bg-secondary/70 px-4 py-2.5 text-xs leading-relaxed text-gray-600">
                    The child is filed in{" "}
                    <strong>{memberName(entry.guardian)}</strong>&rsquo;s household,
                    and recorded as being in their care. {subjectName} stays the
                    parent either way &mdash; a guardian is not a parent, and
                    nothing on the family tree is derived from one.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <HouseholdPicker
                value={entry.form.household_id}
                selected={entry.household}
                onSelect={(household) => selectHousehold(index, household)}
                onAddNew={() => setHhForIndex(index)}
                placeholder="Search by household number, street or owner…"
              />
              {entry.household && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleOwner(index)}
                    aria-pressed={entry.makeOwner}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                      entry.makeOwner
                        ? "border-primary bg-primary text-white"
                        : "border-gray bg-white text-dark hover:border-primary hover:text-primary"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                        entry.makeOwner ? "border-white bg-white/20" : "border-gray"
                      }`}
                    >
                      {entry.makeOwner ? "✓" : ""}
                    </span>
                    Set{" "}
                    {`${entry.form.first_name} ${entry.form.last_name}`.trim() ||
                      "this person"}{" "}
                    as that household&rsquo;s owner (head)
                  </button>
                  {entry.makeOwner && entry.household.head && (
                    <span className="block text-xs text-warning">
                      Replaces the current owner: {entry.household.head.first_name}{" "}
                      {entry.household.head.last_name}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
