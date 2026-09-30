import FormField, { inputClasses } from "../../../shared/ui/FormField";

/** RBIM Q7's two answers, in the words the record keeps. */
export const FILIPINO = "Filipino";
export const NON_FILIPINO = "Non-Filipino";

/**
 * RBIM Q7 — Nationality. 1 Filipino; 2 not Filipino, and then what they are
 * ("2, Japanese").
 *
 * The record keeps the answer in words — "Filipino", "Japanese" — which is
 * what the Resident ID prints. A 2 with nothing written yet is kept as
 * "Non-Filipino": true, and all that was said.
 */
export function NationalityField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const code = value.trim() === "" ? "" : value.trim().toLowerCase() === FILIPINO.toLowerCase() ? "1" : "2";

  return (
    <FormField
      label="Nationality (Q7)"
      hint={code === "2"
        ? "Write what they are — e.g. Japanese. Left blank, the record says Non-Filipino."
        : "1 Filipino · 2 Non-Filipino, then what they are. Printed on the Resident ID."}
    >
      <select
        value={code}
        onChange={(e) => onChange(e.target.value === "1" ? FILIPINO : e.target.value === "2" ? NON_FILIPINO : "")}
        className={inputClasses}
      >
        <option value="">Not recorded</option>
        <option value="1">1 — Filipino</option>
        <option value="2">2 — Non-Filipino (specify)</option>
      </select>
      {code === "2" && (
        <input
          value={value === NON_FILIPINO ? "" : value}
          onChange={(e) => onChange(e.target.value.trim() === "" ? NON_FILIPINO : e.target.value)}
          maxLength={100}
          placeholder="e.g. Japanese"
          aria-label="Specify nationality"
          className={`${inputClasses} mt-2`}
        />
      )}
    </FormField>
  );
}
