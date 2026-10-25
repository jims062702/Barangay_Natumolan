import NeedsConnection, { useNeedsConnection } from "../../../shared/offline/NeedsConnection";
import { useEffect, useState, type FormEvent } from "react";
import { FiEdit2, FiEye, FiPlus } from "react-icons/fi";
import { Link } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { confirmAction } from "../../../shared/lib/confirm";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import RowAction, { RowActions } from "../../../shared/ui/RowAction";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import DraftNotice from "../../../shared/ui/DraftNotice";
import Modal from "../../../shared/ui/Modal";
import PageHeader from "../../../shared/ui/PageHeader";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import { vawcApi } from "../api";
import { DOCUMENT_TYPES, formatDay, manilaToday } from "../lib/caseOptions";
import type { VawcAccessLog, VawcDocument } from "../types";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

/** Access-trail actions, labelled for the audit table. */
const ACTION_LABELS: Record<string, string> = {
  created: "Case created",
  viewed: "Case viewed",
  updated: "Case updated",
  survivor_changed: "Victim-Survivor re-linked",
  safety_assessed: "Safety assessment updated",
  bpo_recorded: "BPO recorded",
  bpo_updated: "BPO updated",
  bpo_renewed: "BPO renewed",
  assessment_recorded: "Assessment recorded",
  assessment_updated: "Assessment updated",
  child_welfare_recorded: "Child welfare recorded",
  child_welfare_updated: "Child welfare updated",
  dialogue_recorded: "Dialogue recorded",
  dialogue_updated: "Dialogue corrected",
  report_viewed: "Named in a printed report",
  document_updated: "Document record edited",
  incident_added: "Incident added",
  referral_added: "Referral created",
  referral_updated: "Referral updated",
  followup_recorded: "Follow-up recorded",
  documents_viewed: "Documents viewed",
  document_added: "Document added",
};

const asDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-PH") : "—";

const asDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
    : "—";

type Tab = "documents" | "trail";

