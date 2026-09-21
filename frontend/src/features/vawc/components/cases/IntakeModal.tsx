import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import PhoneInput from "../../../../shared/ui/PhoneInput";
import { Band } from "../Band";
import ResidentPicker from "../../../resident/components/ResidentPicker";
import {
  VIOLENCE_TYPES, localNow, OFFENDER_RELATIONSHIPS, REPORTER_RELATIONSHIPS,
} from "../../lib/caseOptions";
import ResidentMultiPicker from "../../../resident/components/ResidentMultiPicker";
import type { CaseRegistryState } from "../../hooks/useCaseRegistry";

/**
 * Taking a new complaint in, confidentially.
 */
export function IntakeModal({ ctx }: { ctx: CaseRegistryState }) {
  const {
    intakeOpen, closeIntake, intake, survivor, setSurvivor, dependents, reportedByOther,
    setReportedByOther, reporterOffRegister, reportedByName, setReportedByName,
    reportedByResident, pickReporter, setReporterOffRegister, setReportedByResident,
    setReportedByContact, reportedByRelationship, setReportedByRelationship, fromRecord,
    reportedByContact, violenceType, setViolenceType, occurredAt,
    setOccurredAt, incidentLocation, setIncidentLocation, relationship, setRelationship,
    relationshipOther, setRelationshipOther, reportedAt, setReportedAt, setDependents,
    notes, setNotes,
    respondent, setRespondent,
    applicantConsent, setApplicantConsent,
  } = ctx;

  return (
    <Modal open={intakeOpen} onClose={closeIntake} title="Confidential Client Intake" size="xl">
      <form onSubmit={intake} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Band
          title="A. Applicant and reporter"
          hint="Who this case is about, and who brought it in."
        />
        <div className="sm:col-span-2 lg:col-span-3">
          <FormField label="Applicant" required plain>
            {/* The respondent is excluded here as well as the other way
                round. The rule is one rule, and a form that enforces it in
                only one direction is passed by picking in the other order. */}
            <ResidentPicker
              value={survivor}
              onChange={setSurvivor}
              excludeIds={[
                ...dependents.map((d) => d.id),
                ...(respondent ? [respondent.id] : []),
              ]}
            />
          </FormField>
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-dark">
            <input
              type="checkbox"
              checked={reportedByOther}
              onChange={(e) => setReportedByOther(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            Reported by someone other than the applicant
          </label>
          {/*
            Hidden until the box is ticked, not merely disabled.

            Three greyed-out boxes sat under this checkbox on every intake,
            and most intakes are the applicant themselves — so the commonest
            case was the one that showed the most dead controls. A field that
            cannot apply should not be on the form at all.
          */}
          <div className="grid gap-4 sm:grid-cols-3" hidden={!reportedByOther}>
            <FormField label="Name" plain>
              {reporterOffRegister ? (
                <input
                  value={reportedByName}
                  disabled={!reportedByOther}
                  onChange={(e) => setReportedByName(e.target.value)}
                  className={inputClasses}
                  placeholder="Neighbour, relative, official…"
                />
              ) : (
                /* Searches the whole register — residents and recorded
                   non-residents alike. */
                <ResidentPicker
                  value={reportedByResident}
                  onChange={pickReporter}
                  excludeIds={[
                    ...(survivor ? [survivor.id] : []),
                    ...(respondent ? [respondent.id] : []),
                  ]}
                />
              )}

              {reportedByOther && (
                <button
                  type="button"
                  onClick={() => {
                    setReporterOffRegister((was) => !was);
                    setReportedByResident(null);
                    setReportedByName("");
                    /* The number belonged to the person being dropped. */
                    setReportedByContact("");
                  }}
                  className="mt-1.5 cursor-pointer text-xs font-semibold text-primary hover:underline"
                >
                  {reporterOffRegister
                    ? "Find them on the register instead"
                    : "Not on the register — type the name"}
                </button>
              )}
            </FormField>
            <FormField label="Relationship to applicant">
              <select
                value={reportedByRelationship}
                onChange={(e) => setReportedByRelationship(e.target.value)}
                className={inputClasses}
              >
                <option value="">Not recorded</option>
                {REPORTER_RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </FormField>
            {/*
              Three situations, and the field says which one it is in.

              A resident WITH a number on file: taken from their record and
              locked, because the record is the source and editing a copy of
              it here would quietly disagree with it.

              A resident WITHOUT one — which is most of the register — stays
              typeable. An empty locked box would read as broken, and the
              desk still needs a way to reach them.

              Somebody not on the register: typed, as it always was.
            */}
            <FormField
              label="Contact number"
              hint={
                fromRecord
                  ? "From their resident record"
                  : reportedByOther && !reporterOffRegister && reportedByResident
                    ? "No number on their record — type one"
                    : undefined
              }
            >
              <PhoneInput
                value={reportedByContact}
                onChange={setReportedByContact}
                disabled={fromRecord}
              />
            </FormField>
            {/*
              Item 9 of the application: "if applicant is not the victim,
              state the circumstance of consent".

              It sits inside this block and nowhere else, because outside it
              the question does not arise — when the applicant IS the victim
              there is no consent to account for. RA 9262 lets a parent,
              ascendant or relative apply on her behalf; the circumstance is
              what shows the application is one of those.
            */}
            <div className="sm:col-span-3">
              <FormField
                label="Circumstance of consent"
                hint="Why this person may apply on the victim's behalf. Stored encrypted."
              >
                <textarea
                  value={applicantConsent}
                  onChange={(e) => setApplicantConsent(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  className={`${inputClasses} resize-none`}
                  placeholder="Victim is a minor in the applicant's care; victim consented verbally at the counter…"
                />
              </FormField>
            </div>
          </div>
        </div>

        {/*
          "How the complaint reached us" is gone: every case here is taken at
          the counter, so the question had one true answer and six wrong ones.
        */}

        {/*
          Item 4 of the Application for Barangay Protection Order.

          THE RESPONDENT MUST LIVE IN THIS BARANGAY. A barangay protection
          order is issued by this barangay against one of its own; the Punong
          Barangay has no power over somebody who lives elsewhere, and an
          order naming them is one nobody can serve or enforce. So there is no
          "type the details" path here and no typed name — only the register,
          and only the part of it that lives here.

          The APPLICANT above is deliberately unrestricted. A woman may apply
          whoever she is and wherever she lives; it is where the RESPONDENT
          lives that decides whether this barangay may act at all.

          Everything else item 4 asks for — birth date, sex, address,
          telephone, occupation, civil status — is already on their resident
          record, and the order is drawn from the record rather than from a
          copy taken here, so it reaches where they live now.
        */}
        <Band
          title="B. The respondent"
          hint="Who the complaint is against. Must live in this barangay — that is what lets the Punong Barangay issue an order against them."
        />

        <div className="sm:col-span-2 lg:col-span-3">
          <FormField label="Respondent" plain>
            {/*
              The applicant and the children cannot be picked here: an order
              restraining the person it protects is not one anybody can serve.
              Two people share a name often enough that the picker shows age
              and purok under each, and keeps showing them after the pick.
            */}
            <ResidentPicker
              value={respondent}
              onChange={setRespondent}
              residentsOnly
              excludeIds={[
                ...(survivor ? [survivor.id] : []),
                ...dependents.map((d) => d.id),
              ]}
            />
          </FormField>
        </div>

        <Band
          title="C. The incident"
          hint="Everything above is who. This is what happened."
        />

        {/*
          No default. "Physical" sat there pre-chosen, so a form submitted
          without anybody reading this line recorded physical violence —
          the commonest kind, which is exactly what makes the wrong answer
          hard to spot afterwards.
        */}
        <FormField label="Type of reported violence" required>
          <select
            value={violenceType}
            onChange={(e) => setViolenceType(e.target.value)}
            required
            className={inputClasses}
          >
            <option value="">Select type…</option>
            {VIOLENCE_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </FormField>
        {/*
          When and where it happened — not when it was reported.

          The form recorded only the second. A prescription period runs
          from the act, and "last night" and "last year" are not the same
          case to anybody deciding what to do about it.
        */}
        {/*
          A date, no clock. A survivor recalling last Tuesday does not
          recall 14:35, and a box asking for one invites a number nobody
          stands behind.
        */}
        <FormField label="When did it happen?" hint="The date is enough.">
          <input
            type="date"
            value={occurredAt}
            max={localNow().slice(0, 10)}
            onChange={(e) => setOccurredAt(e.target.value)}
            className={inputClasses}
          />
        </FormField>

        <FormField label="Where did it happen?" hint="Stored encrypted">
          <input
            value={incidentLocation}
            onChange={(e) => setIncidentLocation(e.target.value)}
            className={inputClasses}
            placeholder="House, street, purok…"
          />
        </FormField>

        <FormField label="Relationship of the victim to the respondent">
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className={inputClasses}
          >
            <option value="">Not recorded</option>
            {OFFENDER_RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
          </select>
          {/*
            Only when "Other" is chosen. A box that is always there gets
            filled in beside a chosen relationship, and the record then
            carries two answers to one question.
          */}
          {relationship === "Other" && (
            <input
              value={relationshipOther}
              onChange={(e) => setRelationshipOther(e.target.value)}
              placeholder="Say what the relationship is"
              maxLength={100}
              className={`${inputClasses} mt-2`}
            />
          )}
        </FormField>
        <FormField label="Date and time reported" required>
          <input
            type="datetime-local"
            value={reportedAt}
            max={localNow()}
            onChange={(e) => setReportedAt(e.target.value)}
            required
            className={inputClasses}
          />
        </FormField>

        <div>
          <FormField plain label="Children / dependents involved">
            <ResidentMultiPicker
              value={dependents}
              onChange={setDependents}
              excludeIds={[
                ...(survivor ? [survivor.id] : []),
                ...(respondent ? [respondent.id] : []),
              ]}
            />
          </FormField>
        </div>
        <Band
          title="D. Confidential case notes"
          hint="Encrypted, and visible to VAWC personnel only."
        />

        <div className="grid gap-4 sm:col-span-2 lg:col-span-3">
          <FormField label="Confidential interview notes" hint="Visible to VAWC personnel only">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`${inputClasses} resize-none`}
            />
          </FormField>
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={!survivor}
            className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            Record case confidentially
          </button>
        </div>
      </form>
    </Modal>
  );
}
