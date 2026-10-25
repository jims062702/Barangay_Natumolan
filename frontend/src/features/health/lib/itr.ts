/**
 * The Individual Treatment Record's consultation block, as this app holds it.
 *
 * The ITR is the DOH form the station already fills in on paper. These are
 * its fields, in its order, so somebody copying from the sheet reads down it
 * rather than hunting.
 */

/**
 * The twelve tests the form prints on its laboratory line, in that order.
 *
 * A COPY OF THE SERVER'S LIST — StoreVisitRequest::LABORATORY_TESTS refuses
 * anything not on it. Two copies is the price of a form that can be filled
 * in with no line; they must be changed together, and the server is the one
 * that decides.
 */
export const LABORATORY_TESTS = [
  "RBS/FBS",
  "Stool exam",
  "HBsAg",
  "HIV",
  "CBC",
  "U/A",
  "Blood typing",
  "Sputum exam",
  "PT",
  "VDRL",
  "UTZ",
  "Chest X-ray",
];

/**
 * What the form holds while it is being typed.
 *
 * Everything is a STRING, including the numbers. A half-typed "3" on the way
 * to "36.5" is not a number, and a number input that coerces as you go
 * either rejects the keystroke or silently rounds it. They are converted
 * once, on submit, where an empty box becomes undefined rather than zero —
 * a temperature nobody took is not 0°C.
 */
export interface ItrDraft {
  visit_date: string;
  visit_time: string;
  visit_reason: string;
  chief_complaints: string;

  blood_pressure: string;
  temperature: string;
  respiratory_rate: string;
  heart_rate: string;
  oxygen_saturation: string;
  height_cm: string;
  weight_kg: string;

  fundal_height_cm: string;
  fetal_heart_tone: string;
  age_of_gestation: string;
  presentation: string;

  medication: string;
  treatment_advice: string;
  laboratory: string[];

  referral_recommended: boolean;
  referral_destination: string;
}

/** An empty consultation, dated today. */
export const blankItr = (): ItrDraft => ({
  visit_date: new Date().toLocaleDateString("en-CA"),
  visit_time: "",
  visit_reason: "",
  chief_complaints: "",
  blood_pressure: "",
  temperature: "",
  respiratory_rate: "",
  heart_rate: "",
  oxygen_saturation: "",
  height_cm: "",
  weight_kg: "",
  fundal_height_cm: "",
  fetal_heart_tone: "",
  age_of_gestation: "",
  presentation: "",
  medication: "",
  treatment_advice: "",
  laboratory: [],
  referral_recommended: false,
  referral_destination: "",
});

/**
 * The draft as the API takes it.
 *
 * An empty box becomes `undefined`, never `""` and never `0`. The server's
 * rules are `nullable|numeric|between(...)`, and an empty string fails
 * `numeric` — so a consultation where nobody took a pulse would have been
 * refused for a reading that was never claimed.
 */
export function itrPayload(draft: ItrDraft, patientId?: number) {
  const text = (value: string) => (value.trim() === "" ? undefined : value.trim());
  const num = (value: string) => (value.trim() === "" ? undefined : Number(value));

  return {
    patient_id: patientId,
    visit_date: draft.visit_date,
    visit_time: text(draft.visit_time) ? draft.visit_time.trim().slice(0, 5) : undefined,
    visit_reason: draft.visit_reason,
    chief_complaints: text(draft.chief_complaints),

    blood_pressure: text(draft.blood_pressure),
    temperature: num(draft.temperature),
    respiratory_rate: num(draft.respiratory_rate),
    heart_rate: num(draft.heart_rate),
    oxygen_saturation: num(draft.oxygen_saturation),
    height_cm: num(draft.height_cm),
    weight_kg: num(draft.weight_kg),

    fundal_height_cm: num(draft.fundal_height_cm),
    fetal_heart_tone: num(draft.fetal_heart_tone),
    age_of_gestation: text(draft.age_of_gestation),
    presentation: text(draft.presentation),

    medication: text(draft.medication),
    treatment_advice: text(draft.treatment_advice),
    /* Omitted entirely when nothing was ticked, so the server's `nullable`
       sees no key rather than an empty array to fold into "". */
    laboratory: draft.laboratory.length > 0 ? draft.laboratory : undefined,

    referral_recommended: draft.referral_recommended,
    referral_destination: draft.referral_recommended
      ? text(draft.referral_destination)
      : undefined,
  };
}
