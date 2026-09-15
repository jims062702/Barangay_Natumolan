/**
 * How many characters are left in a box.
 *
 * A cap the browser enforces on its own is the quietest failure on the form:
 * the letters simply stop appearing. Nothing is flagged, nothing is wrong to
 * look at, and the address that gets saved is cut off in the middle with
 * nobody the wiser.
 *
 * Shown only once there is something typed — thirty boxes each announcing
 * "80 characters left" over an empty form is noise — and only on boxes long
 * enough for the number to be worth reading. A middle initial does not need
 * a countdown.
 *
 * Deliberately NOT a live region. It changes on every keystroke, and a screen
 * reader announcing a new number after each letter is unusable; the input
 * carries its own maxLength, which is what assistive software reads.
 */
export function charsLeft(
  value: unknown,
  max?: number
): { text: string; tone: "quiet" | "tight" | "full" } | null {
  /* Too short for a countdown to be worth reading. A middle initial does not
     need one, and neither does a two-digit month. */
  if (!max || max < 20) return null;

  const used = String(value ?? "").length;

  /* Nothing typed, nothing to say. Thirty boxes each announcing "80
     characters left" over an empty form is noise, not help. */
  if (used === 0) return null;

  const left = max - used;

  if (left <= 0) {
    return { text: `Full — ${max} characters is the most this box takes`, tone: "full" };
  }

  /* Tight is the last fifth, or the last ten — whichever is more room. */
  const tight = Math.max(10, Math.round(max * 0.2));

  return {
    text: `${left} character${left === 1 ? "" : "s"} left`,
    tone: left <= tight ? "tight" : "quiet",
  };
}

export const CHARS_LEFT_TONE = {
  quiet: "text-gray-400",
  tight: "font-medium text-amber-700",
  full: "font-semibold text-danger",
} as const;

export function CharsLeft({ value, max }: { value: unknown; max?: number }) {
  const said = charsLeft(value, max);
  if (!said) return null;

  return (
    <span className={`mt-1 block text-right text-[11px] ${CHARS_LEFT_TONE[said.tone]}`}>
      {said.text}
    </span>
  );
}
