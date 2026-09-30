import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
import { errorMessage } from "../../../shared/lib/api";
import { announceWrite } from "../../../shared/lib/announceWrite";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import DraftNotice from "../../../shared/ui/DraftNotice";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import Modal from "../../../shared/ui/Modal";
import RowAction from "../../../shared/ui/RowAction";
import { healthApi } from "../api";
import { fmtDate, measure, NUTRITIONAL_STATUSES, yesNo } from "../lib/records";
import type { ChildHistory, ChildMeasurement } from "../types";
import ChildRecordModal from "./ChildRecordModal";

/**
 * CHILD HEALTH & NUTRITION RECORD — who the child is and who their parents
 * are, as the Population Office's register has them, and every weighing,
 * newest first.
 *
 * Nothing about who anybody is can be changed here: the register is
 * corrected at the Population Office.
 */
export default function ChildHistoryModal({
  childId,
  onClose,
  onChanged,
}: {
  childId: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [history, setHistory] = useState<ChildHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ChildMeasurement | null>(null);

  const load = useCallback(() => {
    if (!childId) return;
    setLoading(true);
    healthApi.childHistory(childId)
      .then((r) => setHistory(r.data.data))
      .catch((err) => toast(errorMessage(err), "error"))
      .finally(() => setLoading(false));
  }, [childId]);

  useEffect(() => {
    setHistory(null);
    load();
  }, [load]);

  const changed = () => {
    load();
    onChanged();
  };

  const remove = async (id: number, date: string) => {
    if (!(await confirmAction({
      title: "Delete this record?",
      text: `The ${fmtDate(date, true)} record only. The child's other records stay.`,
      confirmText: "Yes, delete",
      danger: true,
    }))) return;
    try {
      const done = await healthApi.deleteChildHealth(id, { offline: { label: `Delete child health record — ${history?.child.name}` } });
      announceWrite(done, "Record deleted.");
      changed();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const h = history;

  return (
    <>
      <Modal open={childId !== null} onClose={onClose} title="Child Health & Nutrition Record" size="wide">
        {!h ? (
          <p className="py-10 text-center text-sm text-gray-400">{loading ? "Loading…" : "Record not found."}</p>
        ) : (
          <div className="space-y-5">
            <section className="rounded-2xl border border-gray p-4">
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Fact label="Child" value={`${h.child.name}${h.child.resident_number ? ` · ${h.child.resident_number}` : ""}`} />
                <Fact label="Birthdate" value={fmtDate(h.child.birthdate, true)} />
                <Fact label="Sex" value={h.child.sex ?? "Not recorded"} />
                <Fact label="Zone / Purok" value={h.child.zone_purok ?? "—"} />
                <Fact label="Address" value={h.child.address ?? "—"} wide />
                <Fact label="Mother" value={h.mother?.name ?? "Not recorded"} />
                <Fact label="Father" value={h.father?.name ?? "Not recorded"} />
                <Fact label="Father is current spouse/partner of mother" value={yesNo(h.father_is_current_spouse)} wide />
              </dl>
              <p className="mt-3 border-t border-gray/70 pt-3 text-xs text-gray-500">
                From the Population Office&apos;s register. A wrong name, birth date or parent is corrected there.
              </p>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-dark">Child Health History</h3>
                <button type="button" onClick={() => setAdding(true)} disabled={!h.mother}
                  title={h.mother ? undefined : "The register does not name this child's mother."}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">
                  <FiPlus className="h-3.5 w-3.5" aria-hidden="true" /> Add record
                </button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-gray">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Weight</th>
                      <th className="px-3 py-2">Height</th>
                      <th className="px-3 py-2">Nutritional Status</th>
                      <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray/70">
                    {h.records.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No records yet.</td></tr>
                    ) : h.records.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap px-3 py-2">{fmtDate(r.record_date)}</td>
                        <td className="px-3 py-2 tabular-nums">{measure(r.current_weight, "kg")}</td>
                        <td className="px-3 py-2 tabular-nums">{measure(r.current_height, "cm")}</td>
                        <td className="px-3 py-2">{r.nutritional_status ?? "Not recorded"}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1.5">
                            <RowAction label="Edit" icon={FiEdit2} onClick={() => setEditing(r)} />
                            <RowAction label="Delete" icon={FiTrash2} tone="danger" onClick={() => remove(r.id, r.record_date)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </Modal>

      <ChildRecordModal open={adding} onClose={() => setAdding(false)} onSaved={changed}
        forChild={h ? { child: h.child, mother: h.mother } : null} />
      <MeasurementModal record={editing} childName={h?.child.name ?? ""} onClose={() => setEditing(null)} onSaved={changed} />
    </>
  );
}

function Fact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="font-medium text-dark">{value}</dd>
    </div>
  );
}

interface Measures {
  weight: string;
  height: string;
  status: string;
}

/** Correcting one weighing — the same record, on the same day. No second one is made. */
function MeasurementModal({ record, childName, onClose, onSaved }: {
  record: ChildMeasurement | null;
  childName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Measures>({ weight: "", height: "", status: "" });
  const [saving, setSaving] = useState(false);
  const open = record !== null;

  const original = (r: ChildMeasurement | null): Measures => ({
    weight: r?.current_weight ? String(Number(r.current_weight)) : "",
    height: r?.current_height ? String(Number(r.current_height)) : "",
    status: r?.nutritional_status ?? "",
  });

  useEffect(() => {
    if (record) setValues(original(record));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  const draft = useModalDraft<Measures>(
    record ? `edit-child-health:${record.id}` : null,
    open,
    values,
    setValues,
    { blank: original(record), reset: () => setValues(original(record)), version: record?.version ?? null },
  );

  const set = (patch: Partial<Measures>) => setValues((was) => ({ ...was, ...patch }));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record || saving) return;
    setSaving(true);
    try {
      const saved = await healthApi.updateChildHealth(record.id, {
        current_weight: values.weight,
        current_height: values.height,
        nutritional_status: values.status,
      }, { offline: { label: `Child health record — ${childName}` } });
      draft.clear();
      announceWrite(saved, "Record updated.");
      onSaved();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Edit record — ${childName}`}>
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-gray-600">Recorded {fmtDate(record?.record_date ?? null, true)}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Weight (kg)" required>
            <input name="current_weight" type="number" step="0.01" min="0.3" max="80" required value={values.weight}
              onChange={(e) => set({ weight: e.target.value })} className={inputClasses} />
          </FormField>
          <FormField label="Height (cm)" required>
            <input name="current_height" type="number" step="0.1" min="20" max="200" required value={values.height}
              onChange={(e) => set({ height: e.target.value })} className={inputClasses} />
          </FormField>
        </div>
        <FormField label="Nutritional status" required>
          <select name="nutritional_status" value={values.status} required onChange={(e) => set({ status: e.target.value })} className={inputClasses}>
            <option value="">Choose…</option>
            {NUTRITIONAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </FormField>
        <DraftNotice draft={draft} />
        <button type="submit" disabled={saving} className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </Modal>
  );
}