export default function Documents() {
  const { offline, noteOffline } = useNeedsConnection();
  const [tab, setTab] = useState<Tab>("documents");

  const [documents, setDocuments] = useState<VawcDocument[]>([]);
  const [docPage, setDocPage] = useState(1);
  const [docLastPage, setDocLastPage] = useState(1);
  const [docTotal, setDocTotal] = useState(0);
  const [docLoading, setDocLoading] = useState(true);
  /* Its skeleton until the register it opens on — the documents — is in.
     The access log loads behind it, and fills in if its tab is opened. */
  const pageLoad = usePageLoad();
  const [viewing, setViewing] = useState<VawcDocument | null>(null);

  // Metadata correction only — the register never swaps the underlying item.
  const [editing, setEditing] = useState<VawcDocument | null>(null);
  const [editForm, setEditForm] = useState({
    document_type: DOCUMENT_TYPES[0],
    document_date: "",
    title: "",
    description: "",
    file_reference: "",
  });

  // Adding a document directly from the register
  const [addingDoc, setAddingDoc] = useState(false);
  const [caseOptions, setCaseOptions] = useState<
    Array<{ id: number; case_code: string; status: string; survivor_name?: string }>
  >([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);
  const [createForm, setCreateForm] = useState({
    case_id: "",
    document_type: DOCUMENT_TYPES[0],
    document_date: manilaToday(),
    title: "",
    description: "",
    file_reference: "",
  });

  const [logs, setLogs] = useState<VawcAccessLog[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logLastPage, setLogLastPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logLoading, setLogLoading] = useState(true);

  const loadDocuments = () => {
    setDocLoading(true);
    vawcApi.documents({ params: { page: docPage } })
      .then((r) => {
        setDocuments(r.data.data.data ?? []);
        setDocLastPage(r.data.data.last_page ?? 1);
        setDocTotal(r.data.data.total ?? 0);
      })
      .then(() => pageLoad.done(), (error) => {
        /* No line: the page, with the notice that says why it is empty —
           this register is never kept on the device. */
        if (!(error as { response?: unknown })?.response) pageLoad.done();
        else pageLoad.fail(error);
        throw error;
      })
      .catch(noteOffline)
      .finally(() => setDocLoading(false));
  };

  const loadLogs = () => {
    setLogLoading(true);
    vawcApi.accessLogs({ params: { page: logPage } })
      .then((r) => {
        setLogs(r.data.data.data ?? []);
        setLogLastPage(r.data.data.last_page ?? 1);
        setLogTotal(r.data.data.total ?? 0);
      })
      .catch(noteOffline)
      .finally(() => setLogLoading(false));
  };

  const openAddDoc = () => {
    setAddingDoc(true);
    setLoadingCases(true);
    setCreateForm({
      case_id: "",
      document_type: DOCUMENT_TYPES[0],
      document_date: manilaToday(),
      title: "",
      description: "",
      file_reference: "",
    });
    vawcApi
      .cases({ params: { status: "Active" } })
      .then((r) => {
        const list = r.data?.data?.data ?? [];
        const mapped = list.map((c: any) => ({
          id: c.id,
          case_code: c.case_code,
          status: c.status,
          survivor_name: c.survivor
            ? `${c.survivor.first_name ?? ""} ${c.survivor.last_name ?? ""}`.trim()
            : undefined,
        }));
        setCaseOptions(mapped);
        if (mapped.length > 0) {
          setCreateForm((p) => ({ ...p, case_id: String(mapped[0].id) }));
        }
      })
      .catch((err) => {
        toast(errorMessage(err), "error");
      })
      .finally(() => setLoadingCases(false));
  };

  const saveCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.case_id) {
      toast("Please select a VAWC case.", "error");
      return;
    }
    if (!createForm.title.trim()) {
      toast("Please enter a document title.", "error");
      return;
    }
    setSavingDoc(true);
    try {
      await vawcApi.addDocument(Number(createForm.case_id), {
        document_type: createForm.document_type,
        document_date: createForm.document_date || null,
        title: createForm.title.trim(),
        description: createForm.description.trim() || null,
        file_reference: createForm.file_reference.trim() || null,
      });
      setAddingDoc(false);
      toast("Document successfully recorded in the register.");
      loadDocuments();
      loadLogs();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSavingDoc(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docPage]);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logPage]);

  useAutoRefresh(() => (tab === "documents" ? loadDocuments() : loadLogs()), REFRESH.staff);

  const openEdit = (d: VawcDocument) => {
    setEditing(d);
    setEditForm({
      document_type: d.document_type,
      document_date: d.document_date ?? "",
      title: d.title,
      description: d.description ?? "",
      file_reference: d.file_reference ?? "",
    });
  };

  /* A correction being typed, tab memory only. The record as it was opened
     is the version, so old typing never lands on a newer save. */
  const editBase = editing ? {
    document_type: editing.document_type,
    document_date: editing.document_date ?? "",
    title: editing.title,
    description: editing.description ?? "",
    file_reference: editing.file_reference ?? "",
  } : null;
  const editDraft = useModalDraft(
    editing ? `vawc-document-edit:${editing.id}` : null,
    editing !== null,
    editForm,
    (kept) => editBase && setEditForm({ ...editBase, ...kept }),
    {
      memoryOnly: true,
      blank: editBase ?? undefined,
      reset: () => editBase && setEditForm(editBase),
      version: editBase ? JSON.stringify(editBase) : null,
    },
  );

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    if (!(await confirmAction({ title: "Save changes to this document record?", confirmText: "Yes, save" })))
      return;
    try {
      await vawcApi.updateDocument(editing.id, {
        ...editForm,
        document_date: editForm.document_date || null,
        description: editForm.description || null,
        file_reference: editForm.file_reference || null,
      });
      editDraft.clear();
      setEditing(null);
      toast("Document record updated — the change is in the access trail.");
      loadDocuments();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const caseLink = (row: { vawc_case?: { id: number; case_code: string } | null }) =>
    row.vawc_case ? (
      <Link
        to={`/vawc/cases/${row.vawc_case.id}`}
        className="font-mono font-semibold text-primary hover:underline"
      >
        {row.vawc_case.case_code}
      </Link>
    ) : (
      "—"
    );

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={loadDocuments} />;

  return (
    <div>
      <PageHeader
        title="Documents & Access Trail"
        subtitle="Document register across every case, and the complete access trail"
        actions={
          tab === "documents" ? (
            <button
              type="button"
              onClick={openAddDoc}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-dark"
            >
              <FiPlus className="h-4 w-4" /> Record Document
            </button>
          ) : undefined
        }
      />

      {offline && (
        <NeedsConnection what="the document list" why="The VAWC desk's records are never kept on this device: the server encrypts them with a key this browser never holds, which is what keeps a survivor's case off a laptop." />
      )}

      <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-dark">
        <strong>Controlled access:</strong> printing or downloading any item
        here must be for an authorised purpose. Every case opened from this
        page is written to the access trail below, with your name and the time.
      </div>

      <div className="mb-4 rounded-2xl border border-gray bg-secondary px-4 py-3 text-xs text-gray-500">
        This is a <strong className="text-dark">register, not a file store</strong>.
        It records that a document exists, who holds it and where — the{" "}
        <strong className="text-dark">file reference</strong> is what you type
        to locate the physical or scanned copy (folder, cabinet, or case-file
        number). The document itself is not uploaded here.
      </div>

      <div className="mb-4 flex gap-2">
        {(
          [
            ["documents", "Document register"],
            ["trail", "Access trail"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`cursor-pointer rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              tab === key
                ? "bg-primary text-white"
                : "border border-gray bg-white text-dark hover:border-primary hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "documents" ? (
        <Card>
          <DataTable
            columns={[
              { header: "Case Code", render: caseLink },
              { header: "Type", render: (d: VawcDocument) => d.document_type },
              {
                header: "Title",
                render: (d: VawcDocument) => (
                  <button
                    type="button"
                    onClick={() => setViewing(d)}
                    className="cursor-pointer text-left font-medium text-primary hover:underline"
                  >
                    {d.title}
                  </button>
                ),
              },
              { header: "Document date", render: (d: VawcDocument) => (d.document_date ? formatDay(d.document_date, "medium") : "—") },
              { header: "File reference", render: (d: VawcDocument) => d.file_reference ?? "—" },
              { header: "Uploaded by", render: (d: VawcDocument) => d.uploader?.name ?? "—" },
              { header: "Recorded", render: (d: VawcDocument) => asDate(d.created_at) },
              {
                header: "Actions",
                render: (d: VawcDocument) => (
                  <RowActions>
                    <RowAction
                      label="View document"
                      icon={FiEye}
                      tone="primary"
                      onClick={() => setViewing(d)}
                    />
                    <RowAction label="Edit document" icon={FiEdit2} onClick={() => openEdit(d)} />
                  </RowActions>
                ),
              },
            ]}
            rows={documents}
            rowKey={(d) => d.id}
            numbered
            total={docTotal}
            searchable
            searchPlaceholder="Search by Case Code, Title, Type or File Reference…"
            getSearchText={(d) =>
              `${d.vawc_case?.case_code ?? ""} ${d.title} ${d.document_type} ${d.file_reference ?? ""}`
            }
            filters={[
              { label: "Type", getValue: (d) => d.document_type, options: DOCUMENT_TYPES },
            ]}
            loading={docLoading}
            page={docPage}
            lastPage={docLastPage}
            onPageChange={setDocPage}
            emptyMessage="No confidential documents recorded yet."
          />
        </Card>
      ) : (
        <Card>
          <DataTable
            columns={[
              { header: "When", render: (l: VawcAccessLog) => asDateTime(l.created_at) },
              { header: "Case Code", render: caseLink },
              {
                header: "Action",
                render: (l: VawcAccessLog) => ACTION_LABELS[l.action] ?? l.action,
              },
              { header: "Detail", render: (l: VawcAccessLog) => l.detail ?? "—" },
              { header: "Officer", render: (l: VawcAccessLog) => l.user?.name ?? "—" },
            ]}
            rows={logs}
            rowKey={(l) => l.id}
            numbered
            total={logTotal}
            searchable
            searchPlaceholder="Search by Case Code, Action or Officer…"
            getSearchText={(l) =>
              `${l.vawc_case?.case_code ?? ""} ${ACTION_LABELS[l.action] ?? l.action} ${l.detail ?? ""} ${l.user?.name ?? ""}`
            }
            filters={[
              { label: "Action", getValue: (l) => ACTION_LABELS[l.action] ?? l.action },
              { label: "Officer", getValue: (l) => l.user?.name ?? "—" },
            ]}
            loading={logLoading}
            page={logPage}
            lastPage={logLastPage}
            onPageChange={setLogPage}
            emptyMessage="No access recorded yet."
          />
        </Card>
      )}

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.title ?? "Document"}
      >
        {viewing && (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-3 rounded-xl bg-secondary px-4 py-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">Case</dt>
                <dd className="font-mono text-dark">{viewing.vawc_case?.case_code ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">Type</dt>
                <dd className="text-dark">{viewing.document_type}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">Document date</dt>
                <dd className="text-dark">{viewing.document_date ? formatDay(viewing.document_date) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">File reference</dt>
                <dd className="text-dark">{viewing.file_reference ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-gray-400">Uploaded by</dt>
                <dd className="text-dark">
                  {viewing.uploader?.name ?? "—"} · {asDate(viewing.created_at)}
                </dd>
              </div>
            </dl>
            {viewing.description && (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">Notes</p>
                <p className="whitespace-pre-wrap rounded-xl border border-gray px-4 py-3 text-dark">
                  {viewing.description}
                </p>
              </div>
            )}
            <p className="rounded-xl bg-secondary px-4 py-3 text-xs text-gray-500">
              The physical or scanned item is held under its file reference.
              This register records its existence and custody, not the file itself.
            </p>
          </div>
        )}
      </Modal>

      {/* Correct the particulars of a recorded document. */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit record — ${editing?.vawc_case?.case_code ?? ""}`}
      >
        <form onSubmit={saveEdit} className="space-y-4">
          <FormField label="Document type" required>
            <select
              value={editForm.document_type}
              onChange={(e) => setEditForm((p) => ({ ...p, document_type: e.target.value }))}
              className={inputClasses}
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
              {/* A type the list no longer offers stays readable until changed. */}
              {!DOCUMENT_TYPES.includes(editForm.document_type) && <option>{editForm.document_type}</option>}
            </select>
          </FormField>
          <FormField label="Document date">
            <input
              type="date"
              value={editForm.document_date}
              max={manilaToday()}
              onChange={(e) => setEditForm((p) => ({ ...p, document_date: e.target.value }))}
              className={inputClasses}
            />
          </FormField>
          <FormField label="Title" required>
            <input
              value={editForm.title}
              onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
              required
              className={inputClasses}
            />
          </FormField>
          <FormField
            label="File reference"
            hint="Where the actual copy is kept — folder, cabinet, or case-file number. The system stores this pointer, not the document."
          >
            <input
              value={editForm.file_reference}
              onChange={(e) => setEditForm((p) => ({ ...p, file_reference: e.target.value }))}
              className={inputClasses}
              placeholder="e.g. VAWC Cabinet 2, Folder 14"
            />
          </FormField>
          <FormField label="Notes" hint="Stored encrypted.">
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className={`${inputClasses} resize-none`}
            />
          </FormField>
          <DraftNotice draft={editDraft} tabOnly />
          <button
            type="submit"
            className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Save changes
          </button>
        </form>
      </Modal>

      {/* Record a new document */}
      <Modal
        open={addingDoc}
        onClose={() => setAddingDoc(false)}
        title="Record document in register"
      >
        <form onSubmit={saveCreate} className="space-y-4">
          <FormField label="VAWC Case" required hint="Select which case this document belongs to.">
            {loadingCases ? (
              <p className="text-xs text-gray-400">Loading cases...</p>
            ) : (
              <select
                value={createForm.case_id}
                onChange={(e) => setCreateForm((p) => ({ ...p, case_id: e.target.value }))}
                required
                className={inputClasses}
              >
                <option value="">Select a case...</option>
                {caseOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_code} {c.survivor_name ? `— ${c.survivor_name}` : ""} ({c.status})
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="Document type" required>
            <select
              value={createForm.document_type}
              onChange={(e) => setCreateForm((p) => ({ ...p, document_type: e.target.value }))}
              required
              className={inputClasses}
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Document date">
            <input
              type="date"
              value={createForm.document_date}
              max={manilaToday()}
              onChange={(e) => setCreateForm((p) => ({ ...p, document_date: e.target.value }))}
              className={inputClasses}
            />
          </FormField>

          <FormField label="Title" required hint="e.g. Police Blotter Extract, RHU Medical Certificate">
            <input
              value={createForm.title}
              onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
              required
              className={inputClasses}
              placeholder="e.g. Police Blotter Extract #104"
            />
          </FormField>

          <FormField
            label="File reference"
            hint="Where the actual physical copy is kept — folder, cabinet, or case-file number."
          >
            <input
              value={createForm.file_reference}
              onChange={(e) => setCreateForm((p) => ({ ...p, file_reference: e.target.value }))}
              className={inputClasses}
              placeholder="e.g. VAWC Cabinet 1, Folder 3"
            />
          </FormField>

          <FormField label="Notes / Description" hint="Optional description or details. Stored encrypted.">
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className={`${inputClasses} resize-none`}
              placeholder="Any additional notes about this document..."
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddingDoc(false)}
              className="cursor-pointer rounded-full border border-gray px-5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray/20"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingDoc}
              className="cursor-pointer rounded-full bg-primary px-6 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {savingDoc ? "Recording..." : "Record Document"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
