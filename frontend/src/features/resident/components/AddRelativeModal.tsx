import { FiPlus } from "react-icons/fi";
import { Link } from "react-router-dom";
import { draftAge } from "../../../shared/lib/formDraft";
import Modal from "../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import ChoiceGroup from "../../../shared/ui/ChoiceGroup";
import NewHouseholdModal from "./NewHouseholdModal";
import NamesakeCheck from "./NamesakeCheck";
import { GUARDIAN_REASONS } from "./addRelative/copy";
import { useAddRelative } from "../hooks/useAddRelative";
import { PersonEntryCard } from "./addRelative/PersonEntryCard";
import { ExistingPersonFields } from "./addRelative/ExistingPersonFields";
import { memberName } from "./family/memberFormat";
import type { AddRelativeProps } from "./addRelative/types";

/**
 * Add parent / Add child / Add spouse.
 *
 * The relative is REGISTERED, not just named: the form is the same one used
 * to register any resident, so they get a resident number, sector tags and
 * their own portal account. Anything less would leave half a family outside
 * the registry, which is the thing this feature exists to fix.
 *
 * Several people are entered in ONE form, and they need not be alike: one
 * child may live with the parent, another two towns away. So WHERE SOMEONE
 * LIVES belongs to their own block, not to the batch — only the things that
 * are genuinely about the batch (who the other parent is, whether the couple
 * is married) are asked once at the top.
 */

