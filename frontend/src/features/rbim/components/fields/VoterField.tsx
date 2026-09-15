import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { VOTER_HERE } from "../../lib/constants";
import { CharsLeft } from "./CharsLeft";

/**
 * Q32, where the answer is nearly always this barangay.
 *
 * Typing "Barangay Natumolan" onto every one of ten lines is ten chances to
 * spell it differently, and the tenth is the one that fails a search later.
 * The tick fills it; unticked, the box is open for somebody registered
 * elsewhere. Unticked is the default, because a form that assumes an answer
 * is a form that collects assumptions.
 */
export function VoterField({
  value,
  onChange,
  disabled = false,
  disabledNote,
}: {
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  disabled?: boolean;
  disabledNote?: string;
}) {
  const here = String(value ?? "") === VOTER_HERE;

  return (
    <FormField
      plain
      label="Q32 Registered voter in"
      hint={disabled ? disabledNote : "15 and above - the barangay they are registered in."}
    >
      <input
        type="text"
        maxLength={30}
        value={disabled ? "" : (value ?? "")}
        readOnly={here}
        disabled={disabled}
        placeholder={disabled ? "" : "Barangay and municipality"}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClasses} ${
          disabled || here ? "cursor-not-allowed bg-secondary text-gray-400" : ""
        }`}
      />

      <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-gray-500">
        <input
          type="checkbox"
          checked={here}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? VOTER_HERE : "")}
          className="h-4 w-4 cursor-pointer rounded border-gray text-primary focus:ring-primary/30"
        />
        Registered here in {VOTER_HERE}
      </label>

      {!disabled && !here && <CharsLeft value={value} max={30} />}
    </FormField>
  );
}
