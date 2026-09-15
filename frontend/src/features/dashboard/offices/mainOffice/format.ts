/**
 * How the Main Office dashboard writes dates and colours ageing requests.
 */

export const asDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-PH") : "—";

/** Aging buckets get progressively louder the longer work sits. */
export const AGING_TONES: Record<string, string> = {
  "0-3 days": "text-gray-500",
  "4-7 days": "text-dark",
  "8-14 days": "text-warning",
  "15+ days": "text-danger",
};
