import Modal from "../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import { DOCUMENT_TYPES } from "../lib/recordForm";
import type { RecordArchiveState } from "../hooks/useRecordArchive";

/**
 * Writing or changing a record.
 */
export function RecordFormModal({ ctx }: { ctx: RecordArchiveState }) {
  const { formOpen, closeForm, editing, save, draft, set } = ctx;

  return (
    <Modal
      open={formOpen}
      onClose={closeForm}
      size="xl"
      title={editing ? `Edit ${editing.document_number}` : "File Administrative Document"}
    >
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Document type" required>
            <select
              value={draft.document_type}
              onChange={(e) => set("document_type", e.target.value)}
              className={inputClasses}
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Document number" required hint="e.g. Ordinance No. 2026-05">
            <input
              name="document_number"
              value={draft.document_number}
              onChange={(e) => set("document_number", e.target.value)}
              required
              className={inputClasses}
            />
          </FormField>
        </div>
        <FormField label="Title" required>
          <input
            value={draft.document_title}
            onChange={(e) => set("document_title", e.target.value)}
            required
            className={inputClasses}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Document date" required>
            <input
              type="date"
              value={draft.document_date}
              onChange={(e) => set("document_date", e.target.value)}
              required
              className={inputClasses}
            />
          </FormField>
          <FormField label="File reference">
            <input
              value={draft.file_reference}
              onChange={(e) => set("file_reference", e.target.value)}
              className={inputClasses}
            />
          </FormField>
        </div>
        <FormField label="Summary">
          <textarea
            value={draft.summary}
            onChange={(e) => set("summary", e.target.value)}
            rows={2}
            className={`${inputClasses} resize-none`}
          />
        </FormField>
        <FormField label="Full text" required>
          <textarea
            value={draft.document_content}
            onChange={(e) => set("document_content", e.target.value)}
            required
            rows={3}
            className={inputClasses}
          />
        </FormField>
        <button
          type="submit"
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          {editing ? "Save changes" : "File document"}
        </button>
      </form>
    </Modal>
  );
}
