/**
 * A chat message, broken into the lines it is meant to be read as.
 *
 * THE BULLETS ARRIVED ON ONE LINE. The assistant's answers are written in
 * Rasa's domain.yml with YAML's folded style (`>-`), which joins consecutive
 * lines with a space — so a list written one item per line reached the
 * widget as
 *
 *     • Barangay Clearance — ₱50.00 • Certificate of Residency — ₱30.00 • …
 *
 * and was drawn exactly like that. Fixing the YAML needs the model retrained
 * and fixes only that one reply; fixing it HERE fixes every message — the
 * assistant's, the fallback's and the Clerk's — however it was written.
 *
 * So every bullet starts its own line, and a line that is a list separated
 * by middle dots (three or more items) becomes bullets too. A single " · "
 * between two phone numbers is punctuation, not a list, and is left alone.
 */

export interface ChatLine {
  /** True for a list item: drawn with a bullet and a hanging indent. */
  bullet: boolean;
  text: string;
}

const BULLET = /[•●▪]/;

/*
 * The emoji that open a line of contact details. Folded onto one line they
 * read as one run-on sentence: "📞 (088) … 📧 barangay… You can also …".
 */
const LINE_OPENERS = /([^\n])[ \t]*(📞|📧|📍|🕗)/gu;

/** "A: x · y · z. More." → the lead-in, the items, and what followed them. */
function splitDottedList(line: string): string[] {
  const parts = line.split(/\s+·\s+/);
  if (parts.length < 3) return [line];

  const out: string[] = [];

  /* "Standard fees: Barangay Clearance ₱50" — the first item is the tail of
     the lead-in sentence; split it off at the colon. */
  const first = parts[0];
  const colon = first.indexOf(": ");
  if (colon > 0) {
    out.push(first.slice(0, colon + 1));
    out.push("• " + first.slice(colon + 2));
  } else {
    out.push("• " + first);
  }

  parts.slice(1, -1).forEach((part) => out.push("• " + part));

  /* "Good Moral ₱50. Certificates of Indigency … are FREE." — the last item
     carries the next sentence with it; that sentence is not a list item. */
  const last = parts[parts.length - 1];
  const stop = last.search(/\.\s+(?=[A-Z])/);
  if (stop > 0) {
    out.push("• " + last.slice(0, stop + 1));
    out.push(last.slice(stop + 1).trim());
  } else {
    out.push("• " + last);
  }

  return out;
}

export function chatLines(text: string): ChatLine[] {
  const normalised = (text ?? "")
    .replace(/\r\n?/g, "\n")
    /* A bullet with text before it on the same line starts a new line. */
    .replace(/([^\n])[ \t]*([•●▪])[ \t]*/g, "$1\n$2 ")
    .replace(LINE_OPENERS, "$1\n$2");

  return normalised
    .split("\n")
    .flatMap((line) => splitDottedList(line))
    .map((line) => {
      const trimmed = line.trim();
      const bulleted = BULLET.test(trimmed.charAt(0)) || /^[-*]\s+/.test(trimmed);

      return bulleted
        ? { bullet: true, text: trimmed.replace(/^([•●▪]|[-*])\s*/, "") }
        : { bullet: false, text: trimmed };
    });
}
