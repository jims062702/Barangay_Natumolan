import type { Certificate, Resident, UnlistedPerson } from "../../../shared/types";
import { personName } from "../../../shared/lib/names";

/**
 * Who a certificate is for: the resident on the register — or, for somebody
 * the Population Office has not listed yet, the particulars the clerk typed
 * at the counter.
 *
 * One answer for every screen that names the holder, and for the printed
 * paper. Each reading `certificate.resident` on its own is how a certificate
 * for somebody not yet listed would print with a blank where the name goes.
 */
export function holderOf(
  certificate: Pick<Certificate, "resident" | "unlisted_person">,
): (Partial<Resident> & UnlistedPerson) | null {
  if (certificate.resident) return certificate.resident as Partial<Resident> & UnlistedPerson;

  return certificate.unlisted_person ? { ...certificate.unlisted_person } : null;
}

/** The holder's name, "—" when there is nobody to name. */
export function holderName(certificate: Pick<Certificate, "resident" | "unlisted_person">): string {
  const holder = holderOf(certificate);

  return holder ? personName(holder) || "—" : "—";
}

/** Whether the holder is somebody the register does not list yet. */
export function isUnlisted(certificate: Pick<Certificate, "resident_id" | "unlisted_person">): boolean {
  return !certificate.resident_id && !!certificate.unlisted_person;
}