export default function AddRelativeModal({ open, relation, resident, onClose, onSaved }: AddRelativeProps) {
  const ctx = useAddRelative({ open, relation, resident, onClose, onSaved });
  const {
    copy, mode, setMode, existing, unionType, setUnionType, guardianReason, setGuardianReason,
    guardianStartedOn, setGuardianStartedOn, existingChildren, setExistingChildren, entries,
    hhForIndex, setHhForIndex, error, saving, savedNames, namesakes, setNamesakes,
    pendingIndex, formRef, restoredAt, discardDraft, updateEntry, addEntry, selectHousehold,
    saveFrom, submit, subjectName, existingKids, canAddMore, pendingForm, mixedBatch,
  } = ctx;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={
          entries.length > 1
            ? `Add ${entries.length} ${copy.plural} for ${subjectName}`
            : `${copy.title} for ${subjectName}`
        }
        size="xl"
      >
        {error && (
          <p className="mb-4 rounded-xl bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger">{error}</p>
        )}
        {savedNames.length > 0 && (
          <p className="mb-4 rounded-xl bg-success/10 px-4 py-2.5 text-sm font-medium text-dark">
            Already saved: <strong>{savedNames.join(", ")}</strong>
          </p>
        )}

        {/*
          Said out loud, because a form that silently refills itself is
          unnerving — and because the clerk is the one who decides whether
          the old attempt is still the one they want.
        */}
        {restoredAt !== null && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/10 px-4 py-3">
            <p className="text-xs leading-relaxed text-dark">
              Picked up where you left off &mdash; this was typed {draftAge(restoredAt)} and kept
              when the dialog closed. It stays until you save it or log out.
            </p>
            <button
              type="button"
              onClick={discardDraft}
              className="shrink-0 cursor-pointer rounded-full border border-gray bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:border-danger hover:text-danger"
            >
              Start over
            </button>
          </div>
        )}

        <div className="mb-4 rounded-xl border border-gray p-4">
          <ChoiceGroup
            label={`Is this ${copy.verb} already in the registry?`}
            value={mode}
            onChange={setMode}
            options={[
              {
                value: "new" as const,
                label: "No — register them",
                hint: `A new resident record is created and linked to ${subjectName}.`,
              },
              {
                value: "existing" as const,
                label: "Yes — find them",
                hint: "Only the family link is added. Nothing about their own record changes.",
              },
            ]}
          />
        </div>

        {/*
          The remarriage question, and the reason it is asked out loud.
          Recording a step-mother as a mother does not just print the wrong
          word: the child's grandparents, aunts, uncles and cousins are all
          read back off the parent links, so it hands them a family that is
          not theirs. Nothing in the record can settle it — only the clerk.
        */}
        {relation === "spouse" && existingKids.length > 0 && (
          <div className="mb-4 rounded-xl border border-gray p-4">
            <ChoiceGroup
              label={`What about ${subjectName}'s ${existingKids.length === 1 ? "existing child" : `${existingKids.length} existing children`}?`}
              hint={`Already on the record: ${existingKids.map(memberName).join(", ")}. This marriage does not change who their parents are.`}
              value={existingChildren}
              onChange={setExistingChildren}
              stretch={false}
              options={[
                {
                  value: "none" as const,
                  label: "Leave them as they are",
                  hint: "Nothing is written on those children. The marriage is recorded between the two adults, and that is all — which is what a remarriage actually is.",
                },
                {
                  value: "step" as const,
                  label: "Record as step-children",
                  hint: "Optional. The spouse appears on each child as a STEP-parent, in their own group. The children keep their own mother and father, and nothing on the family tree — grandparents, siblings, tita/tito, pinsan — is derived through a step link. You can also do this later, one child at a time, from the child's own profile.",
                },
                {
                  value: "shared" as const,
                  label: "They are this spouse's own children",
                  hint: "For a FIRST marriage whose children were entered before the wedding was recorded — the spouse really is their other parent. A child who already has both parents on record is given a step link instead, whatever is chosen here.",
                },
              ]}
            />
          </div>
        )}

        {relation === "child" && entries.some((e) => e.guardian) && (
          <div className="mb-4 rounded-xl border border-gray p-4">
            <FormField
              label="Why are these children not living with their parents?"
              hint="Recorded on each guardianship below. It is also what lets the barangay count how many children here are growing up with their parents away."
            >
              <select
                value={guardianReason}
                onChange={(e) => setGuardianReason(e.target.value)}
                className={inputClasses}
              >
                <option value="">Not recorded</option>
                {GUARDIAN_REASONS.map((reason) => (
                  <option key={reason}>{reason}</option>
                ))}
              </select>
            </FormField>
          </div>
        )}

        {relation === "guardian" && (
          <div className="mb-4 rounded-xl border border-gray p-4">
            <p className="mb-1 text-sm font-medium text-dark">
              Why is {subjectName} not living with their parents?
            </p>
            <p className="mb-3 text-xs leading-relaxed text-gray-400">
              This is about the child, not about the guardian &mdash; two guardians of the same
              child share it. It is also what lets the barangay count how many children here are
              growing up with their parents away.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Reason">
                <select
                  value={guardianReason}
                  onChange={(e) => setGuardianReason(e.target.value)}
                  className={inputClasses}
                >
                  <option value="">Not recorded</option>
                  {GUARDIAN_REASONS.map((reason) => (
                    <option key={reason}>{reason}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Living with them since" hint="Roughly is fine — the month matters, not the day.">
                <input
                  type="date"
                  value={guardianStartedOn}
                  onChange={(e) => setGuardianStartedOn(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className={inputClasses}
                />
              </FormField>
            </div>

            <p className="mt-3 rounded-xl bg-secondary/70 px-4 py-2.5 text-xs leading-relaxed text-gray-600">
              A guardian is <strong>not</strong> added to the family tree. {subjectName}&rsquo;s
              parents stay their parents, wherever they are living, and the guardian&rsquo;s own
              children do not become {subjectName}&rsquo;s brothers and sisters.
            </p>
          </div>
        )}

        {/*
          The Add button is on the panel whether or not there is a spouse, so
          a clerk can always find it. What they cannot do is stack two open
          unions on one record, and being told that here — before typing a
          whole form — is the point of showing the button at all.
        */}
        {relation === "spouse" && resident.spouse && (
          <div className="mb-4 rounded-xl bg-warning/10 px-4 py-3">
            <p className="text-sm leading-relaxed text-dark">
              {subjectName} is still recorded as partnered with{" "}
              <strong>{memberName(resident.spouse)}</strong>. End that union first &mdash; on the{" "}
              <strong>Marriage &amp; partnership history</strong> card below, with the reason
              (separated, annulled, widowed) &mdash; and this one can then be added. The old union
              stays on the record, which is what explains an older certificate naming a different
              spouse.
            </p>
          </div>
        )}

        {relation === "spouse" && (
          <div className="mb-4 rounded-xl border border-gray p-4">
            {/*
              Living together is not marriage, and recording it as one puts
              something legally untrue on both records. Children belong to
              both either way, which is the part that matters here.
            */}
            <ChoiceGroup
              label="Are they married?"
              value={unionType}
              onChange={setUnionType}
              options={[
                {
                  value: "Married" as const,
                  label: "Married",
                  hint: `Both records are linked and both civil statuses become Married. Children already on ${subjectName}'s record become the spouse's too, and every child added from here on is automatically both of theirs.`,
                },
                {
                  value: "Live-in" as const,
                  label: "Live-in (not married)",
                  hint: "Recorded as partners, not married — their civil status is left alone, because living together does not change it. Their children still belong to both, so a child added to one is recorded on the other automatically.",
                },
              ]}
            />
          </div>
        )}

        <form ref={formRef} onSubmit={submit} className="space-y-4">
          {mode === "existing" ? (
            <ExistingPersonFields ctx={ctx} relation={relation} resident={resident} />
          ) : (
            <>
              {mixedBatch && (
                <p className="rounded-xl bg-primary/10 px-4 py-2.5 text-xs leading-relaxed text-dark">
                  This batch mixes people who live <strong>in</strong> the barangay with people who
                  live <strong>outside</strong> it. That is fine — each is saved as what you marked
                  them, and only the residents are counted in the population.
                </p>
              )}

              {/* One block per person. */}
              {entries.map((entry, index) => (
                <PersonEntryCard key={index} ctx={ctx} index={index} entry={entry} relation={relation} resident={resident} />
              ))}

              {/* One press, one more block — no saving in between. */}
              {canAddMore && (
                <button
                  type="button"
                  onClick={addEntry}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray py-3 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <FiPlus className="h-4 w-4" aria-hidden="true" />
                  Add another {copy.verb}
                </button>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={saving || (mode === "existing" && !existing)}
            className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {saving
              ? "Saving…"
              : mode === "existing"
                ? `Link as ${copy.verb}`
                : entries.length > 1
                  ? `Register & link all ${entries.length} ${copy.plural}`
                  : `Register & link as ${copy.verb}`}
          </button>
        </form>
      </Modal>

      <NewHouseholdModal
        open={hhForIndex !== null}
        onClose={() => setHhForIndex(null)}
        onCreated={(household) => {
          if (hhForIndex === null) return;
          selectHousehold(hhForIndex, household);
          // A brand-new household has no owner yet, and the person being
          // added is almost always the reason it was created.
          updateEntry(hhForIndex, { houseMode: "other", makeOwner: true });
        }}
        defaultPurok={hhForIndex !== null ? entries[hhForIndex]?.form.zone_purok : undefined}
      />

      <NamesakeCheck
        namesakes={namesakes}
        firstName={pendingForm.first_name}
        lastName={pendingForm.last_name}
        birthdate={pendingForm.birthdate}
        zonePurok={pendingForm.zone_purok}
        saving={saving}
        onCancel={() => setNamesakes(null)}
        onConfirm={() => {
          setNamesakes(null);
          // Resume at the block that was queried, so the ones already saved
          // are not entered a second time.
          saveFrom(pendingIndex, pendingIndex);
        }}
        renderLink={(n) => (
          <Link
            to={`/population/residents/${n.id}`}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Open
          </Link>
        )}
      />
    </>
  );
}

