import { useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "../../../shared/lib/api";
import { announceWrite } from "../../../shared/lib/announceWrite";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import DraftNotice from "../../../shared/ui/DraftNotice";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import Modal from "../../../shared/ui/Modal";
import type { Resident } from "../../../shared/types";
import ResidentPicker from "../../resident/components/ResidentPicker";
import { healthApi } from "../api";
import { fmtDate, manilaToday } from "../lib/records";
import type { MotherView, PrenatalLine, PrenatalSaved } from "../types";
import { ageBetween, NOT_ON_REGISTER } from "./PregnancyModals";

/**
 * A line of the prenatal register: Date, Zone, Name, Age, WT, BP, HT, LMP,
 * EDC, MOS, Contact #.
 *
 * 1. the mother is found — a woman on the Population Office's register
 * 2. her CURRENT pregnancy is found (or, when the staff tick it, started by
 *    this record)
 * 3. the record is saved to it; the server counts its visits again
 *
 * Her zone, age and contact on the line come from the register, set by the
 * server — shown here, never typed. The Visit # and "Prenatal Visits" are
 * counted, never typed. A woman not yet on the register is registered by
 * the Population Office first.
 */

interface Line {
  mother: Resident | null;
  startNew: boolean;
  date: string;
  weight: string;
  bp: string;
  height: string;
  lmp: string;
  edc: string;
  mos: string;
  remarks: string;
}

const blankLine = (): Line => ({
  mother: null, startNew: false, date: manilaToday(), weight: "", bp: "", height: "",
  lmp: "", edc: "", mos: "", remarks: "",
});

const fromRecord = (v: PrenatalLine): Line => ({
  mother: null,
  startNew: false,
  date: v.visit_date,
  weight: v.weight_kg ? String(Number(v.weight_kg)) : "",
  bp: v.blood_pressure ?? "",
  height: v.height_cm ? String(Number(v.height_cm)) : "",
  lmp: v.lmp ?? "",
  edc: v.edc ?? "",
  mos: v.months_of_pregnancy ?? "",
  remarks: v.complaint ?? "",
});

export default function PrenatalRecordModal({
  open,
  onClose,
  onSaved,
  view = null,
  editing = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (saved: PrenatalSaved | null) => void;
  /** From the mother's page: who she is and her pregnancies are already known. */
  view?: MotherView | null;
  /** Correcting a record: the record, and the pregnancy it is on. */
  editing?: { record: PrenatalLine; pregnancyId: number } | null;
}) {
  const [line, setLine] = useState<Line>(blankLine);
  const [found, setFound] = useState<MotherView | null>(null);
  const [looking, setLooking] = useState(false);
  const [moveTo, setMoveTo] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Line>) => setLine((was) => ({ ...was, ...patch }));

  const fresh = () => {
    if (editing) return fromRecord(editing.record);
    const m = view;
    const curr = m?.current ?? m?.selected ?? m?.pregnancies?.[0] ?? null;
    const latestHeight = m?.latest_height_cm
      ?? m?.visits?.find((v) => v.height_cm)?.height_cm
      ?? "";
    return {
      ...blankLine(),
      height: latestHeight ? String(Number(latestHeight)) : "",
      lmp: curr?.lmp ?? "",
      edc: curr?.expected_delivery_date ?? "",
    };
  };

  useEffect(() => {
    if (!open) return;
    setLine(fresh());
    setFound(null);
    setMoveTo(editing?.pregnancyId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const draft = useModalDraft<Line>(
    editing ? `edit-prenatal:${editing.record.id}` : view ? `add-prenatal:${view.mother.id}` : "add-prenatal",
    open,
    line,
    setLine,
    { blank: fresh(), reset: () => setLine(fresh()), version: editing?.record.version ?? null },
  );

  /* A mother from the register: who she is, and her pregnancies. */
  useEffect(() => {
    setFound(null);
    if (!line.mother) return;
    let alive = true;
    setLooking(true);
    healthApi.motherPregnancies(line.mother.id)
      .then((r) => alive && setFound(r.data.data))
      .catch((err) => alive && toast(errorMessage(err), "error"))
      .finally(() => alive && setLooking(false));

    return () => {
      alive = false;
    };
  }, [line.mother]);

  /* Auto-fill height, LMP, and EDC based on latest recorded data / maternal health enrollment */
  useEffect(() => {
    if (!open || editing) return;
    const m = view ?? found;
    if (!m) return;
    const curr = m.current ?? m.selected ?? m.pregnancies?.[0] ?? null;
    const latestHeight = m.latest_height_cm
      ?? m.visits?.find((v) => v.height_cm)?.height_cm
      ?? "";

    setLine((was) => ({
      ...was,
      height: was.height || (latestHeight ? String(Number(latestHeight)) : ""),
      lmp: was.lmp || curr?.lmp || "",
      edc: was.edc || curr?.expected_delivery_date || "",
    }));
  }, [open, editing, view, found]);

  const mother = view ?? found;
  const current = mother?.current ?? null;
  const needsStart = !editing && mother !== null && current === null;
  const ready = Boolean(editing || (mother && (current || line.startNew)));
  const nextVisit = current ? current.prenatal_visits + 1 : 1;
  const age = mother?.mother.birthdate ? ageBetween(mother.mother.birthdate, line.date) : null;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready || saving) return;
    const record = {
      visit_date: line.date,
      weight_kg: line.weight || null,
      blood_pressure: line.bp.trim() || null,
      height_cm: line.height || null,
      lmp: line.lmp || null,
      edc: line.edc || null,
      months_of_pregnancy: line.mos.trim() || null,
      complaint: line.remarks.trim() || null,
    };
    const name = mother?.mother.name ?? "";

    if (!(await confirmAction({
      title: editing ? "Save these changes?" : "Save this prenatal record?",
      text: editing ? name || "Prenatal record" : `${name} — ${needsStart ? "starts a new pregnancy, " : ""}Prenatal Visit #${nextVisit}`,
      confirmText: "Yes, save",
    }))) return;

    setSaving(true);
    try {
      const saved = editing
        ? await healthApi.updatePrenatal(editing.record.id, { ...record, pregnancy_id: moveTo ?? editing.pregnancyId },
          { offline: { label: `Prenatal record — ${name || "edit"}` } })
        : await healthApi.recordPrenatal({
          ...record,
          ...(current ? { pregnancy_id: current.id } : { mother_id: mother?.mother.id, start_pregnancy: true }),
        }, { offline: { label: `Prenatal record — ${name}` } });
      draft.clear();

      const result = (saved.data?.data ?? null) as PrenatalSaved | null;
      if (result) {
        toast(`${editing ? "Prenatal record updated" : "Prenatal record saved"} — Prenatal Visits: ${result.pregnancy.current_prenatal_visits}`);
      } else {
        announceWrite(saved, "Prenatal record saved.");
      }
      onSaved(result);
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const pregnanciesToMoveTo = editing ? (view?.pregnancies ?? []) : [];

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit prenatal record" : "Add prenatal record"} size="wide">
      <form onSubmit={save} className="space-y-5">
        {/* ---------------- The mother ---------------- */}
        {!editing && !view && (
          <FormField label="Mother" required plain>
            <ResidentPicker
              value={line.mother}
              onChange={(r) => set({ mother: r, startNew: false })}
              gender="Female"
              placeholder="Search a Female Resident by Name or Resident Number…"
              notFound={NOT_ON_REGISTER}
            />
          </FormField>
        )}
        {looking && <p className="text-xs text-gray-400">Finding her current pregnancy…</p>}

        {mother && (
          <dl className="grid gap-x-6 gap-y-2 rounded-xl bg-secondary/60 p-3 text-sm sm:grid-cols-4">
            <Fact label="Mother" value={mother.mother.name} />
            <Fact label="Zone / Purok" value={mother.mother.zone_purok || "—"} />
            <Fact label={editing ? "Age" : "Age on this date"} value={age != null ? String(age) : "No birth date on the register"} />
            <Fact label="Contact Number" value={mother.mother.contact_number || "—"} />
            <p className="text-xs text-gray-400 sm:col-span-4">
              From the Population Office&apos;s register, and written on the record as they are on the day. Corrections are made there.
            </p>
          </dl>
        )}

        {/* ---------------- Her current pregnancy ---------------- */}
        {!editing && mother && (
          current ? (
            <div className="grid gap-3 rounded-2xl border border-primary/30 bg-primary/[0.04] p-4 sm:grid-cols-4">
              <Stat label="Current pregnancy" value={`#${current.pregnancy_number} · Active`} />
              <Stat label="Prenatal Visits" value={String(current.prenatal_visits)} big />
              <Stat label="Last prenatal record" value={fmtDate(current.last_visit_date ?? null)} />
              <Stat label="This record will be" value={`Visit #${nextVisit}`} big />
            </div>
          ) : (
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-warning/40 bg-warning/5 p-4">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={line.startNew}
                onChange={(e) => set({ startNew: e.target.checked })} />
              <span className="text-sm text-dark">
                {mother.mother.name} has no current pregnancy. This record starts her new pregnancy —
                Pregnancy #{mother.next_pregnancy_number}, Prenatal Visit #1.
                <span className="block text-xs text-gray-500">Her earlier pregnancies and their prenatal records stay as they are.</span>
              </span>
            </label>
          )
        )}

        {editing && pregnanciesToMoveTo.length > 1 && (
          <FormField label="Pregnancy" hint="Only to correct a record put on the wrong pregnancy of the same mother.">
            <select value={moveTo ?? ""} onChange={(e) => setMoveTo(Number(e.target.value))} className={inputClasses}>
              {pregnanciesToMoveTo.map((p) => (
                <option key={p.id} value={p.id}>Pregnancy #{p.pregnancy_number} — {p.status} ({p.prenatal_visits} records)</option>
              ))}
            </select>
          </FormField>
        )}

        {/* ---------------- The line itself ---------------- */}
        {ready && (
          <fieldset className="space-y-3 rounded-2xl border border-gray p-4">
            <legend className="px-1 text-sm font-semibold text-dark">Prenatal Record</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Date" required>
                <input name="visit_date" type="date" value={line.date} required max={manilaToday()} onChange={(e) => set({ date: e.target.value })} className={inputClasses} />
              </FormField>
              <FormField label="WT (kg)">
                <input name="weight_kg" type="number" step="0.01" min="20" max="200" value={line.weight} onChange={(e) => set({ weight: e.target.value })} className={inputClasses} />
              </FormField>
              <FormField label="BP" hint="e.g. 110/70">
                <input name="blood_pressure" value={line.bp} maxLength={20} pattern="\d{2,3}\s*/\s*\d{2,3}" title="Systolic/diastolic, e.g. 110/70"
                  onChange={(e) => set({ bp: e.target.value })} className={inputClasses} />
              </FormField>
              <FormField label="HT (cm)">
                <input name="height_cm" type="number" step="0.1" min="100" max="220" value={line.height} onChange={(e) => set({ height: e.target.value })} className={inputClasses} />
              </FormField>
              <FormField label="LMP">
                <input name="lmp" type="date" value={line.lmp} max={line.date} onChange={(e) => set({ lmp: e.target.value })} className={inputClasses} />
              </FormField>
              <FormField label="EDC">
                <input name="edc" type="date" value={line.edc} min={line.date} onChange={(e) => set({ edc: e.target.value })} className={inputClasses} />
              </FormField>
              <FormField label="MOS" hint="As written, e.g. 8 mos">
                <input name="months_of_pregnancy" value={line.mos} maxLength={20} onChange={(e) => set({ mos: e.target.value })} className={inputClasses} />
              </FormField>
              <div className="sm:col-span-2">
                <FormField label="Remarks">
                  <input name="complaint" value={line.remarks} maxLength={2000} onChange={(e) => set({ remarks: e.target.value })} className={inputClasses} />
                </FormField>
              </div>
            </div>
          </fieldset>
        )}

        <DraftNotice draft={draft} />

        <button type="submit" disabled={!ready || saving}
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "Saving…" : editing ? "Save changes" : "Save prenatal record"}
        </button>
      </form>
    </Modal>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="font-medium text-dark">{value}</dd>
    </div>
  );
}

function Stat({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={big ? "text-2xl font-bold tabular-nums text-primary" : "text-sm font-semibold text-dark"}>{value}</p>
    </div>
  );
}
