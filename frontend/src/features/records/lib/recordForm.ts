/**
 * The record form: document types, dates and a blank draft.
 */

/** Mirrors the document_type enum on administrative_records. */
export const DOCUMENT_TYPES = [
  "Ordinance",
  "Resolution",
  "Executive Order",
  "Memorandum",
  "Meeting Minutes",
  "Committee Report",
  "Correspondence",
  "Contract",
  "Agreement",
  "Barangay Assembly Record",
  "Other",
];

export const today = () => new Date().toISOString().slice(0, 10);

export const asDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-PH") : "—";

export interface DraftForm {
  document_type: string;
  document_number: string;
  document_title: string;
  document_date: string;
  document_content: string;
  summary: string;
  file_reference: string;
}

export const emptyDraft = (): DraftForm => ({
  document_type: DOCUMENT_TYPES[0],
  document_number: "",
  document_title: "",
  document_date: today(),
  document_content: "",
  summary: "",
  file_reference: "",
});
