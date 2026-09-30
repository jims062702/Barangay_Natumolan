import { useEffect, useState, type FormEvent } from "react";
import Card from "../../../../shared/ui/Card";
import { useModalDraft } from "../../../../shared/lib/useModalDraft";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { useAuth } from "../../../../shared/auth/AuthContext";
import { DOCUMENT_TYPES, formatDay, manilaToday } from "../../lib/caseOptions";
import { vawcApi } from "../../api";
import type { VawcCase } from "../../types";
import { CardButton, saveToCase, SubmitButton } from "./parts";

/** Confidential documents on the case. */
export function DocumentsCard({ caseData, onAdd, active }: {
  caseData: VawcCase;
  onAdd: () => void;
  active: boolean;
}) {
  const documents = caseData.documents ?? [];

  return (
    <Card
      title="Confidential documents"
      action={active && <CardButton onClick={onAdd}>Add document</CardButton>}
    >
      {documents.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">No documents recorded.</p>
      ) : (
        <ul className="divide-y divide-gray/70">
          {documents.map((doc) => (
            <li key={doc.id} className="py-2.5 text-sm">
              <p className="font-medium text-dark">{doc.title}</p>
              <p className="text-xs text-gray-500">
                {doc.file_reference ? `${doc.file_reference} · ` : ""}
                {doc.document_type}
                {doc.document_date ? ` · dated ${formatDay(doc.document_date, "medium")}` : ""}
                {" · "}uploaded by {doc.uploader?.name ?? "—"}
              </p>
              {doc.description && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">{doc.description}</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-gray-400">
        Every view and change on this case is written to the access log.
      </p>
    </Card>
  );
}

/** "Add Confidential Document". */
export function DocumentModal({ caseId, open, onClose, onSaved }: {
  caseId: number;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [fileReference, setFileReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setType("");
    setTitle("");
    setDate("");
    setFileReference("");
    setNotes("");
  }, [open]);

  /* Tab memory only — a VAWC record is never written to the device. Kept
     through a closed dialog; gone on refresh, Discard, or logout. */
  const draft = useModalDraft(
    `vawc-document:${caseId}`,
    open,
    { type, title, date, fileReference, notes },
    (kept) => {
      setType(kept.type ?? "");
      setTitle(kept.title ?? "");
      setDate(kept.date ?? "");
      setFileReference(kept.fileReference ?? "");
      setNotes(kept.notes ?? "");
    },
    {
      memoryOnly: true,
      blank: { type: "", title: "", date: "", fileReference: "", notes: "" },
      reset: () => {
        setType("");
        setTitle("");
        setDate("");
        setFileReference("");
        setNotes("");
      },
    },
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveToCase(
      () => vawcApi.addDocument(caseId, {
        document_type: type,
        title: title.trim(),
        document_date: date || null,
        file_reference: fileReference.trim() || null,
        description: notes.trim() || null,
      }),
      () => { draft.clear(); onClose(); onSaved(); },
      "Document recorded.",
      "Record this confidential document?",
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Confidential Document">
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Document type" required>
          <select value={type} onChange={(e) => setType(e.target.value)} required className={inputClasses}>
            <option value="">Select…</option>
            {DOCUMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </FormField>
        <FormField label="Title" required hint="What the paper is, so it can be found in the file.">
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={255} className={inputClasses} />
        </FormField>
        <FormField label="Document date">
          <input
            type="date"
            value={date}
            max={manilaToday()}
            onChange={(e) => setDate(e.target.value)}
            className={inputClasses}
          />
        </FormField>
        <FormField
          label="File reference"
          hint="Where the physical or scanned copy is kept. The file itself is not uploaded here."
        >
          <input
            value={fileReference}
            onChange={(e) => setFileReference(e.target.value)}
            maxLength={255}
            placeholder="e.g. VAWC Cabinet 2, Folder 14"
            className={inputClasses}
          />
        </FormField>
        {/* Whoever records it is who uploaded it — shown, not typed. */}
        <FormField label="Uploaded by">
          <input value={user?.name ?? ""} readOnly disabled className={inputClasses} />
        </FormField>
        <FormField label="Notes" hint="Stored encrypted.">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={5000}
            className={`${inputClasses} resize-none`}
          />
        </FormField>
        <DraftNotice draft={draft} tabOnly />
        <SubmitButton>Save document record</SubmitButton>
      </form>
    </Modal>
  );
}
