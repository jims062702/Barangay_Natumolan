import ChoiceGroup from "../../../../shared/ui/ChoiceGroup";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import ResidentPicker from "../ResidentPicker";
import type { ResidentIntakeState } from "../../hooks/useResidentIntake";
import type { OtherParent, OtherParentKind } from "./types";

/**
 * A child's other parent: on the register, somebody elsewhere, or not known.
 */
export function OtherParentFields({ ctx, parent, patch }: {
  ctx: ResidentIntakeState;
  parent: OtherParent | null;
  patch: (changes: Partial<OtherParent>) => void;
}) {
  const { hasSpouse, residentName } = ctx;

  return (
    <div className="mb-4">
      <ChoiceGroup
        label="Who is the child's other parent?"
        value={parent?.kind ?? null}
        onChange={(kind) => patch({ kind })}
        options={[
          ...(hasSpouse
            ? [
                {
                  value: "spouse" as OtherParentKind,
                  label: (residentName || "The owner") + "’s spouse",
                  hint: "The child is recorded as belonging to both of them.",
                },
              ]
            : []),
          {
            value: "resident" as OtherParentKind,
            label: "Someone on the register",
            hint: "Search for them below; the child links to them as well.",
          },
          {
            value: "outside" as OtherParentKind,
            label: "Someone outside the barangay",
            hint:
              "Recorded as a non-resident — a name and a contact, nothing " +
              "more — so the child’s parentage is complete without " +
              "counting them in the population.",
          },
          {
            value: "none" as OtherParentKind,
            label: "Not recorded",
            hint:
              "One parent only. The second can be added later from the " +
              "child’s own profile.",
          },
        ]}
        stretch={false}
      />

      {parent?.kind === "resident" && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-gray-500">
            The other parent
          </p>
          <ResidentPicker
            value={parent.resident}
            onChange={(resident) => patch({ resident })}
            // The answer must not contradict the question:
            // somebody living outside the barangay is not
            // "on the register" in the sense meant here.
            residentsOnly
          />
        </div>
      )}

      {parent?.kind === "outside" && !parent.typing && (
        <div className="mt-3">
          <p className="mb-2 text-xs leading-relaxed text-gray-500">
            Search the people already recorded from outside the barangay — a
            parent named for an earlier child is already here.
          </p>
          <ResidentPicker
            value={parent.resident}
            onChange={(resident) => patch({ resident })}
            nonResidentsOnly
          />
          <button
            type="button"
            onClick={() => patch({ typing: true, resident: null })}
            className="mt-3 cursor-pointer rounded-full border border-gray bg-white px-4 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary"
          >
            Not there — type their details
          </button>
        </div>
      )}

      {parent?.kind === "outside" && parent.typing && (
        <div className="mt-3 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <FormField label="First name" required>
            <input
              value={parent.first_name}
              onChange={(e) => patch({ first_name: e.target.value })}
              required
              className={inputClasses}
            />
          </FormField>
          <FormField label="Last name" required>
            <input
              value={parent.last_name}
              onChange={(e) => patch({ last_name: e.target.value })}
              required
              className={inputClasses}
            />
          </FormField>
          <FormField
            label="Sex"
            hint="What makes the child’s record say Mother or Father."
          >
            <select
              value={parent.gender}
              onChange={(e) => patch({ gender: e.target.value })}
              className={inputClasses}
            >
              <option value="">Not recorded</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
          </FormField>
          <FormField label="Contact number">
            <input
              value={parent.contact_number}
              onChange={(e) => patch({ contact_number: e.target.value })}
              className={inputClasses}
            />
          </FormField>
          <FormField label="Where they live" hint="Town or city is enough.">
            <input
              value={parent.address}
              onChange={(e) => patch({ address: e.target.value })}
              className={inputClasses}
              placeholder="e.g. Riyadh, Saudi Arabia"
            />
          </FormField>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => patch({ typing: false })}
              className="cursor-pointer text-xs font-semibold text-primary hover:underline"
            >
              Search the ones already recorded instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
