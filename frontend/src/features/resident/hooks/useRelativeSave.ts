import type { FormEvent } from "react";
import { errorMessage, fieldErrors } from "../../../shared/lib/api";
import { showServerFieldErrors } from "../../../shared/lib/formErrors";
import { clearDraft } from "../../../shared/lib/formDraft";
import { confirmAction } from "../../../shared/lib/confirm";
import { buildResidentPayload } from "../components/ResidentFormFields";
import { residentApi } from "../api";
import { namesakesFrom } from "../components/NamesakeCheck";
import type { AddRelativeProps, Entry } from "../components/addRelative/types";
import type { RelativeBatchState } from "./useRelativeBatch";
import type { RelativeDraftState } from "./useRelativeDraft";

/**
 * Saving the batch — new people, or somebody already on the register — and the family links with it.
 */
export function useRelativeSave(ctx: AddRelativeProps & RelativeBatchState & RelativeDraftState) {
  const {
    copy, doneRef, draftKey, entries, existing, existingChildren, formRef, guardianReason,
    guardianStartedOn, mode, onClose, onSaved, relation, resident, setEntries, setError,
    setNamesakes, setPendingIndex, setSavedNames, setSaving, unionType,
  } = ctx;

  /* ---- saving ---- */
  const payloadFor = (entry: Entry, confirmNamesake: boolean, otherParentId: number | null) => {
    const base = entry.livesOutside === true
      ? {
          // Only what the barangay needs to reach someone who lives elsewhere.
          record_type: "Non-resident",
          first_name: entry.form.first_name,
          middle_name: entry.form.middle_name || undefined,
          last_name: entry.form.last_name,
          suffix: entry.form.suffix || undefined,
          contact_number: entry.form.contact_number || undefined,
          address: entry.form.address || undefined,
        }
      : buildResidentPayload(entry.form, entry.manualSectors, entry.autoLength);

    const payload: Record<string, unknown> = { ...base };

    if (relation !== "spouse" && entry.label) payload.relationship = entry.label;
    if (entry.makeOwner && entry.livesOutside === false) payload.make_household_head = true;
    if (relation === "spouse") {
      payload.union_type = unionType;
      // "none" is what the server does anyway; sending it changes nothing.
      if (existingChildren !== "none") payload.existing_children = existingChildren;
    }
    if (relation === "guardian") {
      payload.guardian_reason = guardianReason || undefined;
      payload.guardian_started_on = guardianStartedOn || undefined;
      payload.is_primary = entry.isPrimary;
    }
    if (relation === "child" && otherParentId) payload.other_parent_id = otherParentId;
    /*
     * The child lives with somebody who is not this parent. The server takes
     * the household from the guardian and records the guardianship in the
     * same request, so a child left with a lola is entered once, not twice.
     */
    if (relation === "child" && entry.guardian) {
      payload.guardian_id = entry.guardian.id;
      payload.guardian_relation = entry.guardianRelation || undefined;
      payload.guardian_reason = guardianReason || undefined;
    }
    if (confirmNamesake) payload.confirm_namesake = true;

    return payload;
  };
  /**
   * Saves the blocks in order, from `startIndex`.
   *
   * A namesake conflict pauses the run rather than failing the batch: the
   * dialog opens for that block, and confirming resumes from exactly there,
   * so the people already saved are never entered twice.
   */
  const saveFrom = async (startIndex: number, confirmIndex: number | null) => {
    setError("");
    setSaving(true);

    try {
      /*
       * Each child's own second parent is resolved as that child is reached —
       * the batch may hold two families, and it was resolving one answer for
       * all of them that made the clerk run the form twice.
       *
       * A non-resident mother typed onto several children is created ONCE:
       * her id is written back onto every block that named her, so a run
       * resumed after a namesake prompt does not enter her again either.
       */
      const created: Record<string, number> = {};

      for (let i = startIndex; i < entries.length; i++) {
        const entry = entries[i];
        // Already posted on an earlier attempt. Pressing save again after a
        // failure resumes the batch; it does not enter anyone twice.
        if (entry.saved) continue;

        const name = `${entry.form.first_name} ${entry.form.last_name}`.trim();
        let otherParentId = entry.outsideParentId ?? entry.otherParent?.id ?? null;

        if (
          relation === "child" &&
          entry.otherParentMode === "outside" &&
          !otherParentId &&
          entry.outsideParent.first_name &&
          entry.outsideParent.last_name
        ) {
          const key = `${entry.outsideParent.first_name}|${entry.outsideParent.middle_name}|${entry.outsideParent.last_name}`
            .toLowerCase();

          if (created[key]) {
            otherParentId = created[key];
          } else {
            try {
              const madeParent = await residentApi.register({
                record_type: "Non-resident",
                first_name: entry.outsideParent.first_name,
                middle_name: entry.outsideParent.middle_name || undefined,
                last_name: entry.outsideParent.last_name,
                contact_number: entry.outsideParent.contact_number || undefined,
                address: entry.outsideParent.address || undefined,
                confirm_namesake: true,
              });
              otherParentId = madeParent.data.data.id as number;
              created[key] = otherParentId;
            } catch (err) {
              setError(
                `The other parent for ${name || `${copy.verb} ${i + 1}`} could not be recorded: `
                  + errorMessage(err)
                  + (i > startIndex ? " The ones before them were saved." : " Nothing was saved.")
              );
              return;
            }
          }

          // Written back so a resumed run reuses her rather than making a second.
          const resolved = otherParentId;
          setEntries((prev) =>
            prev.map((e, j) =>
              j === i || (!e.saved && !e.outsideParentId
                && `${e.outsideParent.first_name}|${e.outsideParent.middle_name}|${e.outsideParent.last_name}`.toLowerCase() === key)
                ? { ...e, outsideParentId: resolved }
                : e
            )
          );
        }

        try {
          const response = await residentApi.addRelative(
            resident.id, relation,
            payloadFor(entry, confirmIndex === i, otherParentId)
          );
          onSaved(response.data.message);
          setSavedNames((prev) => [...prev, name]);
          setEntries((prev) => prev.map((e, j) => (j === i ? { ...e, saved: true } : e)));
        } catch (err) {
          const found = namesakesFrom(err);

          if (found) {
            setPendingIndex(i);
            setNamesakes(found);
            return; // wait for the clerk to decide, then resume here
          }

          const shownInline = showServerFieldErrors(formRef.current, fieldErrors(err));
          setError(
            (shownInline ? "" : errorMessage(err)) +
              (i > startIndex ? ` (${name} was not saved; the ones before them were.)` : "")
          );
          return;
        }
      }

      // The whole batch is in. There is nothing left to come back to.
      doneRef.current = true;
      clearDraft(draftKey);
      onClose();
    } finally {
      setSaving(false);
    }
  };
  /**
   * A relationship word that already says whose child this is.
   *
   * A step-child and an adopted child have their own parentage recorded
   * elsewhere; naming a second parent here would invent one for a child who
   * already has two. So the question is not asked for those.
   */
  const saysSomebodyElses = (label?: string) => label === "Adopted";
  /**
   * The other parent's id, creating the non-resident record first when the
   * clerk typed somebody who lives elsewhere.
   *
   * Shared by both paths. Asking only when registering a NEW child meant a
   * child already on the register could never be given their second parent —
   * the commonest case of all, because the child was usually entered first.
   */
  const resolveOtherParent = async (entry: Entry): Promise<number | null> => {
    if (relation !== "child" || saysSomebodyElses(entry.label)) return null;

    const known = entry.outsideParentId ?? entry.otherParent?.id ?? null;
    if (entry.otherParentMode === "registry" || known) return known;

    if (!entry.outsideParent.first_name || !entry.outsideParent.last_name) return null;

    const made = await residentApi.register({
      record_type: "Non-resident",
      first_name: entry.outsideParent.first_name,
      middle_name: entry.outsideParent.middle_name || undefined,
      last_name: entry.outsideParent.last_name,
      contact_number: entry.outsideParent.contact_number || undefined,
      address: entry.outsideParent.address || undefined,
      confirm_namesake: true,
    });

    return made.data.data.id as number;
  };
  /**
   * The other parent as it currently stands, for the folded-away line.
   *
   * Null means nothing is settled yet and the question has to be asked —
   * a resident with no partner on record, or an outside parent half typed.
   */
  const settledParent = (entry: Entry): { name: string; note: string } | null => {
    if (entry.otherParentMode === "registry") {
      if (!entry.otherParent) return null;

      const name = `${entry.otherParent.first_name} ${entry.otherParent.last_name}`.trim();
      const isSpouse = entry.otherParent.id === resident.spouse?.id;

      return {
        name,
        note: isSpouse
          ? `${resident.first_name}’s partner on record`
          : "on the barangay register",
      };
    }

    const name = `${entry.outsideParent.first_name} ${entry.outsideParent.last_name}`.trim();

    return name ? { name, note: "lives outside the barangay" } : null;
  };
  const saveExisting = async () => {
    if (!existing) return;
    setError("");
    setSaving(true);
    try {
      const otherParentId = entries[0] ? await resolveOtherParent(entries[0]) : null;

      const response = await residentApi.linkRelative(resident.id, {
        relative_id: existing.id,
        relation,
        // Named here, the child is recorded on BOTH parents in one step.
        // Left unsaid, the server keeps its own presumption: the subject's
        // spouse, if they have one.
        other_parent_id: otherParentId ?? undefined,
        relationship: relation !== "spouse" ? entries[0]?.label || undefined : undefined,
        union_type: relation === "spouse" ? unionType : undefined,
        existing_children:
          relation === "spouse" && existingChildren !== "none" ? existingChildren : undefined,
        // Why the parents are not raising the child, and since when. Asked
        // on this path too, because linking the lola who was already on the
        // register is the commonest way a guardianship gets recorded.
        guardian_reason: relation === "guardian" ? guardianReason || undefined : undefined,
        guardian_started_on:
          relation === "guardian" ? guardianStartedOn || undefined : undefined,
        is_primary: relation === "guardian" ? entries[0]?.isPrimary ?? true : undefined,
      });
      onSaved(response.data.message);
      doneRef.current = true;
      clearDraft(draftKey);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (mode === "existing") {
      if (!existing) return;
      if (
        !(await confirmAction({
          title: `Link ${existing.first_name} ${existing.last_name} as ${copy.verb}?`,
          confirmText: "Yes, link them",
        }))
      )
        return;
      await saveExisting();
      return;
    }

    /*
     * Where someone lives decides which record they get, so it is not left to
     * a default. Nothing below it is shown until it is answered, which is why
     * the browser's own required-field check cannot catch this one.
     */
    const unanswered = entries.findIndex((e) => e.livesOutside === null);
    if (unanswered !== -1) {
      setError(
        entries.length > 1
          ? `Answer "Where does this person live?" for ${copy.verb} ${unanswered + 1} before saving.`
          : `Answer "Where does this person live?" before saving this ${copy.verb}.`
      );
      return;
    }

    const names = entries.map((e) => `${e.form.first_name} ${e.form.last_name}`.trim()).join(", ");

    if (
      !(await confirmAction({
        title:
          entries.length === 1
            ? `Register ${names} as ${copy.verb}?`
            : `Register ${entries.length} ${copy.plural}?`,
        text:
          entries.length === 1
            ? "They will be added to the resident registry with their own record."
            : `${names} will each be added to the registry with their own record.`,
        confirmText: "Yes, register & link",
      }))
    )
      return;

    await saveFrom(0, null);
  };

  return {
    payloadFor, saveFrom, saysSomebodyElses, resolveOtherParent, settledParent, saveExisting,
    submit,
  };
}

export type RelativeSaveState = ReturnType<typeof useRelativeSave>;
