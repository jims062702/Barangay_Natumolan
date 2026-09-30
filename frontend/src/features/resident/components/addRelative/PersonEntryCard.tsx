import { FiX } from "react-icons/fi";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import PhoneInput from "../../../../shared/ui/PhoneInput";
import type { Resident } from "../../../../shared/types";
import { EntryResidence } from "./EntryResidence";
import { EntryParents } from "./EntryParents";
import ResidentFormFields from "../ResidentFormFields";
import type { AddRelativeState } from "../../hooks/useAddRelative";
import type { Entry, Relation } from "./types";

/**
 * One person in the batch, typed in as somebody new to the register.
 */
export function PersonEntryCard({ ctx, index, entry, relation, resident }: {
  ctx: AddRelativeState;
  index: number;
  entry: Entry;
  relation: Relation;
  resident: Resident;
}) {
  const {
    entries, copy, removeEntry, updateEntry, setEntries, subjectName, selectHousehold,
    parentsOf, canNamePattern, applyNamePattern, surnameOf, patchForm,
  } = ctx;

  return (
    <div className="rounded-2xl border border-gray bg-secondary/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-dark">
          {entries.length > 1 ? `${index + 1}. ` : ""}
          {entry.form.first_name || entry.form.last_name
            ? `${entry.form.first_name} ${entry.form.last_name}`.trim()
            : `New ${copy.verb}`}
          {entry.livesOutside === true && (
            <span className="ml-2 rounded-full bg-gray px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              Outside
            </span>
          )}
          {entry.saved && (
            <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
              Saved
            </span>
          )}
        </p>
        {entries.length > 1 && (
          <button
            type="button"
            onClick={() => removeEntry(index)}
            aria-label={`Remove ${copy.verb} ${index + 1}`}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray bg-white px-3 py-1 text-xs font-semibold text-gray-500 transition-colors hover:border-danger hover:text-danger"
          >
            <FiX className="h-3.5 w-3.5" aria-hidden="true" /> Remove
          </button>
        )}
      </div>

      <div className="space-y-4">
        {relation !== "spouse" && (
          <FormField label="Relationship" hint={copy.labelHint}>
            <select
              value={entry.label}
              onChange={(e) => updateEntry(index, { label: e.target.value })}
              className={inputClasses}
            >
              <option value="">Not specified</option>
              {copy.labels.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </FormField>
        )}

        {/*
          Which of them the barangay rings. Only worth asking once
          there is more than one — a lone guardian is the contact
          by definition.
        */}
        {relation === "guardian" && entries.length > 1 && (
          <button
            type="button"
            onClick={() =>
              setEntries((prev) =>
                prev.map((e, i) => ({ ...e, isPrimary: i === index }))
              )
            }
            aria-pressed={entry.isPrimary}
            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
              entry.isPrimary
                ? "border-primary bg-primary text-white"
                : "border-gray bg-white text-dark hover:border-primary hover:text-primary"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                entry.isPrimary ? "border-white bg-white/20" : "border-gray"
              }`}
            >
              {entry.isPrimary ? "✓" : ""}
            </span>
            This is the person the barangay contacts about {subjectName}
          </button>
        )}

        {/*
          Where THIS person lives — their own question, because a
          batch can mix a child living at home with one who has
          moved to the next town.
        */}
        <EntryResidence ctx={ctx} entry={entry} index={index} relation={relation} resident={resident} />

        {/*
          THIS child's other parent. It sits in the child's own
          block, not once at the top, because a batch may hold two
          families — and when it was asked once, entering a second
          child by a different mother meant closing the form and
          starting again.
        */}
        {relation === "child" && entry.livesOutside !== null && (
          <EntryParents ctx={ctx} index={index} entry={entry} resident={resident} />
        )}
        {/*
          How this child's name is composed. Unmarried parents have
          a real choice here, and typing it by hand each time is how
          a middle name ends up wrong.
        */}
        {canNamePattern(entry) && entry.livesOutside !== null && (
          <div className="rounded-xl border border-gray bg-white p-3">
            <p className="mb-2 text-xs font-medium text-dark">
              How is this child&rsquo;s name recorded?
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyNamePattern(index, "father")}
                className="cursor-pointer rounded-full border border-gray px-3.5 py-1.5 text-xs font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
              >
                {surnameOf(parentsOf(entry).father)} — with{" "}
                {surnameOf(parentsOf(entry).mother)} as middle name
              </button>
              <button
                type="button"
                onClick={() => applyNamePattern(index, "mother")}
                className="cursor-pointer rounded-full border border-gray px-3.5 py-1.5 text-xs font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
              >
                {surnameOf(parentsOf(entry).mother)} only (mother&rsquo;s)
              </button>
              <button
                type="button"
                onClick={() => applyNamePattern(index, "father-only")}
                className="cursor-pointer rounded-full border border-gray px-3.5 py-1.5 text-xs font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
              >
                {surnameOf(parentsOf(entry).father)} only (father&rsquo;s)
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">
              A child of unmarried parents carries the mother&rsquo;s surname by
              default; the father&rsquo;s may be used when he has acknowledged the child
              (RA 9255), with the mother&rsquo;s surname as the middle name.
            </p>
          </div>
        )}

        <p className="mb-2 mt-4 border-t border-gray pt-4 text-sm font-medium text-dark">
          {copy.verb === "child"
            ? "This child’s own details"
            : `This ${copy.verb}’s own details`}
        </p>

        {entry.livesOutside === null ? (
          /*
            No fields until the question above is answered. Which
            fields there are IS the answer to it: a full resident
            record, or the five lines kept for someone who lives
            elsewhere. Showing one of them first would be picking
            for the clerk.
          */
          <p className="rounded-xl border border-dashed border-gray bg-white px-4 py-3 text-xs leading-relaxed text-gray-500">
            Answer <strong className="text-dark">Where does this person live?</strong>{" "}
            above and their form appears here.
          </p>
        ) : entry.livesOutside ? (
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <FormField label="First name" required>
              <input
                value={entry.form.first_name}
                onChange={(e) => patchForm(index, { first_name: e.target.value })}
                required
                className={inputClasses}
              />
            </FormField>
            <FormField label="Middle name">
              <input
                value={entry.form.middle_name}
                onChange={(e) => patchForm(index, { middle_name: e.target.value })}
                className={inputClasses}
              />
            </FormField>
            <FormField label="Last name" required>
              <input
                value={entry.form.last_name}
                onChange={(e) => patchForm(index, { last_name: e.target.value })}
                required
                className={inputClasses}
              />
            </FormField>
            <FormField label="Suffix">
              <input
                value={entry.form.suffix}
                onChange={(e) => patchForm(index, { suffix: e.target.value })}
                className={inputClasses}
                placeholder="Jr., Sr., III"
              />
            </FormField>
            <FormField label="Contact Number" hint="Philippine mobile — 10 digits after +63">
              <PhoneInput
                value={entry.form.contact_number}
                onChange={(v) => patchForm(index, { contact_number: v })}
              />
            </FormField>
            <FormField label="Address" hint="Where they live — town or city is enough.">
              <input
                value={entry.form.address}
                onChange={(e) => patchForm(index, { address: e.target.value })}
                className={inputClasses}
                placeholder="e.g. Villanueva, Misamis Oriental"
              />
            </FormField>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <ResidentFormFields
              form={entry.form}
              onChange={(values) => patchForm(index, values)}
              manualSectors={entry.manualSectors}
              onToggleSector={(sector) =>
                updateEntry(index, {
                  manualSectors: entry.manualSectors.includes(sector)
                    ? entry.manualSectors.filter((s) => s !== sector)
                    : [...entry.manualSectors, sector],
                })
              }
              autoLength={entry.autoLength}
              onAutoLengthChange={(value) => updateEntry(index, { autoLength: value })}
              selectedHousehold={entry.household}
              onSelectHousehold={(household) => selectHousehold(index, household)}
              // Both are asked above, in this person's own block.
              showHousehold={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
