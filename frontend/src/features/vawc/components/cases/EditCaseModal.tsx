import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import PhoneInput from "../../../../shared/ui/PhoneInput";
import ResidentPicker from "../../../resident/components/ResidentPicker";
import { VIOLENCE_TYPES } from "../../lib/caseOptions";
import ResidentMultiPicker from "../../../resident/components/ResidentMultiPicker";
import type { CaseRegistryState } from "../../hooks/useCaseRegistry";

/**
 * Correcting a case's intake details.
 */
export function EditCaseModal({ ctx }: { ctx: CaseRegistryState }) {
  const {
    editing, setEditing, saveEdit, editSurvivor, setEditSurvivor, editDependents,
    editReportedByOther, setEditReportedByOther, editForm, setEdit, setEditDependents,
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
            label="Survivor (resident record)"
            required
            hint="Re-linking a case to a different person is recorded in the access trail."
          >
            <ResidentPicker
              value={editSurvivor}
              onChange={setEditSurvivor}
              excludeIds={editDependents.map((d) => d.id)}
            />
          </FormField>
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-dark">
            <input
              type="checkbox"
              checked={editReportedByOther}
              onChange={(e) => setEditReportedByOther(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            Reported by someone other than the survivor
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Name">
              <input
                value={editForm.reported_by_name}
                disabled={!editReportedByOther}
                onChange={(e) => setEdit("reported_by_name", e.target.value)}
                className={inputClasses}
              />
            </FormField>
            <FormField label="Relationship to survivor">
              <input
                value={editForm.reported_by_relationship}
                disabled={!editReportedByOther}
                onChange={(e) => setEdit("reported_by_relationship", e.target.value)}
                className={inputClasses}
              />
            </FormField>
            <FormField label="Contact number">
              <PhoneInput
                value={editForm.reported_by_contact}
                onChange={(v) => setEdit("reported_by_contact", v)}
                disabled={!editReportedByOther}
              />
            </FormField>
          </div>
        </div>

        <FormField label="Type of reported violence" required>
          <select
            value={editForm.violence_type}
            onChange={(e) => setEdit("violence_type", e.target.value)}
            className={inputClasses}
          >
            {VIOLENCE_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Relationship to alleged offender">
          <input
            value={editForm.relationship_to_offender}
            onChange={(e) => setEdit("relationship_to_offender", e.target.value)}
            className={inputClasses}
          />
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
        <div className="sm:col-span-2 lg:col-span-3">
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
