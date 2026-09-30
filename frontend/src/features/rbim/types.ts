/**
 * The RBIM census form's own shapes.
 */

export type Codes = Record<string, Record<string, string>>;

/** What the household-number check answers. */
export interface HouseCheck {
  exists: boolean;
  household_number?: string;
  census?: {
    id: number;
    census_no: string;
    status: string;
    household_head_name: string;
    members_count: number;
  };
  household?: {
    id: number;
    household_number: string;
    zone_purok?: string | null;
    street_address?: string | null;
    head?: { id: number; first_name: string; last_name: string } | null;
  };
  residents?: {
    id: number;
    resident_number: string;
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    gender?: string | null;
    birthdate?: string | null;
    /* A date made from a month and a year — not to be copied as exact. */
    birthdate_is_estimated?: boolean | null;
  }[];
  resident_count?: number;
  censuses?: {
    id: number;
    census_no: string;
    status: string;
    members_count: number;
    household_head_name: string;
  }[];
}

/** Anything a household-level box can hold, lists included. */
export type FormValue = string | number | boolean | null | string[] | DeathRow[];

/** One death on the Q54 or Q55 list. Ages are typed, so they stay strings. */
export interface DeathRow {
  age?: string | null;
  sex?: string | null;
  cause?: string | null;
}

export interface Member {
  [key: string]: string | number | null | undefined;
  last_name: string;
  first_name: string;
  middle_name: string;
}
