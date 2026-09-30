import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import PhoneInput from "../../../../shared/ui/PhoneInput";
import ResidentPicker from "../../../resident/components/ResidentPicker";
import {
  RELATIONSHIPS, OTHER, REPORTER_TYPES, FAMILY_REPORTERS, REPORTER_RELATIONSHIPS,
} from "../../lib/caseOptions";
import ResidentMultiPicker from "../../../resident/components/ResidentMultiPicker";
import { ViolenceChoice } from "./ViolenceChoice";
import type { CaseRegistryState } from "../../hooks/useCaseRegistry";

/**
 * Correcting a case's intake details.
 */
export function EditCaseModal({ ctx }: { ctx: CaseRegistryState }) {
  const {
    editing, setEditing, saveEdit, editSurvivor, setEditSurvivor, editDependents,
    editReportedByOther, editForm, setEdit, setEditDependents, editDraft,
  } = ctx;

  return (
    <Modal
      open={editing !== null}
      onClose={() => setEditing(null)}
      size="xl"
      title={`Edit intake — ${editing?.case_code ?? ""}`}
    >
      <form onSubmit={saveEdit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <FormField
            plain
            label="Victim-Survivor (resident record)"
            required
            hint="A woman. Re-linking a case to a different person is recorded in the access trail."
          >
            <ResidentPicker
              value={editSurvivor}
              onChange={setEditSurvivor}
              gender="Female"
              excludeIds={editDependents.map((d) => d.id)}
            />
          </FormField>
        </div>

        <FormField label="Who reported the case?" required>
          <select
            value={editForm.reported_by_type}
            onChange={(e) => setEdit("reported_by_type", e.target.value)}
            required
            className={inputClasses}
          >
            {REPORTER_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </FormField>

        {/* Only when somebody else reported it — see the intake form. */}
        {editReportedByOther && (
          <div className="grid gap-4 rounded-xl bg-secondary/60 p-4 sm:col-span-2 sm:grid-cols-3 lg:col-span-2">
            <FormField label="Name of the person who reported it">
              <input
                value={editForm.reported_by_name}
                onChange={(e) => setEdit("reported_by_name", e.target.value)}
                maxLength={150}
                className={inputClasses}
              />
            </FormField>
            {FAMILY_REPORTERS.includes(editForm.reported_by_type) ? (
              <FormField label="Relationship to the victim-survivor">
                <select
                  value={editForm.reported_by_relationship}
                  onChange={(e) => setEdit("reported_by_relationship", e.target.value)}
                  className={inputClasses}
                >
                  <option value="">Not recorded</option>
                  {REPORTER_RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
                  {/* An older free-text answer stays readable until changed. */}
                  {editForm.reported_by_relationship
                    && !REPORTER_RELATIONSHIPS.includes(editForm.reported_by_relationship) && (
                    <option>{editForm.reported_by_relationship}</option>
                  )}
                </select>
              </FormField>
            ) : (
              <div className="hidden sm:block" aria-hidden="true" />
            )}
            <FormField label="Contact Number">
              <PhoneInput
                value={editForm.reported_by_contact}
                onChange={(v) => setEdit("reported_by_contact", v)}
              />
            </FormField>
          </div>
        )}

        {/*
          The same choice the intake takes: one or more kinds, with the acts
          under each one optional. A case filed before the list existed is
          loaded with the one kind it already had, so correcting it here is
          how it gains the others it always was.
        */}
        <ViolenceChoice
          kinds={editForm.violence_types}
          acts={editForm.violence_acts}
          onKinds={(next) => setEdit("violence_types", next)}
          onActs={(next) => setEdit("violence_acts", next)}
        />
        <FormField label="Relationship of the victim-survivor to the respondent">
          <select
            value={editForm.relationship_choice}
            onChange={(e) => setEdit("relationship_choice", e.target.value)}
            className={inputClasses}
          >
            <option value="">Not Recorded</option>
            {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
            <option value={OTHER}>Other (Specify)</option>
          </select>
          {editForm.relationship_choice === OTHER && (
            <input
              value={editForm.relationship_other}
              onChange={(e) => setEdit("relationship_other", e.target.value)}
              placeholder="Specify the relationship"
              maxLength={100}
              required
              className={`${inputClasses} mt-2`}
            />
          )}
        </FormField>
        <FormField label="Previous incidents">
          <input
            type="number"
            min="0"
            value={editForm.previous_incidents_count}
            onChange={(e) => setEdit("previous_incidents_count", e.target.value)}
            className={inputClasses}
          />
        </FormField>

        <div className="sm:col-span-2">
          <FormField plain label="Children / dependents involved">
            <ResidentMultiPicker
              value={editDependents}
              onChange={setEditDependents}
              excludeIds={editSurvivor ? [editSurvivor.id] : []}
            />
          </FormField>
        </div>
        {/*
          A textarea, because intake now writes one need per line. A
          single-line input would show the list as one run-on string and
          save it back that way — quietly destroying what was ticked.
        */}
        <FormField label="Immediate needs" hint="One per line.">
          <textarea
            value={editForm.immediate_needs}
            onChange={(e) => setEdit("immediate_needs", e.target.value)}
            rows={3}
            className={`${inputClasses} resize-y`}
          />
        </FormField>
        <div className="sm:col-span-2 lg:col-span-3">
          <FormField label="Confidential interview notes" hint="Stored encrypted">
            <textarea
              value={editForm.confidential_notes}
              onChange={(e) => setEdit("confidential_notes", e.target.value)}
              rows={1}
              className={`${inputClasses} resize-y`}
            />
          </FormField>
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-3">
          <DraftNotice draft={editDraft} tabOnly />
          <button
            type="submit"
            className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}
