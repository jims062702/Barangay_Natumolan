/**
 * The shapes of a household registered in one sitting.
 */

import type { Resident } from "../../../../shared/types";
import type { ResidentForm } from "../ResidentFormFields";

/** How a member is related to the household owner. */
export type MemberRelation = "spouse" | "child" | "parent" | "none";

/*
 * Who the second parent is.
 *
 * The register has to be told. Attaching a child to whoever the owner
 * happens to be married to is a guess, and it is wrong exactly where it
 * matters most — a child from an earlier marriage, a child whose mother
 * works abroad, a grandchild being raised in the house.
 */
export type OtherParentKind = "spouse" | "resident" | "outside" | "none";

export interface OtherParent {
  kind: OtherParentKind;
  /** Already on the register. */
  resident: Resident | null;
  /** Living elsewhere — recorded lightly, as a non-resident. */
  first_name: string;
  middle_name: string;
  last_name: string;
  /** Optional, but it is what makes the child’s record say Mother. */
  gender: string;
  contact_number: string;
  address: string;
  /**
   * The clerk asked for a blank form instead of the search.
   *
   * A parent who lives elsewhere is usually already on file — the second
   * child by the same mother abroad is the ordinary case. Typing her again
   * makes a duplicate, and the register then holds two women who are one
   * person, with one child each. So the search comes first.
   */
  typing: boolean;
}

export interface Member {
  form: ResidentForm;
  manualSectors: string[];
  autoLength: boolean;
  /*
   * null until the clerk answers.
   *
   * Nothing here is pre-picked. A form that opens with "Child" already
   * chosen is a form that records a boarder as a son the moment somebody
   * fills in the name and moves on — and it looks answered, so nobody
   * checks it. An unanswered question is the only honest starting state.
   */
  relation: MemberRelation | null;
  /** Son / Daughter / Adopted — "" means "work it out from their sex". */
  relationship: string | null;
  /**
   * A family member who does NOT live here: a mother working in Riyadh, a
   * father in Cebu. The owner names them in the same breath as everybody
   * else, and leaving them out is what makes a family record half a family.
   * They are recorded lightly — no purok, no sector, no portal account, and
   * not counted in the population.
   */
  livesOutside: boolean | null;
  /** For a child: who the second parent is. Null until asked. */
  otherParent: OtherParent | null;
  /**
   * Married, or living together.
   *
   * Null until asked, and it has to be asked: the record says "Husband" or
   * "Wife" off the back of this, and calling a live-in partner somebody's
   * wife is the same false statement as putting Married in their civil
   * status. Everything registered here used to be recorded as a marriage.
   */
  unionType: string | null;
}

/** One person the server thinks may already be registered. */
export interface DuplicateWarning {
  who: string;
  name: string;
  namesakes: { id: number; full_name?: string; resident_number?: string; zone_purok?: string }[];
}

/**
 * What an RBIM census line brings with it.
 *
 * A census records people the register has never heard of — that is what a
 * baseline census is for. Sending them here with a blank form meant typing
 * the whole household a second time, so the answers travel and the line
 * remembers where it came from.
 */
export interface CensusHandoff {
  censusPrefill?: Partial<ResidentForm>;
  censusReturn?: { censusId: number; memberId: number; censusNo: string; line: number };
}
