import type { Catalogue } from "../types";

/**
 * What a certificate costs, worked out the way the ordinance does.
 *
 * Most types have one fee. A clearance is priced by what it is FOR and a
 * business clearance by the kind of business, so those read their price off
 * the catalogue's own table using the answer the form asked for.
 *
 * The same arithmetic as the server's CertificateCatalogue::feeFor, kept
 * here so a clerk with no line is quoted the amount that will be recorded.
 */
export function feeFor(
  catalogue: Catalogue | null,
  type: string,
  purposeText: string,
  answers: Record<string, string>,
): number {
  const spec = catalogue?.types.find((t) => t.name === type);

  if (!spec) return 0;
  if (spec.fee !== null) return spec.fee;

  const choice = spec.fee_field === "purpose" ? purposeText : answers[spec.fee_field ?? ""];
  const table =
    spec.fee_from === "clearance" ? catalogue?.clearance_purposes : catalogue?.business_kinds;

  return table?.[choice ?? ""] ?? catalogue?.other_certification_fee ?? 0;
}
