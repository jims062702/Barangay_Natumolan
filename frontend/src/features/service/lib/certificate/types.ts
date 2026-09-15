/**
 * What a printed certificate is made from.
 */

export interface PrintableCertificate {
  certificate_number: string;
  reference_number: string;
  certificate_type: string;
  purpose: string | null;
  template_fields: Record<string, string> | null;
  photo_url?: string | null;
  resident?: {
    first_name?: string;
    middle_name?: string | null;
    last_name?: string;
    gender?: string | null;
    birthdate?: string | null;
    /* True when the register holds only a month and a year — see shared/lib/birthdate. */
    birthdate_is_estimated?: boolean | number | null;
    birth_place?: string | null;
    civil_status?: string | null;
    zone_purok?: string | null;
    address?: string | null;
    length_of_residence_years?: number | null;
  } | null;
}

export interface CouncilMember {
  position: string;
  name: string;
  /* What they are responsible for. The sidebar prints it under the name —
     it is the reason the panel is on the form at all. */
  committees?: string | null;
}
