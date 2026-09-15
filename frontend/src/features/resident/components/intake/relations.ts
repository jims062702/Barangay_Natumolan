/**
 * What each person in the house can be to the head, in the words the office uses.
 */

import type { MemberRelation, OtherParent } from "./types";

export const RELATIONS: { value: MemberRelation; label: string; hint: string }[] = [
  { value: "spouse", label: "Spouse / Partner", hint: "Recorded as a union; their children link to both." },
  { value: "child", label: "Child", hint: "Also recorded as the owner's spouse's child, if there is one." },
  { value: "parent", label: "Parent", hint: "The lola or lolo living in the house." },
  {
    value: "none",
    label: "Other household member",
    hint: "Registered into the house with NO family link. Use this for a grandchild, a nephew, a boarder — anyone whose exact relation is not one of the three above. The office records the real link afterwards, from their profile.",
  },
];

/**
 * The words a clerk may choose for a child or a parent.
 *
 * Left unset, the card says Son or Daughter from their sex — which is right
 * most of the time and wrong in exactly the cases that matter. A step-son and
 * an adopted daughter are not a guess the register should make on somebody's
 * behalf, so the words are offered.
 */
export const CHILD_WORDS = ["Son", "Daughter", "Adopted"];

export const PARENT_WORDS = ["Mother", "Father", "Guardian"];

/**
 * A word that says the child is somebody else's.
 *
 * The register must not then hand them a second parent: their own two are
 * recorded elsewhere, and inventing one here is how a step-son ends up on a
 * stranger's birth details.
 */
/** Father / Mother, or the neutral word when no sex is recorded yet. */
export const parentWord = (gender: string): string =>
  gender === "Male" ? "Father" : gender === "Female" ? "Mother" : "Parent";

/**
 * A word that says the child's parentage is recorded elsewhere.
 *
 * Only adoption does now. The register does not model step relationships: a
 * parent's new spouse is recorded as their spouse, not as anything to the
 * child.
 */
export const isAdopted = (word: string | null): boolean => word === "Adopted";

/** The words, plus the "work it out" answer, as answers to a question. */
export const wordChoices = (words: string[], derived: string) => [
  { value: "", label: "From their sex", hint: derived },
  ...words.map((word) => ({ value: word, label: word })),
];

export const BLANK_OTHER_PARENT: OtherParent = {
  kind: "spouse",
  resident: null,
  first_name: "",
  middle_name: "",
  last_name: "",
  gender: "",
  contact_number: "",
  address: "",
  typing: false,
};
