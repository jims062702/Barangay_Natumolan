/**
 * The shapes the add-relative dialog works with.
 */

import type { Household, Resident } from "../../../../shared/types";
import type { ResidentForm } from "../ResidentFormFields";

export type Relation = "parent" | "child" | "spouse" | "guardian";

/**
 * One person being entered. Everything here is theirs alone — including
 * whether they live in the barangay, so a batch can mix residents and
 * relatives from elsewhere.
 */
export interface Entry {
  form: ResidentForm;
  manualSectors: string[];
  autoLength: boolean;
  label: string;
  /** For a step-parent: which existing parent they married. */
  /**
   * null until the clerk answers. NOT false: living in the barangay is the
   * commoner answer, but starting on it means the form already claims
   * something nobody said — and this answer decides which record the person
   * gets, resident or not, so it is not one to guess at.
   */
  livesOutside: boolean | null;
  /**
   * "" until the clerk answers — no button starts ticked.
   *
   * "guardian" is the case a child registry actually needs: the child does
   * not live with the parent being entered, they live with a lola or a tita.
   * The house comes from that person, and the guardianship is written in the
   * same step instead of being a second job to remember.
   */
  houseMode: "same" | "other" | "guardian" | "";
  household: Household | null;
  makeOwner: boolean;
  /**
   * Guardians only. A child left with a couple has two guardians and only one
   * of them answers the phone; the barangay needs to know which.
   */
  isPrimary: boolean;
  /*
   * THIS child's other parent. Not the batch's: brothers and sisters usually
   * share a mother, but a man registering his children may well be entering
   * two families at once, and forcing one answer on all of them meant coming
   * back and doing the whole form again for the second.
   */
  otherParentMode: "registry" | "outside";
  otherParent: Resident | null;
  outsideParent: {
    first_name: string;
    middle_name: string;
    last_name: string;
    contact_number: string;
    address: string;
  };
  /**
   * The clerk pressed "Different parent" on this child.
   *
   * The other parent is already settled for most children — the partner on
   * record — so the question stays folded away and the answer is simply
   * shown. Asking it in full on every child made the commonest case the
   * slowest one, and a question whose answer is already right is a question
   * that gets answered without being read.
   */
  changingParent: boolean;
  /**
   * The clerk pressed "Type their details instead".
   *
   * A parent who lives elsewhere is very often ALREADY on file — the second
   * child by the same mother abroad is the ordinary case. Typing her again
   * makes a duplicate of her, and then the two children have two different
   * mothers who are the same person. So the search comes first, and the
   * blank form is what you ask for when she genuinely is not there.
   */
  typingOutsideParent: boolean;
  /** Set once a non-resident other parent has been created, so a resumed
   *  save does not enter her twice. */
  outsideParentId: number | null;
  /** Which of the two is the mother, where sex cannot settle it. */
  motherIs: "subject" | "other" | "";
  /** Whoever the child was left with, when that is not the parent above. */
  guardian: Resident | null;
  guardianRelation: string;
  /**
   * Set once this person has been posted. A batch that fails halfway is
   * resumed, not restarted — without this, pressing save again would enter
   * the ones that already went through a second time.
   */
  saved?: boolean;
}

/**
 * Everything a half-finished batch consists of, kept as one piece.
 *
 * Restoring only part of it would be worse than restoring none: a clerk who
 * sees three children come back but not the mother they were being linked to
 * would have to check every field before trusting any of it.
 */
export interface Draft {
  entries: Entry[];
  unionType: "Married" | "Live-in";
  /*
   * Facts about the CHILD, not about any one guardian: why the parents are
   * not raising them, and since when. Two guardians of the same child share
   * both, so asking twice would be asking the same question twice.
   */
  guardianReason: string;
  guardianStartedOn: string;
  /**
   * What a new marriage does to the children the subject ALREADY has.
   *
   * "none" by default, and the default writes nothing: a marriage is between
   * two people, and the children one of them already has are not part of it.
   * The other two answers are the clerk's to give, never the register's to
   * assume — that assumption is what put a second wife on the first wife's
   * children as their mother.
   */
  existingChildren: "none" | "shared" | "step";
}

export interface AddRelativeProps {
  open: boolean;
  relation: Relation;
  /** The resident whose profile this was opened from. */
  resident: Resident;
  onClose: () => void;
  onSaved: (message: string) => void;
}
