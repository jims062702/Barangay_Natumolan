/**
 * The words the add-relative dialog uses, per relation.
 */

import type { Relation } from "./types";

/**
 * Why a child is not living with their parents.
 *
 * A list rather than free text, because this is a number the barangay is
 * asked for — how many children here are growing up with their parents away.
 * Must match Guardianship::REASONS on the server.
 */
export const GUARDIAN_REASONS = [
  "Both parents work abroad (OFW)",
  "One parent works abroad (OFW)",
  "Parents work in another town or city",
  "Parents are deceased",
  "Parents are separated",
  "Parents cannot care for the child",
  "Other",
];

export const COPY: Record<Relation, { title: string; verb: string; plural: string; labelHint: string; labels: string[] }> = {
  parent: {
    title: "Add a parent",
    verb: "parent",
    plural: "parents",
    labelHint:
      "Optional — left unset, the card says Mother or Father from their sex. Set it for a guardian or a step-parent.",
    labels: ["Mother", "Father", "Guardian"],
  },
  child: {
    title: "Add a child",
    verb: "child",
    plural: "children",
    labelHint:
      "Optional — left unset, the card says Son or Daughter from their sex. Set it for a step-child or an adopted child.",
    labels: ["Son", "Daughter", "Adopted"],
  },
  spouse: {
    title: "Add a spouse",
    verb: "spouse",
    plural: "spouses",
    labelHint: "",
    labels: [],
  },
  /*
   * The lola, tita or neighbour a child was left with. Deliberately a
   * separate thing from a parent: recording a carer as a parent is what turns
   * her own children into the child's brothers and sisters.
   */
  guardian: {
    title: "Add a guardian",
    verb: "guardian",
    plural: "guardians",
    labelHint:
      "How they are related to the child — or that they are not related at all. Whoever the child was actually left with.",
    labels: [
      "Grandmother (Lola)",
      "Grandfather (Lolo)",
      "Aunt (Tita)",
      "Uncle (Tito)",
      "Elder sibling (Ate/Kuya)",
      "Other relative",
      "Family friend / neighbour",
      "Court-appointed guardian",
    ],
  },
};
