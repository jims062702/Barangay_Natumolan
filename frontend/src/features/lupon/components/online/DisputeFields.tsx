import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { RELATIONSHIPS } from "../../../../shared/lib/complaintFiling";
import { CLASSIFICATIONS } from "../../lib/docket";

/**
 * The dispute itself: who it is against, and what happened.
 *
 * Shared by the public form and the resident portal's, because the dispute
 * is the same thing however the person got to the page — only the identity
 * questions differ between the two. Written twice they would drift, and the
 * office would be reading two different accounts of the same event depending
 * on which form was used.
 */
export interface DisputeValue {
  respondentName: string;
  respondentAddress: string;
  narrative: string;
  occurredOn: string;
  place: string;
  relationship: string;
  /** Nature of the Case, as the complainant sees it — the Lupon confirms it on acceptance. */
  nature: string;
}

export const BLANK_DISPUTE: DisputeValue = {
  respondentName: "",
  respondentAddress: "",
  narrative: "",
  occurredOn: "",
  place: "",
  relationship: "",
  nature: "",
};

export function DisputeFields({
  value,
  onChange,
  today,
}: {
  value: DisputeValue;
  onChange: (next: DisputeValue) => void;
  /** The latest date the form will accept, as YYYY-MM-DD in Manila. */
  today: string;
}) {
  const set = <K extends keyof DisputeValue>(key: K, next: DisputeValue[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Who is the complaint against?"
          required
          hint="Their full name, as you know it."
        >
          <input
            value={value.respondentName}
            onChange={(e) => set("respondentName", e.target.value)}
            className={inputClasses}
            maxLength={200}
            required
            placeholder="e.g. Juan Dela Cruz"
          />
        </FormField>

        <FormField
          label="Where do they live?"
          hint="A purok or a landmark is enough. The barangay serves the summons here."
        >
          <input
            value={value.respondentAddress}
            onChange={(e) => set("respondentAddress", e.target.value)}
            className={inputClasses}
            maxLength={255}
            placeholder="e.g. Zone 3, near the chapel"
          />
        </FormField>
      </div>

      <FormField
        label="What happened?"
        required
        hint="In your own words. The office reads this before you arrive, so the more clearly it is written the shorter your visit."
      >
        <textarea
          value={value.narrative}
          onChange={(e) => set("narrative", e.target.value)}
          className={inputClasses}
          rows={7}
          minLength={20}
          maxLength={5000}
          required
          placeholder="Describe what happened, when, and who was there."
        />
        {/*
          The count is shown only once it matters. A counter sitting under an
          empty box reads as a requirement to fill it; sitting under twelve
          characters it explains why the button will not work yet.
        */}
        {value.narrative.length > 0 && value.narrative.length < 20 && (
          <span className="mt-1 block text-xs font-medium text-warning">
            A little more detail, please — {20 - value.narrative.length} more character(s).
          </span>
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="When did it happen?" hint="Leave blank if you are not sure.">
          <input
            type="date"
            value={value.occurredOn}
            onChange={(e) => set("occurredOn", e.target.value)}
            max={today}
            className={inputClasses}
          />
        </FormField>

        <FormField label="Where did it happen?">
          <input
            value={value.place}
            onChange={(e) => set("place", e.target.value)}
            className={inputClasses}
            maxLength={255}
            placeholder="e.g. in front of my house"
          />
        </FormField>

        {/*
          Five answers and nothing else, because the case file's own column
          allows five. A sixth typed here would be accepted by the form and
          then silently truncated when the Lupon accepted the complaint.
        */}
        {/* The same list the counter files a case under (File Complaint). */}
        <FormField label="Nature of the Case" hint="Optional. The Lupon confirms or changes it when your complaint is accepted.">
          <select
            value={value.nature}
            onChange={(e) => set("nature", e.target.value)}
            className={inputClasses}
            aria-label="Nature of the Case"
          >
            <option value="">Not sure — the Lupon will decide</option>
            {CLASSIFICATIONS.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="How do you know them?">
          <select
            value={value.relationship}
            onChange={(e) => set("relationship", e.target.value)}
            className={inputClasses}
          >
            <option value="">Not sure / prefer not to say</option>
            {RELATIONSHIPS.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        </FormField>
      </div>
    </div>
  );
}
