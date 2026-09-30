/**
 * Where a resident's pages live — in ONE place.
 *
 * The register moved from /residents to /population/residents, and the
 * pages that "correct" their own address kept sending people to the old
 * one. The old address redirects to the list, so opening any resident
 * bounced straight back to Residents & Households: the profile could never
 * be seen. Every page now asks here instead of spelling the path itself.
 */
export const RESIDENTS_HOME = "/population/residents";

/** The profile's address: a non-resident has its own, so the sidebar can tell. */
export function residentPath(id: number | string, isNonResident = false): string {
  return isNonResident
    ? `${RESIDENTS_HOME}/non-residents/${id}`
    : `${RESIDENTS_HOME}/${id}`;
}
