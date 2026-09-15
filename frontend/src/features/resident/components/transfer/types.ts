/**
 * What an import preview says about each row of the spreadsheet.
 */

export interface PreviewRow {
  line: number;
  name: string;
  action: "create" | "update";
  matched_number?: string | null;
  /** A household number this row would bring into being, if it names one. */
  new_household?: string | null;
  problems: string[];
}

export interface Preview {
  rows: PreviewRow[];
  summary: {
    total: number;
    create: number;
    update: number;
    errors: number;
    new_households: number;
  };
}
