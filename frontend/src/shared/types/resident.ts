/**
 * The resident register: a person, their household and their family.
 */

export interface Household {
  id: number;
  household_number: string;
  zone_purok?: string | null;
  street_address?: string | null;
  house_type?: string | null;
  household_head_id?: number | null;
  residents?: Resident[];
  head?: Resident | null;
  /*
   * The RBIM census sheet this household came from, if it came from one.
   *
   * Read on the Household Registry so the office does not look the same
   * household up in two lists — the form number IS the household number.
   */
  census?: {
    id: number;
    census_no: string;
    status: "Draft" | "Submitted";
    created_at?: string | null;
    recorder?: { id: number; name: string } | null;
  } | null;
}

export interface ResidentSector {
  id: number;
  resident_id: number;
  sector_type: string;
  enrolled_date?: string | null;
  is_active: boolean;
  /**
   * The card behind the tag. Solo Parent (RA 8972) and PWD are registrations
   * granted by an office, not judgements a clerk makes — a tag with nothing
   * behind it is how a benefit reaches the wrong household.
   */
  reference_no?: string | null;
  issued_on?: string | null;
  valid_until?: string | null;
  note?: string | null;
}

/**
 * One person on somebody's family card. Parents and children carry a `pivot`
 * holding the relationship label the clerk chose (Mother, Father, Son...).
 */
export interface FamilyMember {
  id: number;
  resident_number?: string;
  record_type?: string;
  address?: string | null;
  contact_number?: string | null;
  life_status?: string;
  date_of_death?: string | null;
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  suffix?: string | null;
  full_name?: string;
  gender?: string | null;
  birthdate?: string | null;
  /* True when only a month and a year were ever given: the RBIM census asks
     no day, so the stored one was filled in by the register. Screens show
     the month and year alone when this is set. */
  birthdate_is_estimated?: boolean | null;
  age?: number | null;
  zone_purok?: string | null;
  is_active?: boolean;
  relationship?: string | null;
  pivot?: { relationship?: string | null } | null;
  /**
   * Present only on a guardian or a ward. Care is not descent, so it carries
   * its own facts: why the parents are not raising them, since when, and
   * whether this is the person the barangay rings first.
   */
  guardianship?: {
    id: number;
    reason?: string | null;
    started_on?: string | null;
    is_primary?: boolean;
    note?: string | null;
  } | null;
}

/** A guardianship that has ended. Kept — a child's care history is asked about. */
export interface PastGuardian {
  id: number;
  guardian_id: number;
  name?: string | null;
  relation?: string | null;
  reason?: string | null;
  started_on?: string | null;
  ended_on?: string | null;
  end_reason?: string | null;
}

/**
 * The one sentence about who is raising this person.
 *
 * "missing" is the case this whole feature exists for: a child registered
 * here whose mother and father are both on the register as living somewhere
 * else, with nobody recorded as looking after them.
 */
export interface CareNote {
  kind: "recorded" | "missing";
  text: string;
}

/** The whole tree around one resident, as the family endpoints return it. */
export interface Family {
  parents: FamilyMember[];
  grandparents: FamilyMember[];
  spouse?: FamilyMember | null;
  children: FamilyMember[];
  /** All four of these are DERIVED from the parent/child links, never stored. */
  siblings: FamilyMember[];
  aunts_uncles?: FamilyMember[];
  cousins?: FamilyMember[];
  self?: FamilyMember | null;
  /** Care, not descent — nothing on the tree is derived from these. */
  guardians?: FamilyMember[];
  wards?: FamilyMember[];
  past_guardians?: PastGuardian[];
  care_note?: CareNote | null;
  /**
   * How the parents' marriage ended. Present ONLY when the family agreed the
   * children may see it — the reason is always recorded on the parents'
   * records, but consent governs who it is shown to.
   */
  parents_note?: {
    end_reason?: string | null;
    ended_on?: string | null;
    deceased_name?: string | null;
  } | null;
}

export interface Resident {
  id: number;
  resident_number: string;
  /**
   * "Resident" or "Non-resident". A non-resident is a relative who lives
   * outside the barangay: on the register so the family can be recorded, but
   * not a constituent — no portal account, not in the population count.
   */
  record_type?: string;
  /** Where a non-resident lives; residents get theirs from the household. */
  address?: string | null;
  /**
   * "Alive" or "Deceased". Separate from `is_active`, which only says whether
   * the record is in use — a duplicate and a person who has died are both
   * inactive, and the office has to tell them apart.
   */
  life_status?: string;
  date_of_death?: string | null;
  life_status_note?: string | null;
  first_name: string;
  middle_name?: string | null;
  /**
   * The mother's surname before marriage. In Philippine naming this IS the
   * middle name, and it is what tells two residents apart when their name
   * and birthday are identical.
   */
  mother_maiden_name?: string | null;
  /*
   * What this person is to the head of their household — Head, Spouse, Son,
   * Daughter — worked out from the family links and sent with the household
   * list. Blank where the links do not say: a house holds cousins, boarders
   * and grandparents, and the register does not guess.
   */
  relation_to_head?: string | null;
  last_name: string;
  suffix?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  /* True when only a month and a year were ever given: the RBIM census asks
     no day, so the stored one was filled in by the register. Screens show
     the month and year alone when this is set. */
  birthdate_is_estimated?: boolean | null;
  birth_place?: string | null;
  /** RBIM Q7, in words: "Filipino", or what they are ("Japanese"). */
  nationality?: string | null;
  civil_status?: string | null;
  occupation?: string | null;
  contact_number?: string | null;
  email?: string | null;
  household_id?: number | null;
  residency_status?: string;
  zone_purok?: string | null;
  length_of_residence_years?: number | null;
  educational_attainment?: string | null;
  /** RBIM Q32: where they are a registered voter. */
  registered_voter_in?: string | null;
  demographic_classification?: string | null;
  is_active?: boolean;
  full_name?: string;
  household?: Household | null;
  sectors?: ResidentSector[];
  /** Portal login account. Issued automatically at registration. */
  account?: { id: number; email: string; is_active: boolean; activated_at?: string | null } | null;
  /**
   * Set when this record was folded into another as a duplicate. A merged
   * record is a tombstone: kept so its certificates stay verifiable, but it
   * is nobody's resident any more.
   */
  merged_into_id?: number | null;
  /** Marriage — a mutual link, so both records point at each other. */
  spouse_id?: number | null;
  spouse?: FamilyMember | null;
  /**
   * Wife / Husband / Partner — decided by the server, because whether a
   * union is a marriage or a live-in partnership is not something the sex
   * of the two people can tell you.
   */
  spouse_label?: string | null;
  parents?: FamilyMember[];
  children?: FamilyMember[];
  /** Derived from the parent/child links, so appended, never stored. */
  grandparents?: FamilyMember[];
  siblings?: FamilyMember[];
  aunts_uncles?: FamilyMember[];
  cousins?: FamilyMember[];
  guardians?: FamilyMember[];
  wards?: FamilyMember[];
  past_guardians?: PastGuardian[];
  care_note?: CareNote | null;
  parents_note?: {
    end_reason?: string | null;
    ended_on?: string | null;
    deceased_name?: string | null;
  } | null;
  /** Returned once, by the register/add-relative endpoints. */
  portal_account?: {
    created: boolean;
    email?: string | null;
    password?: string | null;
    reason?: string | null;
  };
  family_notes?: string[];
}
