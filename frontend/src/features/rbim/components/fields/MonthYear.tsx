import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { SKIPPED } from "../../lib/constants";
import { maskMonthYear } from "../../lib/format";

/**
 * A month and a year, and nothing finer.
 *
 * The paper asks for exactly that - "write the month in the upper triangle
 * and the year in the lower" - and asking for a day the household was never
 * asked invents a fact. Two boxes side by side let the year be filled and the
 * month forgotten; one box cannot half-answer.
 */
export function MonthYear({
  label,
  value,
  onChange,
  hint,
  disabled = false,
  disabledNote,
  skipped = false,
  skippedNote,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  disabled?: boolean;
  disabledNote?: string;
  /** Shows the form's own 99 rather than a blank, for a question not asked. */
  skipped?: boolean;
  skippedNote?: string;
}) {
  const off = disabled || skipped;
  const complete = /^(0[1-9]|1[0-2])\/\d{4}$/.test(value);
  const wrong = !off && value !== "" && !complete;

  return (
    <FormField
      label={label}
      hint={
        skipped
          ? (skippedNote ?? "99 - not asked.")
          : disabled
            ? (disabledNote ?? hint)
            : wrong
              ? "Month and year - 03/2024. The month is 01 to 12."
              : hint
      }
    >
      <input
        type="text"
        inputMode="numeric"
        placeholder={off ? "" : "MM/YYYY"}
        maxLength={7}
        value={skipped ? SKIPPED : off ? "" : value}
        disabled={off}
        onChange={(e) => onChange(maskMonthYear(e.target.value))}
        className={`${inputClasses} ${
          off ? "cursor-not-allowed bg-secondary text-gray-400" : ""
        } ${wrong ? "border-warning" : ""}`}
      />
    </FormField>
  );
}
