import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import PhoneInput from "../../../../shared/ui/PhoneInput";
import ChoiceGroup from "../../../../shared/ui/ChoiceGroup";
import { Band } from "../Band";
import ResidentPicker from "../../../resident/components/ResidentPicker";
import { REPORTING_CHANNELS, VIOLENCE_TYPES, localNow, RISK_LEVELS, OFFENDER_RELATIONSHIPS, IMMEDIATE_NEEDS } from "../../lib/caseOptions";
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
    reportedByContact, channel, setChannel, violenceType, setViolenceType, occurredAt,
    setOccurredAt, incidentLocation, setIncidentLocation, isOngoing, setIsOngoing,
    offenderNearby, setOffenderNearby, riskLevel, setRiskLevel, relationship, setRelationship,
    relationshipOther, setRelationshipOther, reportedAt, setReportedAt, setDependents,
    previousIncidents, setPreviousIncidents, needs, toggleNeed, needsOther, setNeedsOther,
    narrative, setNarrative, notes, setNotes,
  } = ctx;

  return (
    <Modal open={intakeOpen} onClose={closeIntake} title="Confidential Client Intake" size="xl">
      <form onSubmit={intake} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Band
          title="A. Survivor and reporter"
          hint="Who this case is about, and who brought it in."
        />
        <div className="sm:col-span-2 lg:col-span-3">
          <FormField label="Survivor (resident record)" required plain>
            <ResidentPicker
              value={survivor}
              onChange={setSurvivor}
              excludeIds={dependents.map((d) => d.id)}
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
            Reported by someone other than the survivor
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
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
                  excludeIds={survivor ? [survivor.id] : []}
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
            <FormField label="Relationship to survivor">
              <input
                value={reportedByRelationship}
                disabled={!reportedByOther}
                onChange={(e) => setReportedByRelationship(e.target.value)}
                className={inputClasses}
              />
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
                disabled={!reportedByOther || fromRecord}
              />
            </FormField>
          </div>
        </div>

        <FormField label="How the complaint reached us">
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClasses}>
            <option value="">Not recorded</option>
            {REPORTING_CHANNELS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </FormField>

        <Band
          title="B. The incident, and how dangerous it is now"
          hint="Everything above is who. This is what happened — and whether it is still happening."
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

        {/*
          The two questions the old form never asked, and the only two that
          are about tonight. An officer reading this decides whether to go
          now or to schedule a visit.
        */}
        {/*
          The two questions that are about tonight.

          ChoiceGroup rather than hand-rolled buttons, so the chosen answer
          carries a TICK and not only a shade of colour — and so that
          nothing is ticked until somebody actually chooses. "Not known" is
          an answer here, not the absence of one.
        */}
        <div className="sm:col-span-2 lg:col-span-3 grid gap-4 sm:grid-cols-2">
          <ChoiceGroup
            label="Is the incident still going on?"
            value={isOngoing}
            onChange={setIsOngoing}
            clearable
            onClear={() => setIsOngoing(null)}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "unknown", label: "Not known" },
            ]}
          />

          <ChoiceGroup
            label="Is the alleged offender with or near her now?"
            value={offenderNearby}
            onChange={setOffenderNearby}
            clearable
            onClear={() => setOffenderNearby(null)}
            options={[
              { value: "yes", label: "Yes", hint: "Treat this as immediate danger." },
              { value: "no", label: "No" },
              { value: "unknown", label: "Not known" },
            ]}
          />
        </div>

        {/*
          The officer's own judgement, in words rather than colours. It is
          the first assessment, not the last: every follow-up re-states it,
          so the docket shows what was last seen and not what was first
          assumed.
        */}
        <FormField
          label="Risk level"
          hint="Your assessment now. Each follow-up updates it."
        >
          <select
            value={riskLevel}
            onChange={(e) => setRiskLevel(e.target.value)}
            className={inputClasses}
          >
            <option value="">Not assessed yet</option>
            {RISK_LEVELS.map((level) => <option key={level}>{level}</option>)}
          </select>
        </FormField>
        <FormField label="Relationship to alleged offender">
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
              excludeIds={survivor ? [survivor.id] : []}
            />
          </FormField>
        </div>
        <FormField label="Previous incidents">
          <input
            type="number"
            min="0"
            value={previousIncidents}
            onChange={(e) => setPreviousIncidents(e.target.value)}
            className={inputClasses}
          />
        </FormField>

        {/*
          Needs as a list rather than a paragraph.

          Free text could not be counted, so nobody could answer "how many
          survivors this quarter needed shelter?" — which is the question a
          barangay budget is built on. "Other" stays, because the need
          nobody anticipated is exactly the one worth reading.
        */}
        <div className="sm:col-span-2 lg:col-span-3">
          <FormField plain label="Immediate needs" hint="Stored encrypted. Tick all that apply.">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {IMMEDIATE_NEEDS.map((need) => (
                <label
                  key={need}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray px-3 py-2 text-sm text-dark transition-colors hover:border-primary"
                >
                  <input
                    type="checkbox"
                    checked={needs.includes(need)}
                    onChange={() => toggleNeed(need)}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                  {need}
                </label>
              ))}
            </div>
          </FormField>

          <div className="mt-2">
            <FormField label="Anything else she needs">
              <input
                value={needsOther}
                onChange={(e) => setNeedsOther(e.target.value)}
                className={inputClasses}
                placeholder="Not on the list above"
              />
            </FormField>
          </div>
        </div>

        <Band
          title="C. Confidential case notes"
          hint="Encrypted, and visible to VAWC personnel only."
        />

        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-3">
          <FormField label="Incident narrative" hint="Stored encrypted">
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={2}
              className={`${inputClasses} resize-none`}
            />
          </FormField>
          <FormField label="Confidential interview notes" hint="Visible to VAWC personnel only">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
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
