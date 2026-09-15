import { useState, useRef } from "react";
import type { Resident, Household } from "../../../shared/types";
import { COPY } from "../components/addRelative/copy";
import { type ResidentForm, RESIDENT_FORM_INITIAL } from "../components/ResidentFormFields";
import type { AddRelativeProps, Entry } from "../components/addRelative/types";
import type { Namesake } from "../components/NamesakeCheck";

/**
 * The people being added: each one's answers, their household, and how their names are worked out.
 */
export function useRelativeBatch(ctx: AddRelativeProps) {
  const {
    relation, resident,
  } = ctx;

  const copy = COPY[relation];
  /* ---- genuinely shared by the batch ---- */
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [existing, setExisting] = useState<Resident | null>(null);
  const [unionType, setUnionType] = useState<"Married" | "Live-in">("Married");
  /* ---- guardianship, shared by everyone in the batch ---- */
  const [guardianReason, setGuardianReason] = useState("");
  const [guardianStartedOn, setGuardianStartedOn] = useState("");
  const [existingChildren, setExistingChildren] = useState<"none" | "shared" | "step">("none");
  /* ---- one per person ---- */
  const [entries, setEntries] = useState<Entry[]>([]);
  // Which block opened the "register a household" dialog.
  const [hhForIndex, setHhForIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [namesakes, setNamesakes] = useState<Namesake[] | null>(null);
  // Which block the namesake dialog is asking about, so saving resumes there.
  const [pendingIndex, setPendingIndex] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const subjectHousehold = (resident.household as Household | null) ?? null;
  /** What a new block may inherit from the one before it. */
  type EntrySeed = Partial<Omit<Entry, "form">> & { form?: Partial<ResidentForm> };
  /** A fresh block, living with the subject until told otherwise. */
  const blankEntry = (seed: EntrySeed = {}): Entry => ({
    form: {
      ...RESIDENT_FORM_INITIAL,
      /*
       * A CHILD's surname is never assumed. Which surname a child carries is
       * a real decision — the father's, the mother's, or the father's with
       * the mother's as the middle name — and pre-filling one quietly makes
       * that decision for the family. A parent usually does share the surname
       * already on the record, so it is offered and can be typed over.
       */
      last_name: relation === "parent" ? resident.last_name : "",
      /*
       * No household, and therefore no purok, until the clerk says which. The
       * purok belongs to the house, so it fills itself the moment the house
       * is chosen — and stays open until then rather than showing an answer
       * nobody gave.
       */
      household_id: "",
      zone_purok: "",
      ...(seed.form ?? {}),
    },
    manualSectors: [],
    autoLength: false,
    label: "",
    livesOutside: seed.livesOutside ?? null,
    houseMode: seed.houseMode ?? "",
    household: seed.household ?? null,
    makeOwner: false,
    isPrimary: seed.isPrimary ?? true,
    changingParent: seed.changingParent ?? false,
    typingOutsideParent: seed.typingOutsideParent ?? false,
    otherParentMode: seed.otherParentMode ?? "registry",
    // The partner on record is the usual answer for the first child, and
    // wrong often enough that it stays changeable on every one of them.
    otherParent: seed.otherParent ?? ((resident.spouse as Resident | null) ?? null),
    outsideParent: seed.outsideParent ?? {
      first_name: "", middle_name: "", last_name: "", contact_number: "", address: "",
    },
    outsideParentId: seed.outsideParentId ?? null,
    motherIs: seed.motherIs ?? "",
    guardian: seed.guardian ?? null,
    guardianRelation: seed.guardianRelation ?? "",
  });
  const updateEntry = (index: number, changes: Partial<Entry>) =>
    setEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...changes } : entry)));
  const patchForm = (index: number, values: Partial<ResidentForm>) =>
    setEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, form: { ...entry.form, ...values } } : entry))
    );
  const addEntry = () =>
    setEntries((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        blankEntry({
          /*
           * Only the SURNAME carries over — siblings share one, and typing it
           * again is pure repetition. Everything else is asked afresh: which
           * house this person lives in is a question about THEM, and carrying
           * the last answer forward is how the second child silently inherits
           * a household nobody chose for them.
           */
          form: { last_name: last.form.last_name },
          // The first guardian entered is the contact unless the clerk says
          // otherwise; the second one is not, by default.
          isPrimary: false,
          /*
           * The other parent carries over because the next child is usually a
           * full sibling — but it is shown on THIS child's block and changed
           * there, which is the whole point: half-siblings can now be entered
           * in one go instead of one form each.
           */
          otherParentMode: last.otherParentMode,
          otherParent: last.otherParent,
          outsideParent: { ...last.outsideParent },
          outsideParentId: last.outsideParentId,
          motherIs: last.motherIs,
        }),
      ];
    });
  const removeEntry = (index: number) =>
    setEntries((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  /** Picks a household for ONE block, and keeps its purok in step. */
  const selectHousehold = (index: number, household: Household | null) =>
    setEntries((prev) =>
      prev.map((entry, i) =>
        i === index
          ? {
              ...entry,
              household,
              makeOwner: household ? entry.makeOwner : false,
              form: {
                ...entry.form,
                household_id: household ? String(household.id) : "",
                // Clearing the household clears its purok with it.
                zone_purok: household?.zone_purok ?? "",
              },
            }
          : entry
      )
    );
  const chooseHouseMode = (index: number, next: Entry["houseMode"]) =>
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry;
        // "same" takes the subject's house; anything else clears it, so the
        // purok below opens up again instead of keeping a stale answer.
        const household = next === "same" ? subjectHousehold : null;
        return {
          ...entry,
          houseMode: next,
          household,
          makeOwner: false,
          // The guardian belongs to that one answer. Switching away drops
          // them rather than quietly keeping a carer nobody is claiming.
          guardian: next === "guardian" ? entry.guardian : null,
          guardianRelation: next === "guardian" ? entry.guardianRelation : "",
          form: {
            ...entry.form,
            household_id: household ? String(household.id) : "",
            /*
             * Cleared, never carried over. Coming back from "same household"
             * the purok still on screen is the SUBJECT's, and leaving it
             * there has the form answering for a house nobody has picked yet.
             */
            zone_purok: household?.zone_purok ?? "",
          },
        };
      })
    );
  /**
   * The person the child actually lives with. Their purok becomes the
   * child's, because a child is filed where they sleep — the household
   * itself is resolved on the server, from the carer's own record.
   */
  const chooseGuardian = (index: number, person: Resident | null) =>
    setEntries((prev) =>
      prev.map((entry, i) =>
        i === index
          ? {
              ...entry,
              guardian: person,
              form: {
                ...entry.form,
                household_id: "",
                zone_purok: person?.zone_purok || "",
              },
            }
          : entry
      )
    );
  /**
   * A house has one head. Ticking it here unticks anyone else in the batch
   * claiming the SAME house — two people cannot both own it, and silently
   * letting the last one win is how the wrong name ends up on the household.
   */
  const toggleOwner = (index: number) =>
    setEntries((prev) => {
      const target = prev[index];
      const turningOn = !target.makeOwner;
      return prev.map((entry, i) => {
        if (i === index) return { ...entry, makeOwner: turningOn };
        if (turningOn && entry.household?.id === target.household?.id) {
          return { ...entry, makeOwner: false };
        }
        return entry;
      });
    });
  /* ---- child naming ---- */
  const surnameOf = (person: { last_name?: string } | null) => person?.last_name?.trim() || "";
  const nameOf = (person: { first_name?: string; last_name?: string } | null) =>
    person ? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() : "";
  /** One child's second parent, whether picked from the register or typed in. */
  const otherParentOf = (entry: Entry) =>
    entry.otherParentMode === "outside"
      ? entry.outsideParent.first_name || entry.outsideParent.last_name
        ? {
            first_name: entry.outsideParent.first_name,
            last_name: entry.outsideParent.last_name,
            gender: null,
          }
        : null
      : entry.otherParent;
  /**
   * Who is the mother and who is the father, for THIS child.
   *
   * Worked out from sex where both are on the register, asked outright where
   * it cannot be — a parent recorded from outside the barangay has a name and
   * a number, not a sex — and it is what the surname choices rest on.
   */
  const parentsOf = (entry: Entry) => {
    const other = otherParentOf(entry);
    const derived =
      resident.gender === "Female" ? "subject" : other?.gender === "Female" ? "other" : "";
    const side = entry.motherIs || derived;

    return {
      other,
      derived,
      side,
      mother: side === "subject" ? resident : side === "other" ? other : null,
      father: side === "subject" ? other : side === "other" ? resident : null,
    };
  };
  const canNamePattern = (entry: Entry) => {
    const { other, mother, father } = parentsOf(entry);
    return relation === "child" && !!other && !!mother && !!father;
  };
  /** One of the ways a child's name may lawfully be composed. */
  const applyNamePattern = (index: number, pattern: "father" | "mother" | "father-only") => {
    const { mother, father } = parentsOf(entries[index]);

    if (pattern === "father") {
      // RA 9255: the father's surname, with the mother's as the middle name.
      patchForm(index, { middle_name: surnameOf(mother), last_name: surnameOf(father) });
    } else if (pattern === "mother") {
      patchForm(index, { middle_name: "", last_name: surnameOf(mother) });
    } else {
      patchForm(index, { middle_name: "", last_name: surnameOf(father) });
    }
  };
  const subjectName = `${resident.first_name} ${resident.last_name}`;
  // Their OWN children — step-children already belong to somebody else and
  // are not what this question is about.
  const existingKids = resident.children ?? [];
  const canAddMore = relation !== "spouse" && mode === "new";
  const pendingForm = entries[pendingIndex]?.form ?? RESIDENT_FORM_INITIAL;
  const mixedBatch =
    entries.length > 1 &&
    entries.some((e) => e.livesOutside === true) &&
    entries.some((e) => e.livesOutside === false);

  return {
    copy, mode, setMode, existing, setExisting, unionType, setUnionType, guardianReason,
    setGuardianReason, guardianStartedOn, setGuardianStartedOn, existingChildren,
    setExistingChildren, entries, setEntries, hhForIndex, setHhForIndex, error, setError,
    saving, setSaving, savedNames, setSavedNames, namesakes, setNamesakes, pendingIndex,
    setPendingIndex, formRef, subjectHousehold, blankEntry, updateEntry, patchForm, addEntry,
    removeEntry, selectHousehold, chooseHouseMode, chooseGuardian, toggleOwner, surnameOf,
    nameOf, otherParentOf, parentsOf, canNamePattern, applyNamePattern, subjectName,
    existingKids, canAddMore, pendingForm, mixedBatch,
  };
}

export type RelativeBatchState = ReturnType<typeof useRelativeBatch>;
