import FormField, { inputClasses } from "../../../../shared/ui/FormField";

/** A plain dropdown over values that are not one of the form's code lists. */
export function Choice({
  label,
  options,
  value,
  onChange,
  hint,
  neededToRegister = false,
  placeholder = "—",
  error,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  hint?: string;
  /** Starred but not browser-enforced — see the note on Coded. */
  neededToRegister?: boolean;
  placeholder?: string;
  error?: string;
}) {
  return (
    <FormField label={label} required={neededToRegister} hint={hint} error={error}>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClasses} ${error ? "border-rose-500 ring-2 ring-rose-500/20" : ""}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}
