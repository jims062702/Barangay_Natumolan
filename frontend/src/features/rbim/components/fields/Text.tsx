import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { groupThousands, onlyDigits } from "../../lib/format";
import { CharsLeft } from "./CharsLeft";

/**
 * A text box that can be switched off.
 *
 * Two cases need that, and they are the same case: a box whose question does
 * not apply. "If not Filipino" is dead while the answer is Filipino, and
 * "Others, please specify" is dead until Others is chosen. Leaving them open
 * invites an answer that contradicts the one beside it.
 */
export function Text({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
  required = false,
  disabled = false,
  disabledNote,
  maxLength,
  uppercase = false,
  readOnly = false,
  digits,
  max,
  money = false,
  prefix,
}: {
  label: string;
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  disabledNote?: string;
  maxLength?: number;
  /** For an initial: what is typed is what is stored, in one case. */
  uppercase?: boolean;
  /**
   * Shown but not editable — for a value that is genuinely typed somewhere
   * else. Not `disabled`: a disabled input is skipped by the browser's own
   * required-check, and these still have to be filled.
   */
  readOnly?: boolean;
  /** Digits only, and no more than this many of them. */
  digits?: number;
  /** The largest value the box will accept — 11 months, 12 pregnancies. */
  max?: number;
  /** Grouped in thousands as it is typed; bare digits are what is stored. */
  money?: boolean;
  /** Fixed text inside the field, ahead of the value — "+63", "₱". */
  prefix?: string;
}) {
  /*
    A number box is a text box in numeric mode.

    `type="number"` was the obvious choice and the wrong one: the browser
    ignores maxLength on it entirely, which is why a three-digit age box took
    seven digits happily. Its spinner arrows are a nuisance on a grid this
    dense, and a stray scroll over a focused one changes the value.
  */
  const numeric = digits !== undefined || money;

  const shown = disabled ? "" : money ? groupThousands(value) : (value ?? "");

  const handle = (raw: string) => {
    if (!numeric) {
      onChange(uppercase ? raw.toUpperCase() : raw);
      return;
    }

    const only = onlyDigits(raw, digits ?? 12);

    // Out of range is REJECTED, not clamped: typing 12 into a 0-11 box
    // leaves the 1 that was already there rather than silently becoming 11.
    if (only !== "" && max !== undefined && Number(only) > max) return;

    onChange(only);
  };

  return (
    <FormField label={label} hint={disabled ? (disabledNote ?? hint) : hint} required={required}>
      <span className="relative block">
        {prefix && !disabled && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-medium text-gray-500">
            {prefix}
          </span>
        )}
        <input
          type={numeric ? "text" : type}
          inputMode={numeric ? "numeric" : undefined}
          value={shown}
          maxLength={money ? undefined : maxLength}
          onChange={(e) => handle(e.target.value)}
          placeholder={disabled ? "" : placeholder}
          required={required && !disabled}
          disabled={disabled}
          readOnly={readOnly}
          style={prefix ? { paddingLeft: 14 + prefix.length * 9 } : undefined}
          /*
            One look for every box that cannot be typed in.

            Disabled and read-only are different to the browser and identical
            to the person: both mean "not yours to change here". Two shades of
            grey for one meaning just makes the clerk wonder which is which.
          */
          className={`${inputClasses} ${
            disabled || readOnly ? "cursor-not-allowed bg-secondary text-gray-400" : ""
          }`}
        />
      </span>

      {/* A box nobody can type in cannot run out of room. */}
      {!disabled && !readOnly && <CharsLeft value={value} max={money ? undefined : maxLength} />}
    </FormField>
  );
}
