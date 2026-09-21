import FormField, { inputClasses } from "../../../shared/ui/FormField";
import ResidentPicker from "../../resident/components/ResidentPicker";
import type { Resident } from "../../../shared/types";
import { LABORATORY_TESTS, type ItrDraft } from "../lib/itr";

/**
 * One consultation block of the Individual Treatment Record, as a form.
 *
 * The ITR is the DOH form the station already fills in on paper, and its
 * consultation block is the part written at the table with the patient in
 * front of you. It asks for ELEVEN vital signs; the old form here asked for
 * three, so a midwife recording a prenatal check had nowhere to put the
 * fundal height, the fetal heart tone, the age of gestation or the
 * presentation — which, for that patient, ARE the examination.
 *
 * Laid out in the order the paper runs, because the paper is what somebody
 * is copying from: who, what they came about, the readings, what was given,
 * what was sent to the laboratory.
 *
 * The prenatal four sit in their own band rather than mixed into the vital
 * signs. On the form they share a column; on a screen, four boxes that are
 * blank for most patients read as fields somebody forgot to fill unless it
 * is said out loud that they belong to one kind of visit.
 */
export function ItrConsultationForm({ draft, set, patient, onPatient }: {
  draft: ItrDraft;
  set: <K extends keyof ItrDraft>(key: K, value: ItrDraft[K]) => void;
  patient: Resident | null;
  onPatient: (resident: Resident | null) => void;
}) {
  const toggleTest = (test: string) =>
    set(
      "laboratory",
      draft.laboratory.includes(test)
        ? draft.laboratory.filter((t) => t !== test)
        : [...draft.laboratory, test],
    );

  return (
    <>
      <div className="sm:col-span-2 lg:col-span-3">
        <FormField label="Patient" required plain>
          <ResidentPicker value={patient} onChange={onPatient} />
        </FormField>
      </div>

      <FormField label="Consultation date" required>
        <input
          type="date"
          value={draft.visit_date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => set("visit_date", e.target.value)}
          required
          className={inputClasses}
        />
      </FormField>

      <FormField label="Time">
        <input
          type="time"
          value={draft.visit_time}
          onChange={(e) => set("visit_time", e.target.value)}
          className={inputClasses}
        />
      </FormField>

      {/*
        "Type of consultation" on the paper. Kept as one required line rather
        than the form's twelve tick-boxes: the station reads this back as a
        label, and twelve boxes of which one is ticked is a dropdown.
      */}
      <FormField label="Type of consultation" required>
        <input
          value={draft.visit_reason}
          onChange={(e) => set("visit_reason", e.target.value)}
          required
          className={inputClasses}
          placeholder="General, Prenatal, Child care, Dental…"
        />
      </FormField>

      <div className="sm:col-span-2 lg:col-span-3">
        <FormField label="Chief complaints">
          <textarea
            value={draft.chief_complaints}
            onChange={(e) => set("chief_complaints", e.target.value)}
            rows={2}
            className={`${inputClasses} resize-none`}
            placeholder="What the patient came in about, in their words"
          />
        </FormField>
      </div>

      <Band title="Vital signs / assessment" />

      <FormField label="Blood pressure" hint="systolic/diastolic">
        <input
          value={draft.blood_pressure}
          onChange={(e) => set("blood_pressure", e.target.value)}
          className={inputClasses}
          placeholder="120/80"
          inputMode="numeric"
        />
      </FormField>

      <FormField label="Temperature (°C)">
        <input
          type="number"
          step="0.1"
          value={draft.temperature}
          onChange={(e) => set("temperature", e.target.value)}
          className={inputClasses}
          placeholder="36.5"
        />
      </FormField>

      <FormField label="Respiratory rate" hint="per minute">
        <input
          type="number"
          value={draft.respiratory_rate}
          onChange={(e) => set("respiratory_rate", e.target.value)}
          className={inputClasses}
        />
      </FormField>

      <FormField label="Pulse rate" hint="per minute">
        <input
          type="number"
          value={draft.heart_rate}
          onChange={(e) => set("heart_rate", e.target.value)}
          className={inputClasses}
        />
      </FormField>

      <FormField label="O2 saturation (%)">
        <input
          type="number"
          value={draft.oxygen_saturation}
          onChange={(e) => set("oxygen_saturation", e.target.value)}
          className={inputClasses}
          placeholder="98"
        />
      </FormField>

      <FormField label="Height (cm)">
        <input
          type="number"
          step="0.1"
          value={draft.height_cm}
          onChange={(e) => set("height_cm", e.target.value)}
          className={inputClasses}
        />
      </FormField>

      <FormField label="Weight (kg)">
        <input
          type="number"
          step="0.01"
          value={draft.weight_kg}
          onChange={(e) => set("weight_kg", e.target.value)}
          className={inputClasses}
        />
      </FormField>

      <Band
        title="For a prenatal check"
        hint="Blank for every other kind of visit — on the form these four share the vital-signs column."
      />

      <FormField label="Fundal height (cm)">
        <input
          type="number"
          step="0.1"
          value={draft.fundal_height_cm}
          onChange={(e) => set("fundal_height_cm", e.target.value)}
          className={inputClasses}
        />
      </FormField>

      <FormField label="Fetal heart tone" hint="beats per minute">
        <input
          type="number"
          value={draft.fetal_heart_tone}
          onChange={(e) => set("fetal_heart_tone", e.target.value)}
          className={inputClasses}
          placeholder="140"
        />
      </FormField>

      <FormField label="Age of gestation">
        <input
          value={draft.age_of_gestation}
          onChange={(e) => set("age_of_gestation", e.target.value)}
          className={inputClasses}
          placeholder="28 weeks"
        />
      </FormField>

      <FormField label="Presentation">
        <input
          value={draft.presentation}
          onChange={(e) => set("presentation", e.target.value)}
          className={inputClasses}
          placeholder="Cephalic, Breech…"
        />
      </FormField>

      <Band title="Medication / treatment" />

      <div className="sm:col-span-2 lg:col-span-3">
        <FormField label="Medication / treatment given">
          <textarea
            value={draft.medication}
            onChange={(e) => set("medication", e.target.value)}
            rows={2}
            className={`${inputClasses} resize-none`}
          />
        </FormField>
      </div>

      <div className="sm:col-span-2 lg:col-span-3">
        <FormField label="Advice given">
          <textarea
            value={draft.treatment_advice}
            onChange={(e) => set("treatment_advice", e.target.value)}
            rows={2}
            className={`${inputClasses} resize-none`}
          />
        </FormField>
      </div>

      <Band
        title="Laboratory"
        hint="Tick what was sent. The same twelve the form prints, in the same order."
      />

      <div className="sm:col-span-2 lg:col-span-3">
        {/*
          Tick-boxes, because the paper is tick-boxes and somebody is copying
          from it. A free-text line would be quicker to build and impossible
          to count — and "how many sputum exams this quarter?" is the question
          a station is actually asked.
        */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
          {LABORATORY_TESTS.map((test) => (
            <label
              key={test}
              className="flex cursor-pointer items-center gap-2 text-sm text-dark"
            >
              <input
                type="checkbox"
                checked={draft.laboratory.includes(test)}
                onChange={() => toggleTest(test)}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              {test}
            </label>
          ))}
        </div>
      </div>

      <Band title="Referral" />

      <div className="sm:col-span-2 lg:col-span-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-dark">
          <input
            type="checkbox"
            checked={draft.referral_recommended}
            onChange={(e) => set("referral_recommended", e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-primary"
          />
          Referred onward
        </label>

        {/* Hidden until it applies: a disabled box on every consultation is
            a dead control the eye has to skip past all day. */}
        {draft.referral_recommended && (
          <div className="mt-3">
            <FormField label="Referred to" required>
              <input
                value={draft.referral_destination}
                onChange={(e) => set("referral_destination", e.target.value)}
                required
                className={inputClasses}
                placeholder="District hospital, RHU…"
              />
            </FormField>
          </div>
        )}
      </div>
    </>
  );
}

/** A labelled rule across the form, so the paper's sections survive. */
function Band({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <p className="border-b border-gray pb-2 text-sm font-semibold text-dark">
        {title}
        {hint && <span className="mt-0.5 block text-xs font-normal text-gray-500">{hint}</span>}
      </p>
    </div>
  );
}
