import { inputClasses } from "../../../../shared/ui/FormField";
import ChoiceWithOther from "../../../../shared/ui/ChoiceWithOther";
import type { Catalogue } from "../../types";
import { JOBSEEKER_LEVELS, SCHOOL_STATUSES } from "../../lib/certificateFields";
import type { CouncilMember } from "../../lib/certificate/types";

/**
 * One of a certificate's own questions — the same box wherever it is asked:
 * when the clerk files the certificate, and on its record before it prints.
 *
 * Two used to be different. Filing asked for the OR number and the
 * officer of the day; a certificate raised from the portal or the chatbot
 * was never filed at the counter, so nothing ever asked, and it printed with
 * both lines blank.
 */
export function TemplateFieldInput({
  name,
  value,
  onChange,
  catalogue,
  council,
  missing = false,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  catalogue: Catalogue | null;
  council: CouncilMember[];
  /** Outlined, when printing is waiting on it. */
  missing?: boolean;
}) {
  const classes = `${inputClasses} ${missing ? "border-danger ring-1 ring-danger/30" : ""}`;

  if (name === "business_kind") {
    return (
      <ChoiceWithOther
        options={catalogue?.business_kinds ?? {}}
        value={value}
        onChange={onChange}
        placeholder="Choose the kind of business…"
        otherPlaceholder="Type the kind of business — e.g. Water Refilling Station"
        otherPrice={catalogue?.other_certification_fee}
      />
    );
  }

  /* The two First-Time Jobseeker answers are the summary's own columns. */
  if (name === "educational_level" || name === "school_status") {
    const options = name === "educational_level"
      ? JOBSEEKER_LEVELS.map((v) => ({ value: v, label: v }))
      : SCHOOL_STATUSES;

    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={classes}>
        <option value="">Choose…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  if (name === "date_of_death") {
    return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={classes} />;
  }

  /*
   * The kagawad on duty, chosen from the council the paper already prints
   * down its side — typed names drift ("Hon. Agustero", "Angelie Agustero")
   * and the line is signed by that person. Typing stays possible for a
   * kagawad not on the roster yet.
   */
  if (name === "officer_of_the_day") {
    const kagawads = council.filter((m) => /kagawad/i.test(m.position));

    return (
      <>
        <input
          list="officer-of-the-day"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={kagawads.length ? "Choose or type the kagawad on duty…" : "Name of the kagawad on duty"}
          className={classes}
        />
        <datalist id="officer-of-the-day">
          {kagawads.map((m) => <option key={m.name} value={m.name} />)}
        </datalist>
      </>
    );
  }

  return <input value={value} onChange={(e) => onChange(e.target.value)} className={classes} />;
}
