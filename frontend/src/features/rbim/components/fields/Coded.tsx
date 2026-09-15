import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { SKIPPED } from "../../lib/constants";

/**
 * A labelled select over one of the form's numbered code lists.
 *
 * `skipped` is the case where the question was asked and does not apply —
 * an age band, or an earlier answer that the paper skips forward from. The
 * paper records that as 99, so the box is locked and says so, rather than
 * being left open for an encoder to answer something that cannot be true.
 */
export function Coded({
  label,
  list,
  value,
  onChange,
  hint,
  neededToRegister = false,
  skipped = false,
  skippedNote,
  lockedTo,
  lockedNote,
}: {
  label: string;
  list?: Record<string, string>;
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  hint?: string;
  /**
   * Starred, but not enforced by the browser.
   *
   * These are what REGISTERING needs, and a draft is allowed to be
   * half-finished — the whole point of the state. Marking them with the
   * browser's own `required` would block Save as draft, so the star says
   * what will be wanted and the check before submitting is what insists.
   */
  neededToRegister?: boolean;
  skipped?: boolean;
  skippedNote?: string;
  /**
   * Pinned to one code because the answer is not in question — Q2 on line 1
   * is Head, and nothing about the form can make it otherwise.
   */
  lockedTo?: string | number;
  lockedNote?: string;
}) {
  const pinned = lockedTo !== undefined;

  return (
    <FormField
      label={label}
      required={neededToRegister}
      hint={pinned ? lockedNote : skipped ? skippedNote : hint}
    >
      <select
        value={pinned ? String(lockedTo) : skipped ? SKIPPED : (value ?? "")}
        disabled={skipped || pinned}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClasses} ${
          skipped || pinned ? "cursor-not-allowed bg-secondary text-gray-400" : ""
        }`}
      >
        <option value="">—</option>
        {skipped && <option value={SKIPPED}>99 · Not applicable at this age</option>}
        {Object.entries(list ?? {}).map(([code, text]) => (
          <option key={code} value={code}>
            {code} · {text}
          </option>
        ))}
      </select>
    </FormField>
  );
}
