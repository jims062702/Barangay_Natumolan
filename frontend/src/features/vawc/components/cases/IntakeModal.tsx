import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import PhoneInput from "../../../../shared/ui/PhoneInput";
import ChoiceGroup from "../../../../shared/ui/ChoiceGroup";
import { Band } from "../Band";
import BpoFields from "../BpoFields";
import { RequiredQuestion } from "../Band";
import ResidentPicker from "../../../resident/components/ResidentPicker";
import {
  localNow, RELATIONSHIPS, OTHER, REPORTER_TYPES, FAMILY_REPORTERS,
  REPORTER_RELATIONSHIPS, DANGER_ANSWERS, PROTECTION_ANSWERS,
} from "../../lib/caseOptions";
import ResidentMultiPicker from "../../../resident/components/ResidentMultiPicker";
import { ViolenceChoice } from "./ViolenceChoice";
import type { CaseRegistryState } from "../../hooks/useCaseRegistry";

/**
 * Taking a new complaint in, confidentially.
 *
 *   A. Victim-Survivor and reporter
 *   B. Respondent
 *   C. Reported incident
 *   D. Immediate safety assessment — and the BPO, when protection is needed
 *   E. Confidential interview notes
 */
export function IntakeModal({ ctx }: { ctx: CaseRegistryState }) {
  const {
    intakeOpen, closeIntake, intake, survivor, setSurvivor, dependents,
    reportedByType, setReportedByType, reportedByOther,
    reporterOffRegister, reportedByName, setReportedByName,
    reportedByResident, pickReporter, setReporterOffRegister, setReportedByResident,
    setReportedByContact, reportedByRelationship, setReportedByRelationship, fromRecord,
    reportedByContact, violenceKinds, setViolenceKinds, violenceActs, setViolenceActs, occurredAt, setOccurredAt,
    approximateTime, setApproximateTime, incidentLocation, setIncidentLocation,
    narrative, setNarrative, relationship, setRelationship,
    relationshipOther, setRelationshipOther, reportedAt, setReportedAt, setDependents,
    notes, setNotes, respondent, setRespondent, applicantConsent, setApplicantConsent,
    currentlyInDanger, setCurrentlyInDanger, protectionNeeded, setProtectionNeeded, bpo, setBpo,
    intakeDraft,
  } = ctx;

  /* Asking WHICH relative only makes sense when a relative reported it. */
  const family = FAMILY_REPORTERS.includes(reportedByType);

  return (
    <Modal open={intakeOpen} onClose={closeIntake} title="Confidential Client Intake" size="xl">
      <form onSubmit={intake} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Band
          title="A. Victim-Survivor and reporter"
          hint="Who this case is about, and who reported it."
        />
        <div className="sm:col-span-2">
          <FormField
            label="Victim-Survivor"
            required
            plain
            hint="A woman (2026-09-30) — her children, boys and girls, are added to the case as dependents. The respondent may be a man or a woman."
          >
            {/* The respondent is excluded here as well as the other way
                round. The rule is one rule, and a form that enforces it in
                only one direction is passed by picking in the other order.
                Only women are offered; the server refuses anybody else. */}
            <ResidentPicker
              value={survivor}
              onChange={setSurvivor}
              gender="Female"
              excludeIds={[
                ...dependents.map((d) => d.id),
                ...(respondent ? [respondent.id] : []),
              ]}
            />
          </FormField>
        </div>

        <FormField label="Who reported the case?" required>
          <select
            value={reportedByType}
            onChange={(e) => {
              setReportedByType(e.target.value);
              /* A relative's "which relative" means nothing for a police
                 officer; it goes when the answer above stops asking it. */
              if (!FAMILY_REPORTERS.includes(e.target.value)) setReportedByRelationship("");
            }}
            required
            className={inputClasses}
          >
            <option value="">Select…</option>
            {REPORTER_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </FormField>

        {/*
          Only when somebody else reported it. When the victim-survivor came
          in herself there is no other name, number or consent to record,
          and dead boxes under every intake would be clutter.
        */}
        {reportedByOther && (
          <div className="grid gap-4 rounded-xl bg-secondary/60 p-4 sm:col-span-2 sm:grid-cols-3 lg:col-span-3">
            <FormField label="Name of the person who reported it" plain>
              {reporterOffRegister ? (
                <input
                  value={reportedByName}
                  onChange={(e) => setReportedByName(e.target.value)}
                  className={inputClasses}
                  maxLength={150}
                  placeholder="Full name"
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
            </FormField>

            {family ? (
              <FormField label="Relationship to the victim-survivor">
                <select
                  value={reportedByRelationship}
                  onChange={(e) => setReportedByRelationship(e.target.value)}
                  className={inputClasses}
                >
                  <option value="">Not recorded</option>
                  {REPORTER_RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </FormField>
            ) : (
              <div className="hidden sm:block" aria-hidden="true" />
            )}

            {/*
              A resident WITH a number on file: taken from their record and
              locked. WITHOUT one — most of the register — it stays typeable.
            */}
            <FormField
              label="Contact Number"
              hint={
                fromRecord
                  ? "From their resident record"
                  : !reporterOffRegister && reportedByResident
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
              state the circumstance of consent". It only arises here.
            */}
            <div className="sm:col-span-3">
              <FormField
                label="Circumstance of consent"
                hint="Why this person may report or apply on the victim-survivor's behalf. Stored encrypted."
              >
                <textarea
                  value={applicantConsent}
                  onChange={(e) => setApplicantConsent(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  className={`${inputClasses} resize-none`}
                  placeholder="Victim-survivor is a minor in the reporter's care; victim-survivor consented verbally at the counter…"
                />
              </FormField>
            </div>
          </div>
        )}

        {/*
          The respondent must live in this barangay: a barangay protection
          order is issued by this barangay against one of its own. The
          wording stays neutral — at intake the act is REPORTED, not proven.
        */}
        <Band
          title="B. Respondent"
          hint="Person reported to have committed the alleged act."
        />

        <div className="sm:col-span-2">
          <FormField label="Respondent" required plain>
            {/*
              The victim-survivor and the children cannot be picked here: an
              order restraining the person it protects is not one anybody
              can serve.
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

        <Band title="C. Reported incident" hint="Details of the reported incident." />

        {/* Nothing ticked to begin with: a kind sitting pre-chosen is
            recorded by whoever does not read this line. */}
        <ViolenceChoice
          kinds={violenceKinds}
          acts={violenceActs}
          onKinds={setViolenceKinds}
          onActs={setViolenceActs}
        />

        {/*
          The date, and the time apart from it. A victim-survivor recalling
          last Tuesday may not know the hour, so the time is optional and in
          words — "around 8:00 PM" — rather than a clock box demanding one.
        */}
        <FormField label="Date of incident">
          <input
            type="date"
            value={occurredAt}
            max={localNow().slice(0, 10)}
            onChange={(e) => setOccurredAt(e.target.value)}
            className={inputClasses}
          />
        </FormField>

        <FormField label="Approximate time of incident" hint="Optional">
          <input
            value={approximateTime}
            onChange={(e) => setApproximateTime(e.target.value)}
            maxLength={60}
            className={inputClasses}
            placeholder="e.g., around 8:00 PM"
          />
        </FormField>

        <FormField label="Place of incident" hint="Stored encrypted">
          <input
            value={incidentLocation}
            onChange={(e) => setIncidentLocation(e.target.value)}
            maxLength={255}
            className={inputClasses}
            placeholder="House, street, purok…"
          />
        </FormField>

        <FormField label="Relationship of the victim-survivor to the respondent">
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className={inputClasses}
          >
            <option value="">Not Recorded</option>
            {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
            <option value={OTHER}>Other (Specify)</option>
          </select>
          {/*
            Only when "Other" is chosen. A box that is always there gets
            filled in beside a chosen relationship, and the record then
            carries two answers to one question.
          */}
          {relationship === OTHER && (
            <input
              value={relationshipOther}
              onChange={(e) => setRelationshipOther(e.target.value)}
              placeholder="Specify the relationship"
              maxLength={100}
              required
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

        <div className="sm:col-span-2 lg:col-span-3">
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

        {/*
          "Threat" alone does not say what happened. This is the account of
          it; the interview notes further down stay for the officer's more
          sensitive observations.
        */}
        <div className="sm:col-span-2 lg:col-span-3">
          <FormField
            label="Brief description of the reported incident"
            required
            hint="Describe what the victim-survivor reported happened, using the person's own words where appropriate. Stored encrypted."
          >
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={3}
              required
              maxLength={10000}
              className={`${inputClasses} resize-y`}
              placeholder="The victim-survivor reported that the respondent threatened to physically harm her during an argument…"
            />
          </FormField>
        </div>

        <Band
          title="D. Immediate safety assessment"
          hint="Answered at the counter, before anything else is done."
        />

        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-3">
          <div>
            <RequiredQuestion text="Is the victim-survivor currently in danger?" />
            <ChoiceGroup
              value={currentlyInDanger}
              onChange={setCurrentlyInDanger}
              options={DANGER_ANSWERS.map((a) => ({
                value: a,
                label: a,
                hint: a === "Yes" ? "The case will be marked Critical." : undefined,
              }))}
            />
          </div>
          <div>
            <RequiredQuestion text="Immediate protection needed?" />
            <ChoiceGroup
              value={protectionNeeded}
              onChange={setProtectionNeeded}
              options={PROTECTION_ANSWERS.map((a) => ({ value: a, label: a }))}
            />
          </div>
        </div>

        {/*
          Protection is its own action, not a line inside a referral. A case
          may come straight here without any dialogue between the parties.
        */}
        {protectionNeeded === "Yes" && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:col-span-2 lg:col-span-3">
            <p className="text-sm font-bold text-dark">Protection assistance</p>
            <p className="mb-3 text-xs text-gray-600">Apply for Barangay Protection Order (BPO)</p>
            <BpoFields value={bpo} onChange={setBpo} showNotes={false} />
          </div>
        )}

        <Band
          title="E. Confidential interview notes"
          hint="The officer's own case notes, kept apart from the incident description. Encrypted, and visible to VAWC personnel only."
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

        <div className="space-y-2 sm:col-span-2 lg:col-span-3">
          <DraftNotice draft={intakeDraft} tabOnly />
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
