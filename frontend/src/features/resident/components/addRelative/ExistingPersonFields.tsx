import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import ChoiceGroup from "../../../../shared/ui/ChoiceGroup";
import PhoneInput from "../../../../shared/ui/PhoneInput";
import type { Resident } from "../../../../shared/types";
import ResidentPicker from "../ResidentPicker";
import type { AddRelativeState } from "../../hooks/useAddRelative";
import type { Relation } from "./types";

/**
 * Linking somebody already on the register: who they are, and what they are to this resident.
 */
export function ExistingPersonFields({ ctx, relation, resident }: {
  ctx: AddRelativeState;
  relation: Relation;
  resident: Resident;
}) {
  const {
    copy, entries, updateEntry, existing, setExisting, saysSomebodyElses, subjectName,
    settledParent,
  } = ctx;

  return (
    <>
      {relation !== "spouse" && (
        <FormField label="Relationship" hint={copy.labelHint}>
          <select
            value={entries[0]?.label ?? ""}
            onChange={(e) => updateEntry(0, { label: e.target.value })}
            className={inputClasses}
          >
            <option value="">Not specified</option>
            {copy.labels.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </FormField>
      )}
      <FormField label={`Find the ${copy.verb}`} required plain>
        <ResidentPicker value={existing} onChange={setExisting} excludeIds={[resident.id]} />
      </FormField>
      <p className="rounded-xl bg-secondary px-4 py-2.5 text-xs text-gray-500">
        Search the registry by name or resident number. Nothing about their record
        changes — only the family link is added, so their own household stays as it is.
      </p>

      {/*
        The other parent, for a child ALREADY on the register.

        This was only ever asked when registering a new child — but
        the child is usually entered first and linked to a parent
        afterwards, so the commonest case of all had no way to name
        the second parent. Without it the server falls back to the
        subject’s spouse, which is a guess, and wrong for exactly the
        families that need it: an earlier marriage, a mother abroad.

        Not asked for a step-child or an adopted child: the word
        already says the child is somebody else’s.
      */}
      {relation === "child" && !saysSomebodyElses(entries[0]?.label) && (
        <div className="rounded-xl border border-gray bg-white p-4">
          <p className="mb-1 text-sm font-medium text-dark">
            This child&rsquo;s other parent{" "}
            <span className="font-normal text-gray-400">&mdash; not the child</span>
          </p>
          <p className="mb-3 text-xs leading-relaxed text-gray-400">
            Optional. Named here, the child is recorded on BOTH parents at once. Left
            blank, only {subjectName} is recorded as their parent
            {resident.spouse ? " — along with their spouse, if the child is theirs too" : ""}.
          </p>

          {/* Settled by default here too — same reasoning, same button. */}
          {entries[0] && settledParent(entries[0]) && !entries[0].changingParent ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/70 px-4 py-3">
              <p className="text-xs leading-relaxed text-dark">
                <span className="font-semibold">{settledParent(entries[0])!.name}</span>
                <span className="mx-2 text-gray-400">·</span>
                <span className="text-gray-500">{settledParent(entries[0])!.note}</span>
              </p>
              <button
                type="button"
                onClick={() => updateEntry(0, { changingParent: true })}
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
              value={entries[0]?.otherParentMode ?? "registry"}
              onChange={(value) =>
                updateEntry(0, { otherParentMode: value, outsideParentId: null })
              }
              options={[
                { value: "registry" as const, label: "Yes — find them" },
                { value: "outside" as const, label: "No — record them here" },
              ]}
            />
          </div>

          {(entries[0]?.otherParentMode ?? "registry") === "registry" ? (
            <ResidentPicker
              value={entries[0]?.otherParent ?? null}
              onChange={(person) => updateEntry(0, { otherParent: person })}
              excludeIds={[resident.id, ...(existing ? [existing.id] : [])]}
              // "On the barangay register" cannot offer somebody who
              // lives outside it — the answer would contradict the
              // question that was just asked.
              residentsOnly
            />
          ) : (
            <>
              {/* Search before typing — see the block for a new child. */}
              {!entries[0]?.typingOutsideParent ? (
                <div>
                  <p className="mb-2 text-xs leading-relaxed text-gray-500">
                    Search the people already recorded from outside the barangay — a parent
                    named for an earlier child is already here.
                  </p>
                  <ResidentPicker
                    value={entries[0]?.otherParent ?? null}
                    onChange={(person) =>
                      updateEntry(0, {
                        otherParent: person,
                        outsideParentId: person?.id ?? null,
                      })
                    }
                    excludeIds={[resident.id, ...(existing ? [existing.id] : [])]}
                    nonResidentsOnly
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateEntry(0, {
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
                    value={entries[0]?.outsideParent.first_name ?? ""}
                    onChange={(e) =>
                      updateEntry(0, {
                        outsideParent: {
                          ...entries[0].outsideParent,
                          first_name: e.target.value,
                        },
                        outsideParentId: null,
                      })
                    }
                    className={inputClasses}
                  />
                </FormField>
                <FormField label="Middle name">
                  <input
                    value={entries[0]?.outsideParent.middle_name ?? ""}
                    onChange={(e) =>
                      updateEntry(0, {
                        outsideParent: {
                          ...entries[0].outsideParent,
                          middle_name: e.target.value,
                        },
                        outsideParentId: null,
                      })
                    }
                    className={inputClasses}
                  />
                </FormField>
                <FormField label="Last name" required>
                  <input
                    value={entries[0]?.outsideParent.last_name ?? ""}
                    onChange={(e) =>
                      updateEntry(0, {
                        outsideParent: {
                          ...entries[0].outsideParent,
                          last_name: e.target.value,
                        },
                        outsideParentId: null,
                      })
                    }
                    className={inputClasses}
                  />
                </FormField>
                <FormField label="Contact Number" hint="Philippine mobile — 10 digits after +63">
                  <PhoneInput
                    value={entries[0]?.outsideParent.contact_number ?? ""}
                    onChange={(v) =>
                      updateEntry(0, {
                        outsideParent: { ...entries[0].outsideParent, contact_number: v },
                        outsideParentId: null,
                      })
                    }
                  />
                </FormField>
                <FormField label="Address" hint="Town or city is enough.">
                  <input
                    value={entries[0]?.outsideParent.address ?? ""}
                    onChange={(e) =>
                      updateEntry(0, {
                        outsideParent: {
                          ...entries[0].outsideParent,
                          address: e.target.value,
                        },
                        outsideParentId: null,
                      })
                    }
                    className={inputClasses}
                    placeholder="e.g. Villanueva, Misamis Oriental"
                  />
                </FormField>
              </div>

              <button
                type="button"
                onClick={() => updateEntry(0, { typingOutsideParent: false })}
                className="mt-3 cursor-pointer text-xs font-semibold text-primary hover:underline"
              >
                Search the ones already recorded instead
              </button>
              </>
              )}
            </>
          )}

          {resident.spouse && entries[0]?.otherParent?.id !== resident.spouse.id && (
            <button
              type="button"
              onClick={() =>
                updateEntry(0, {
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
        </div>
      )}
    </>
  );
}
