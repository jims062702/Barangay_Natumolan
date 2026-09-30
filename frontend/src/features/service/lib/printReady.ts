import type { Certificate } from "../../../shared/types";
import type { CatalogueType } from "../types";
import { FIELD_LABELS, fromRegister } from "./certificateFields";

/**
 * Answers a form can print without: a father or mother nobody knows, the
 * late spouse and attached papers of a marriage-licence applicant who was
 * never widowed. Everything else the form asks is a line on the paper, and
 * printed empty it is a blank on a signed, sealed document.
 */
const MAY_BE_BLANK = new Set(["father_name", "mother_name", "late_spouse_name", "attached_documents"]);

/**
 * What still has to be filled in before this certificate prints — by label.
 *
 * The OR number only where money changed hands: an exempt or free
 * certificate has no official receipt to quote, and asking for one would
 * have the clerk invent a number.
 */
export function missingToPrint(certificate: Certificate, spec: CatalogueType | undefined): string[] {
  /*
   * What the paper will actually print: the certificate's own answers, and
   * where it has none, what the register knows (years at this address) —
   * the same fallback the paper itself makes, and the same start the
   * Details to print box shows. Judged on the answers alone, a Residency
   * certificate was refused as missing a number it would have printed.
   */
  const own = certificate.template_fields ?? {};
  const register = fromRegister(certificate.resident ?? null);
  /* An answer saved empty still falls back, as `f.x || r.x` does on paper. */
  const answer = (key: string) => String(own[key] ?? "").trim() || String(register[key] ?? "").trim();
  const paid = !certificate.is_exempt && Number(certificate.fee_amount) > 0;

  return (spec?.fields ?? [])
    .filter((key) => !MAY_BE_BLANK.has(key))
    .filter((key) => key !== "or_number" || paid)
    .filter((key) => !answer(key))
    .map((key) => FIELD_LABELS[key] ?? key);
}

/** The keys behind missingToPrint, for outlining the boxes themselves. */
export function missingKeys(certificate: Certificate, spec: CatalogueType | undefined, draft: Record<string, string>): string[] {
  const paid = !certificate.is_exempt && Number(certificate.fee_amount) > 0;

  return (spec?.fields ?? [])
    .filter((key) => !MAY_BE_BLANK.has(key))
    .filter((key) => key !== "or_number" || paid)
    .filter((key) => !String(draft[key] ?? "").trim());
}
