import ChoiceGroup from "../../../../shared/ui/ChoiceGroup";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import PhoneInput from "../../../../shared/ui/PhoneInput";
import type { Resident } from "../../../../shared/types";
import ResidentPicker from "../ResidentPicker";
import type { AddRelativeState } from "../../hooks/useAddRelative";
import type { Entry } from "./types";

/**
 * Who this person's parents are — the resident, and the other parent.
 */
export function EntryParents({ ctx, index, entry, resident }: {
  ctx: AddRelativeState;
  index: number;
  entry: Entry;
  resident: Resident;
}) {
  const { settledParent, updateEntry, parentsOf, nameOf } = ctx;

  return (
    <div className="rounded-xl border border-gray bg-white p-4">
      <p className="mb-1 text-sm font-medium text-dark">
        This child&rsquo;s other parent{" "}
        <span className="font-normal text-gray-400">
          &mdash; not the child
        </span>
      </p>
      <p className="mb-3 text-xs leading-relaxed text-gray-400">
        Optional. Named here, the child is recorded on BOTH parents at once, so
        you never enter them twice.
        {index > 0 && " Carried over from the child above — change it if this one has a different mother or father."}
      </p>

      {/*
        Settled, until the clerk says otherwise.

        For most children the answer is already right — the
        partner on record, or the parent carried over from
        the child above — so it is stated rather than asked.
        Only a child by somebody else needs the question,
        and that child gets a button.
      */}
      {settledParent(entry) && !entry.changingParent ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/70 px-4 py-3">
          <p className="text-xs leading-relaxed text-dark">
            <span className="font-semibold">{settledParent(entry)!.name}</span>
            <span className="mx-2 text-gray-400">·</span>
            <span className="text-gray-500">{settledParent(entry)!.note}</span>
          </p>
          <button
            type="button"
            onClick={() => updateEntry(index, { changingParent: true })}
            className="shrink-0 cursor-pointer rounded-full border border-gray bg-white px-4 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary"
          >
            This one has a different parent
          </button>
        </div>
      ) : (
      <>
      <div className="mb-3">
        <ChoiceGroup
          label="Is the other parent on the barangay register?"
          value={entry.otherParentMode}
          onChange={(value) =>
            updateEntry(index, { otherParentMode: value, outsideParentId: null })
          }
          options={[
            { value: "registry" as const, label: "Yes — find them" },
            { value: "outside" as const, label: "No — record them here" },
          ]}
        />
      </div>

      {entry.otherParentMode === "registry" ? (
        <ResidentPicker
          value={entry.otherParent}
          onChange={(person) => updateEntry(index, { otherParent: person })}
          excludeIds={[resident.id]}
          residentsOnly
        />
      ) : (
        <>
          {/*
            Search before typing.

            A mother working abroad is entered once and then
            named again for every child she has by the same
            man. Typing her each time makes a second record
            of her, and the register then holds two women
            who are the same person — with one child each.
          */}
          {!entry.typingOutsideParent ? (
            <div>
              <p className="mb-2 text-xs leading-relaxed text-gray-500">
                Search the people already recorded from outside the barangay — a
                parent named for an earlier child is already here.
              </p>
              <ResidentPicker
                value={entry.otherParent}
                onChange={(person) =>
                  updateEntry(index, {
                    otherParent: person,
                    outsideParentId: person?.id ?? null,
                  })
                }
                excludeIds={[resident.id]}
                nonResidentsOnly
              />
              <button
                type="button"
                onClick={() =>
                  updateEntry(index, {
                    typingOutsideParent: true,
                    otherParent: null,
                    outsideParentId: null,
                  })
                }
                className="mt-3 cursor-pointer rounded-full border border-gray bg-white px-4 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary"
              >
                Not there — type their details
              </button>
            </div>
          ) : (
          <>
          <p className="mb-3 rounded-xl bg-secondary px-4 py-2.5 text-xs leading-relaxed text-gray-500">
            Recorded as living <strong>outside the barangay</strong> — no portal
            account, and not counted in the population. Just enough to reach them.
          </p>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <FormField label="First name" required>
              <input
                value={entry.outsideParent.first_name}
                onChange={(e) =>
                  updateEntry(index, {
                    outsideParent: { ...entry.outsideParent, first_name: e.target.value },
                    outsideParentId: null,
                  })
                }
                className={inputClasses}
              />
            </FormField>
            <FormField label="Middle name">
              <input
                value={entry.outsideParent.middle_name}
                onChange={(e) =>
                  updateEntry(index, {
                    outsideParent: { ...entry.outsideParent, middle_name: e.target.value },
                    outsideParentId: null,
                  })
                }
                className={inputClasses}
              />
            </FormField>
            <FormField label="Last name" required>
              <input
                value={entry.outsideParent.last_name}
                onChange={(e) =>
                  updateEntry(index, {
                    outsideParent: { ...entry.outsideParent, last_name: e.target.value },
                    outsideParentId: null,
                  })
                }
                className={inputClasses}
              />
            </FormField>
            <FormField label="Phone number" hint="Philippine mobile — 10 digits after +63">
              <PhoneInput
                value={entry.outsideParent.contact_number}
                onChange={(v) =>
                  updateEntry(index, {
                    outsideParent: { ...entry.outsideParent, contact_number: v },
                  })
                }
              />
            </FormField>
            <FormField label="Address" hint="Town or city is enough.">
              <input
                value={entry.outsideParent.address}
                onChange={(e) =>
                  updateEntry(index, {
                    outsideParent: { ...entry.outsideParent, address: e.target.value },
                  })
                }
                className={inputClasses}
                placeholder="e.g. Villanueva, Misamis Oriental"
              />
            </FormField>
          </div>

          <button
            type="button"
            onClick={() => updateEntry(index, { typingOutsideParent: false })}
            className="mt-3 cursor-pointer text-xs font-semibold text-primary hover:underline"
          >
            Search the ones already recorded instead
          </button>
          </>
          )}
        </>
      )}

      {/*
        The way back. Having opened the question, the clerk
        must be able to undo that without retyping the
        partner they already had.
      */}
      {resident.spouse && entry.otherParent?.id !== resident.spouse.id && (
        <button
          type="button"
          onClick={() =>
            updateEntry(index, {
              changingParent: false,
              otherParentMode: "registry",
              otherParent: resident.spouse as Resident,
              outsideParentId: null,
            })
          }
          className="mt-3 cursor-pointer text-xs font-semibold text-primary hover:underline"
        >
          Use {resident.spouse.first_name} {resident.spouse.last_name} instead
        </button>
      )}
      </>
      )}

      {/*
        Who is the mother and who is the father, spelled out.
        "The other parent" on its own tells the clerk nothing,
        and the surname choices cannot be offered without it.
      */}
      {(() => {
        const { other, derived, side, mother, father } = parentsOf(entry);
        if (!other) return null;

        return (
          <div className="mt-3 rounded-xl bg-secondary/70 px-4 py-3">
            {side ? (
              <p className="text-xs leading-relaxed text-dark">
                Mother: <strong>{nameOf(mother)}</strong>
                <span className="mx-2 text-gray-400">·</span>
                Father: <strong>{nameOf(father)}</strong>
                {!derived && (
                  <button
                    type="button"
                    onClick={() =>
                      updateEntry(index, {
                        motherIs: side === "subject" ? "other" : "subject",
                      })
                    }
                    className="ml-2 cursor-pointer text-xs font-semibold text-primary hover:underline"
                  >
                    swap
                  </button>
                )}
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs font-medium text-dark">
                  Which of them is the mother?
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["subject", nameOf(resident)],
                      ["other", nameOf(other)],
                    ] as const
                  ).map(([value, text]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateEntry(index, { motherIs: value })}
                      className="cursor-pointer rounded-full border border-gray bg-white px-4 py-1.5 text-xs font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
                    >
                      {text || "(unnamed)"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Needed for the surname choices below — a parent recorded from
                  outside the barangay has a name and a number, not a sex.
                </p>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
