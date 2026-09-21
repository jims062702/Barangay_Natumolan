import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../../../shared/auth/AuthContext";
import { errorMessage } from "../../../shared/lib/api";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { type DraftForm, emptyDraft } from "../lib/recordForm";
import { recordsApi } from "../api";
import type { AdministrativeRecord } from "../types";

/**
 * The state and handlers of <AdministrativeRecords>, so its sections can share them.
 */
export function useRecordArchive() {
  const { user } = useAuth();
  const isPunongBarangay = user?.role === "Punong Barangay" || user?.role === "Admin";

  const [rows, setRows] = useState<AdministrativeRecord[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  // So the footer can say WHICH rows are on screen, not only the page.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdministrativeRecord | null>(null);
  const [draft, setDraft] = useState<DraftForm>(emptyDraft());

  const [viewing, setViewing] = useState<AdministrativeRecord | null>(null);

  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is
   * reading; a first load or a filter change should still say it is
   * working. Same fetch, and only the announcement differs.
   */
  const load = (silent = false) => {
    if (!silent) setLoading(true);
    recordsApi.records({ params: { page, archived: showArchived ? 1 : 0 } })
      .then((r) => {
        setRows(r.data.data.data ?? []);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, showArchived]);

  useAutoRefresh(() => load(true), REFRESH.staff);

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setDraft(emptyDraft());
  };

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setFormOpen(true);
  };

  const openEdit = (record: AdministrativeRecord) => {
    setEditing(record);
    setDraft({
      document_type: record.document_type,
      document_number: record.document_number,
      document_title: record.document_title,
      document_date: record.document_date.slice(0, 10),
      document_content: record.document_content,
      summary: record.summary ?? "",
      file_reference: record.file_reference ?? "",
    });
    setFormOpen(true);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !(await confirmAction({
        title: editing ? "Save changes to this document?" : "File this document?",
        confirmText: "Yes, save",
      }))
    )
      return;
    const payload = {
      ...draft,
      summary: draft.summary || null,
      file_reference: draft.file_reference || null,
    };
    try {
      if (editing) {
        await recordsApi.updateRecord(editing.id, payload, {
          offline: { label: `${draft.document_number}` },
        });
        toast(`${draft.document_number} updated.`);
      } else {
        await recordsApi.createRecord(payload, {
          offline: { label: `${draft.document_number}` },
        });
        toast(`${draft.document_number} filed.`);
      }
      setFormOpen(false);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const approve = async (record: AdministrativeRecord) => {
    if (
      !(await confirmAction({
        title: `Approve ${record.document_number}?`,
        text: "Once approved, the document can no longer be edited.",
        confirmText: "Yes, approve",
      }))
    )
      return;
    try {
      await recordsApi.approveRecord(record.id);
      toast(`${record.document_number} approved.`);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const toggleArchive = async (record: AdministrativeRecord) => {
    const archiving = !record.is_archived;
    if (
      !(await confirmAction({
        title: archiving ? `Archive ${record.document_number}?` : `Restore ${record.document_number}?`,
        confirmText: archiving ? "Yes, archive" : "Yes, restore",
      }))
    )
      return;
    try {
      await recordsApi.archiveRecord(record.id, { is_archived: archiving });
      toast(archiving ? "Document archived." : "Document restored.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const remove = async (record: AdministrativeRecord) => {
    if (
      !(await confirmAction({
        title: `Delete ${record.document_number}?`,
        text: "Only unapproved drafts can be deleted. Approved documents are archived instead.",
        confirmText: "Yes, delete",
        danger: true,
      }))
    )
      return;
    try {
      await recordsApi.deleteRecord(record.id);
      toast(`${record.document_number} deleted.`);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const set = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return {
    user, isPunongBarangay, rows, setRows, page, setPage, lastPage, setLastPage, total,
    setTotal, loading, setLoading, showArchived, setShowArchived, formOpen, setFormOpen,
    editing, setEditing, draft, setDraft, viewing, setViewing, load, closeForm, openCreate,
    openEdit, save, approve, toggleArchive, remove, set,
  };
}

export type RecordArchiveState = ReturnType<typeof useRecordArchive>;
