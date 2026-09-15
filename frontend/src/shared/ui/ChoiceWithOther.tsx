import { useEffect, useState } from "react";
import { inputClasses } from "./FormField";

/**
 * A fixed list, and a way out of it.
 *
 * The ordinance prices a clearance by purpose and a business clearance by the
 * kind of business, so those are lists — typed freely, "Mayors permit" is not
 * "Mayor's Permit" and a resident was once charged the wrong fee because of
 * it. But no list names everything a resident needs a clearance for, or every
 * business in the barangay. With no way out, the clerk picked the nearest
 * wrong answer, and that wrong answer printed on the certificate.
 *
 * WHAT IS STORED is what the person actually wants printed: a listed name, or
 * the words typed after choosing "Others". Never the word "Others" itself —
 * a certificate "issued for the purpose Others" means nothing to whoever
 * reads it. An unlisted answer is priced at the ordinance's catch-all.
 *
 * READING IT BACK. A stored value that is not on the list opens with "Others"
 * selected and the words in the box, so a clerk correcting a resident's
 * online request sees exactly what the resident wrote and can pick the
 * proper listed answer if one fits.
 */
export const OTHER = "__other__";

export default function ChoiceWithOther({
  options,
  value,
  onChange,
  placeholder,
  otherPlaceholder,
  otherPrice,
  required = false,
}: {
  /** Listed answers and what each costs. */
  options: Record<string, number>;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  otherPlaceholder: string;
  /** What an unlisted answer costs — the ordinance's catch-all. */
  otherPrice?: number;
  required?: boolean;
}) {
  const listed = Object.prototype.hasOwnProperty.call(options, value);

  /*
   * "Others" is its own state, not something worked out from the value.
   *
   * Picking Others leaves the value empty until something is typed — and an
   * empty value looks exactly like "nothing chosen yet". Derived from the
   * value alone, the select would snap straight back to the placeholder the
   * moment Others was picked, taking the text box away before it could be used.
   */
  const [other, setOther] = useState(value !== "" && !listed);

  /* A value arriving from outside — a record being opened for editing. */
  useEffect(() => {
    if (value !== "" && !Object.prototype.hasOwnProperty.call(options, value)) {
      setOther(true);
    }
  }, [value, options]);

  return (
    <div className="space-y-2">
      <select
        value={other ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setOther(true);
            onChange("");

            return;
          }

          setOther(false);
          onChange(e.target.value);
        }}
        required={required}
        className={inputClasses}
      >
        <option value="">{placeholder}</option>
        {Object.entries(options).map(([name, amount]) => (
          <option key={name} value={name}>
            {name} — ₱{amount}
          </option>
        ))}
        <option value={OTHER}>
          Others (not on the list){otherPrice !== undefined ? ` — ₱${otherPrice}` : ""}
        </option>
      </select>

      {other && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoFocus
          maxLength={255}
          placeholder={otherPlaceholder}
          className={inputClasses}
        />
      )}
    </div>
  );
}

/** Whether a stored answer is one of the listed ones. */
export function isListed(options: Record<string, number> | undefined, value: string | null | undefined): boolean {
  return !!value && !!options && Object.prototype.hasOwnProperty.call(options, value);
}
