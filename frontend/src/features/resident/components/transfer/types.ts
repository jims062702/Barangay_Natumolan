/**
 * What an import preview says about each row of the spreadsheet.
 */

export interface PreviewRow {
  line: number;
  name: string;
  action: "create" | "update" | "duplicate";
  /** For a repeated line: the line it repeats, which is the one imported. */
  duplicate_of?: number;
  matched_number?: string | null;
  /** A household number this row would bring into being, if it names one. */
  new_household?: string | null;
  problems: string[];
  /**
   * Said, but not stopping the row: an RBIM answer the register has no
   * place for (a Living-in civil status, say), left blank.
   */
  notes?: string[];
}

/** One kind of note, said once, with the lines it applies to. */
export interface NoteGroup {
  key: string;
  title: string;
  explanation: string;
  lines: { line: number; name: string; detail: string }[];
}

export interface Preview {
  rows: PreviewRow[];
  note_groups?: NoteGroup[];
  summary: {
    total: number;
    create: number;
    update: number;
    errors: number;
    /** Rows that import, with an answer the register had no place for. */
    noted?: number;
    new_households: number;
  };
}
