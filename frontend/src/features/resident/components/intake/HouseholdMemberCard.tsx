import { FiX } from "react-icons/fi";
import ChoiceGroup from "../../../../shared/ui/ChoiceGroup";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { RELATIONS, wordChoices, CHILD_WORDS, PARENT_WORDS, isAdopted, parentWord, BLANK_OTHER_PARENT } from "./relations";
import { OtherParentFields } from "./OtherParentFields";
import ResidentFormFields from "../ResidentFormFields";
import type { ResidentIntakeState } from "../../hooks/useResidentIntake";
import type { Member, OtherParent } from "./types";

/**
 * One more person living in the house, and what they are to the head.
 */
export function HouseholdMemberCard({ ctx, index, member }: {
  ctx: ResidentIntakeState;
  index: number;
  member: Member;
}) {
  const {
    setMembers, residentName, setMember, hasSpouse, form, spouseGender, spouseName,
    patchMember, selectedHousehold,
  } = ctx;

  return (
    <div className="rounded-2xl border border-gray bg-secondary/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-dark">
          {index + 1}.{" "}
          {`${member.form.first_name} ${member.form.last_name}`.trim() ||
            "New household member"}
        </p>
        <button
          type="button"
          onClick={() => setMembers((prev) => prev.filter((_, i) => i !== index))}
          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray bg-white px-3 py-1 text-xs font-semibold text-gray-500 transition-colors hover:border-danger hover:text-danger"
        >
          <FiX className="h-3.5 w-3.5" aria-hidden="true" /> Remove
        </button>
      </div>

      <div className="mb-4">
        <ChoiceGroup
          label={`Who are they to ${residentName || "the owner"}?`}
          value={member.relation}
          onChange={(relation) =>
            // A different relation makes the answers below stale:
            // "Son" left over on somebody now recorded as a parent
            // is worse than no answer at all.
            setMember(index, {
              relation,
              relationship: null,
              otherParent: null,
                                unionType: null,
            })
          }
          options={RELATIONS}
          stretch={false}
        />
      </div>

      {/*
        Which word goes on the card. Left unset it is worked out
        from their sex, which is right most of the time and wrong
        in exactly the cases that matter — a step-son, an adopted
        daughter, a guardian standing in for a parent.
      */}
      {member.relation === "spouse" && (
        <div className="mb-4">
          <ChoiceGroup
            label="Are they married, or living together?"
            value={member.unionType}
            onChange={(unionType) => setMember(index, { unionType })}
            options={[
              {
                value: "Married",
                label: "Married",
                hint: "The record will call them Husband or Wife.",
              },
              {
                value: "Live-in",
                label: "Living together",
                hint:
                  "The record will call them Partner. Not a husband or a wife — " +
                  "saying so on a barangay record is the same false statement as " +
                  "putting Married in their civil status.",
              },
            ]}
          />
        </div>
      )}

      {(member.relation === "child" || member.relation === "parent") && (
        <div className="mb-4">
          <ChoiceGroup
            label="What should the record call them?"
            value={member.relationship}
            onChange={(relationship) => setMember(index, { relationship })}
            options={
              member.relation === "child"
                ? wordChoices(
                    CHILD_WORDS,
                    "Son or Daughter, from the sex recorded below."
                  )
                : wordChoices(
                    PARENT_WORDS,
                    "Mother or Father, from the sex recorded below."
                  )
            }
            stretch={false}
          />
        </div>
      )}

      {/*
        Family who do not live here. The owner names them in the
        same breath — a mother working abroad, a father in the
        next city — and leaving them out is what makes a family
        record half a family. Not offered for "other household
        member", which means somebody in the house by definition.
      */}
      {member.relation !== null && member.relation !== "none" && (
        <div className="mb-4">
          <ChoiceGroup
            label="Where does this person live?"
            value={member.livesOutside}
            onChange={(livesOutside) => setMember(index, { livesOutside })}
            options={[
              { value: false, label: "In this house" },
              {
                value: true,
                label: "Outside the barangay",
                hint:
                  "Recorded so the family is complete, but NOT as a barangay resident: " +
                  "no purok, no sector, no portal account, and not counted in the " +
                  "population. Only a name, a number and where they are.",
              },
            ]}
          />
        </div>
      )}

      {/*
        A child has two parents, and the register has to be told
        who the second one is.

        Attaching the child to whoever the owner happens to be
        married to is a guess, and it is wrong in exactly the
        cases that matter: a child from an earlier marriage, a
        mother working abroad, a grandchild being raised in the
        house. What comes out is a record naming the wrong person
        as somebody's parent — and it is a certificate that says
        it, not just a screen.

        Not asked for a step-child or an adopted child: their own
        parentage is recorded elsewhere and is not the owner's to
        restate here.
      */}
      {/*
        A plain child of a couple needs no question at all.

        Both adults are on screen, both are being registered, and
        the register can say who the parents are without asking.
        The question stays for the case it exists for: a child by
        somebody who is not the partner.
      */}
      {member.relation === "child" &&
        !isAdopted(member.relationship) &&
        hasSpouse &&
        member.otherParent === null && (
          <div className="mb-4 rounded-xl border border-gray bg-white p-4">
            <p className="mb-2 text-sm font-medium text-dark">Parents</p>
            <p className="text-xs leading-relaxed text-dark">
              <span className="text-gray-500">{parentWord(form.gender)}:</span>{" "}
              <span className="font-semibold">{residentName || "the owner"}</span>
              <span className="mx-2 text-gray-400">·</span>
              <span className="text-gray-500">{parentWord(spouseGender)}:</span>{" "}
              <span className="font-semibold">{spouseName || "the spouse"}</span>
            </p>
            <button
              type="button"
              onClick={() =>
                setMember(index, {
                  otherParent: { ...BLANK_OTHER_PARENT, kind: "resident" },
                })
              }
              className="mt-3 cursor-pointer rounded-full border border-gray bg-white px-4 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary"
            >
              This one has a different parent
            </button>
          </div>
        )}

      {member.relation === "child" &&
        !isAdopted(member.relationship) &&
        !(hasSpouse && member.otherParent === null) &&
        (() => {
          const parent = member.otherParent;
          const patch = (changes: Partial<OtherParent>) =>
            setMember(index, {
              otherParent: { ...BLANK_OTHER_PARENT, ...parent, ...changes },
            });

          return (
            <OtherParentFields ctx={ctx} parent={parent} patch={patch} />
          );
        })()}

      {member.livesOutside ? (
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <FormField label="First name" required>
            <input
              value={member.form.first_name}
              onChange={(e) => patchMember(index, { first_name: e.target.value })}
              required
              className={inputClasses}
            />
          </FormField>
          <FormField label="Middle name">
            <input
              value={member.form.middle_name}
              onChange={(e) => patchMember(index, { middle_name: e.target.value })}
              className={inputClasses}
            />
          </FormField>
          <FormField label="Last name" required>
            <input
              value={member.form.last_name}
              onChange={(e) => patchMember(index, { last_name: e.target.value })}
              required
              className={inputClasses}
            />
          </FormField>
          <FormField label="Suffix">
            <input
              value={member.form.suffix}
              onChange={(e) => patchMember(index, { suffix: e.target.value })}
              className={inputClasses}
              placeholder="Jr., Sr., III"
            />
          </FormField>
          <FormField
            label="Sex"
            hint="What makes the record say Mother, Son, Daughter."
          >
            <select
              value={member.form.gender}
              onChange={(e) => patchMember(index, { gender: e.target.value })}
              className={inputClasses}
            >
              <option value="">Not recorded</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
          </FormField>
          <FormField label="Contact Number">
            <input
              value={member.form.contact_number}
              onChange={(e) => patchMember(index, { contact_number: e.target.value })}
              className={inputClasses}
            />
          </FormField>
          <FormField label="Where they live" hint="Town or city is enough.">
            <input
              value={member.form.address}
              onChange={(e) => patchMember(index, { address: e.target.value })}
              className={inputClasses}
              placeholder="e.g. Riyadh, Saudi Arabia"
            />
          </FormField>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <ResidentFormFields
            form={member.form}
            onChange={(values) => patchMember(index, values)}
            manualSectors={member.manualSectors}
            onToggleSector={(sector) =>
              setMember(index, {
                manualSectors: member.manualSectors.includes(sector)
                  ? member.manualSectors.filter((s) => s !== sector)
                  : [...member.manualSectors, sector],
              })
            }
            autoLength={member.autoLength}
            onAutoLengthChange={(value) => setMember(index, { autoLength: value })}
            selectedHousehold={selectedHousehold}
            onSelectHousehold={() => undefined}
            // The house is the owner's — asking again per person is
            // asking the same question five times.
            showHousehold={false}
          />
        </div>
      )}
    </div>
  );
}
