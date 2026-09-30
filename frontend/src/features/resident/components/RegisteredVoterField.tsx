import { useEffect, useState } from "react";
import FormField, { inputClasses } from "../../../shared/ui/FormField";

/** The census form's own words when its "registered here" box is ticked. */
export const VOTER_HERE = "Barangay Natumolan";
export const NOT_A_VOTER = "Not a registered voter";

/**
 * RBIM Q32 — "In what barangay is ___ a registered voter?"
 *
 * Nearly always this barangay, so that is one choice rather than something
 * typed — "Natumolan", "NAT.", "Brgy. Natumolan" are three answers to a
 * search. Somebody registered elsewhere gets a box for where.
 */
export function RegisteredVoterField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const known = value === "" || value === VOTER_HERE || value === NOT_A_VOTER;
  const [elsewhere, setElsewhere] = useState(!known);

  /* A record loaded after the form opened decides which choice shows. */
  useEffect(() => {
    if (value !== "" && value !== VOTER_HERE && value !== NOT_A_VOTER) setElsewhere(true);
  }, [value]);

  const choice = elsewhere ? "elsewhere" : value;

  return (
    <FormField label="Registered voter in (Q32)">
      <select
        value={choice}
        onChange={(e) => {
          const next = e.target.value;
          setElsewhere(next === "elsewhere");
          onChange(next === "elsewhere" ? "" : next);
        }}
        className={inputClasses}
      >
        <option value="">Not recorded</option>
        <option value={VOTER_HERE}>{VOTER_HERE}</option>
        <option value="elsewhere">Another barangay…</option>
        <option value={NOT_A_VOTER}>{NOT_A_VOTER}</option>
      </select>
      {elsewhere && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={150}
          placeholder="Barangay and municipality — e.g. Sulop, Davao del Sur"
          aria-label="Barangay where they are a registered voter"
          className={`${inputClasses} mt-2`}
        />
      )}
    </FormField>
  );
}
