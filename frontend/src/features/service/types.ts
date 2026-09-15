/**
 * The certificate counter's own shapes.
 */

/*
 * What the barangay issues and what it costs now comes from the server,
 * where the ordinance of 18 January 2020 is typed out once. It used to be
 * two lists in this file — eight types with one price each — which was the
 * wrong shape as much as the wrong numbers: a clearance is priced by what it
 * is FOR, ₱20 to ₱200, and a business clearance by the kind of business.
 */
export interface CatalogueType {
  name: string;
  fee: number | null;
  fee_from: string | null;
  fee_field: string | null;
  office: string;
  letterhead: string;
  needs_photo: boolean;
  /* False where the printed form has no purpose on it — Death, Marriage
     License, Construction. Absent from an older cached catalogue: asks. */
  asks_purpose?: boolean;
  fields: string[];
}

export interface Catalogue {
  types: CatalogueType[];
  clearance_purposes: Record<string, number>;
  business_kinds: Record<string, number>;
  other_certification_fee: number;
  documentary_stamp: number;
}
