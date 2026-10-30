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
import type { MotherView, PregnancyRow } from "../types";

export const NOT_ON_REGISTER = "Please coordinate with the Population Office to register or update the resident before creating a health record.";

/**
 * Who she is, as the register has her — read only. The health station never
 * types a mother's age, zone, address or contact; a wrong one is corrected
 * at the Population Office.
 */
export function MotherFacts({ mother, ageOnDay }: { mother: MotherView["mother"]; ageOnDay?: number | null }) {
  const age = ageOnDay ?? mother.age;

  return (
    <dl className="grid gap-x-6 gap-y-2 rounded-xl bg-secondary/60 p-3 text-sm sm:grid-cols-2">
      <Fact label="Mother" value={`${mother.name}${mother.resident_number ? ` · ${mother.resident_number}` : ""}`} />
      <Fact label="Age" value={age != null ? String(age) : "No birth date on the register"} />
      <Fact label="Zone / Purok" value={mother.zone_purok || "—"} />
      <Fact label="Contact Number" value={mother.contact_number || "—"} />
      <Fact label="Address" value={mother.address || "—"} wide />
      <p className="text-xs text-gray-400 sm:col-span-2">From the Population Office&apos;s register. Corrections are made there.</p>
    </dl>
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

interface PregnancyDraft {
  mother: Resident | null;
  registered: string;
  lmp: string;
  edc: string;
  notes: string;
  referred: boolean;
  referralReason: string;
}

/**
 * Registering a pregnancy — or correcting one.
 *
 * The mother is a woman on the Population Office's register, searched among
 * women only (and checked again by the server). Her age, zone, contact and
 * address are shown from the register, not asked for. There is no visit
 * count to type: it is counted from her prenatal records. And no status: a
 * pregnancy is registered current, and ended with "Complete pregnancy".
 */
export function PregnancyFormModal({
  open,
  onClose,
  onSaved,
  editing = null,
  mother: fixedMother = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (view: MotherView | null) => void;
  /** Correcting a pregnancy already registered. */
  editing?: { pregnancy: PregnancyRow; mother: MotherView["mother"] } | null;
  /** Registering a new pregnancy for the mother whose page this is. */
  mother?: MotherView["mother"] | null;
}) {
  const known = editing?.mother ?? fixedMother;
  const fresh = (): PregnancyDraft => {
    const p = editing?.pregnancy;

    return {
      mother: null,
      registered: p?.pregnancy_registration_date ?? manilaToday(),
      lmp: p?.lmp ?? "",
      edc: p?.expected_delivery_date ?? "",
      notes: p?.risk_indicators ?? "",
      referred: Boolean(p?.referral_to_hospital),
      referralReason: p?.referral_reason ?? "",
    };
  };
  const [form, setForm] = useState<PregnancyDraft>(fresh);
  const [chosen, setChosen] = useState<MotherView | null>(null);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<PregnancyDraft>) => setForm((was) => ({ ...was, ...patch }));

  useEffect(() => {
    if (!open) return;
    setForm(fresh());
    setChosen(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const draft = useModalDraft<PregnancyDraft>(
    editing ? `edit-pregnancy:${editing.pregnancy.id}` : fixedMother ? `register-pregnancy:${fixedMother.id}` : "register-pregnancy",
    open,
    form,
    setForm,
    { blank: fresh(), reset: () => { setForm(fresh()); setChosen(null); }, version: editing?.pregnancy.version ?? null },
  );

  /* A mother from the register: who she is, and whether she already has a
     current pregnancy — which would be refused. */
  useEffect(() => {
    setChosen(null);
    if (!form.mother) return;
    let alive = true;
    setLooking(true);
    healthApi.motherPregnancies(form.mother.id)
      .then((r) => alive && setChosen(r.data.data))
      .catch((err) => alive && toast(errorMessage(err), "error"))
      .finally(() => alive && setLooking(false));

    return () => {
      alive = false;
    };
  }, [form.mother]);

  const mother = known ?? chosen?.mother ?? null;
  const alreadyCurrent = !editing && (chosen?.current ?? null);
  const ready = Boolean(editing || fixedMother || (chosen && !alreadyCurrent));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready || saving) return;
    if (!(await confirmAction({
      title: editing ? "Save these changes?" : "Register this pregnancy?",
      text: mother?.name,
      confirmText: editing ? "Yes, save" : "Yes, register",
    }))) return;

    const body = {
      pregnancy_registration_date: form.registered,
      lmp: form.lmp || null,
      expected_delivery_date: form.edc || null,
      risk_indicators: form.notes.trim() || null,
      referral_to_hospital: form.referred,
      referral_reason: form.referred ? form.referralReason.trim() || null : null,
    };

    setSaving(true);
    try {
      const saved = editing
        ? await healthApi.updatePregnancy(editing.pregnancy.id, body, { offline: { label: `Maternal record — ${mother?.name}` } })
        : await healthApi.recordMaternalHealth({ ...body, mother_id: mother?.id }, { offline: { label: `Pregnancy — ${mother?.name}` } });
      draft.clear();
      announceWrite(saved, editing ? "Maternal record updated." : "Pregnancy registered.");
      onSaved((saved.data?.data as MotherView | null) ?? null);
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const ageOnDay = mother?.birthdate ? ageBetween(mother.birthdate, form.registered) : null;

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit maternal record" : "Register a pregnancy"} size="wide">
      <form onSubmit={save} className="space-y-5">
        {!known && (
          <FormField label="Mother" required plain>
            <ResidentPicker
              value={form.mother}
              onChange={(r) => set({ mother: r })}
              gender="Female"
              minAge={5}
              maxAge={51}
              placeholder="Search a Female Resident (5 to below 51 yrs) by Name or Resident Number…"
              notFound={NOT_ON_REGISTER}
            />
          </FormField>
        )}
        {looking && <p className="text-xs text-gray-400">Reading the register…</p>}
        {mother && <MotherFacts mother={mother} ageOnDay={ageOnDay} />}
        {alreadyCurrent && (
          <p role="alert" className="rounded-xl bg-warning/10 p-3 text-sm text-dark">
            {mother?.name} already has a current pregnancy — Pregnancy #{alreadyCurrent.pregnancy_number}, registered{" "}
            {fmtDate(alreadyCurrent.pregnancy_registration_date)}. Complete it before registering a new one.
          </p>
        )}

        {ready && (
          <fieldset className="space-y-3 rounded-2xl border border-gray p-4">
            <legend className="px-1 text-sm font-semibold text-dark">Pregnancy</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Date registered" required>
                <input name="pregnancy_registration_date" type="date" value={form.registered} required max={manilaToday()}
                  onChange={(e) => set({ registered: e.target.value })} className={inputClasses} />
              </FormField>
              <FormField label="LMP">
                <input name="lmp" type="date" value={form.lmp} max={form.registered} onChange={(e) => set({ lmp: e.target.value })} className={inputClasses} />
              </FormField>
              <FormField label="EDC">
                <input name="expected_delivery_date" type="date" value={form.edc} min={form.lmp || undefined}
                  onChange={(e) => set({ edc: e.target.value })} className={inputClasses} />
              </FormField>
            </div>
            <FormField label="Remarks" hint="As written by the midwife. Nothing is concluded from it.">
              <textarea name="risk_indicators" rows={2} value={form.notes} maxLength={2000}
                onChange={(e) => set({ notes: e.target.value })} className={inputClasses} />
            </FormField>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-dark">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={form.referred}
                onChange={(e) => set({ referred: e.target.checked })} />
              Referred to a hospital
            </label>
            {form.referred && (
              <FormField label="Referral reason">
                <input name="referral_reason" value={form.referralReason} maxLength={2000}
                  onChange={(e) => set({ referralReason: e.target.value })} className={inputClasses} />
              </FormField>
            )}
          </fieldset>
        )}

        <DraftNotice draft={draft} />

        <button type="submit" disabled={!ready || saving}
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "Saving…" : editing ? "Save changes" : "Register pregnancy"}
        </button>
      </form>
    </Modal>
  );
}

/** Whole years from one calendar date to another. */
export function ageBetween(birth: string, on: string): number | null {
  const [by, bm, bd] = birth.slice(0, 10).split("-").map(Number);
  const [y, m, d] = on.slice(0, 10).split("-").map(Number);
  if (!by || !y) return null;
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;

  return age >= 0 ? age : null;
}

interface CompletionDraft {
  status: "Delivered" | "Closed";
  delivered: string;
  note: string;
}

const BLANK_COMPLETION: CompletionDraft = { status: "Delivered", delivered: "", note: "" };

/**
 * Completing the current pregnancy — Delivered on a date, or Closed with the
 * staff's own reason. Its prenatal records stay with it; her current count
 * becomes 0 until her next pregnancy is registered.
 */
export function CompletePregnancyModal({
  pregnancy,
  motherName,
  onClose,
  onSaved,
}: {
  pregnancy: PregnancyRow | null;
  motherName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CompletionDraft>(BLANK_COMPLETION);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<CompletionDraft>) => setForm((was) => ({ ...was, ...patch }));

  useEffect(() => {
    if (pregnancy) setForm(BLANK_COMPLETION);
  }, [pregnancy]);

  const draft = useModalDraft<CompletionDraft>(
    pregnancy ? `complete-pregnancy:${pregnancy.id}` : null,
    pregnancy !== null,
    form,
    setForm,
    { blank: BLANK_COMPLETION, reset: () => setForm(BLANK_COMPLETION) },
  );

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pregnancy || saving) return;
    if (!(await confirmAction({
      title: "Complete this pregnancy?",
      text: `${motherName} — Pregnancy #${pregnancy.pregnancy_number}. Its ${pregnancy.prenatal_visits} prenatal ${pregnancy.prenatal_visits === 1 ? "record stays" : "records stay"} with it, and her current Prenatal Visits becomes 0.`,
      confirmText: "Yes, complete",
    }))) return;
    setSaving(true);
    try {
      const saved = await healthApi.completePregnancy(pregnancy.id, {
        status: form.status,
        actual_delivery_date: form.status === "Delivered" ? form.delivered : null,
        closure_note: form.status === "Closed" ? form.note.trim() : null,
      }, { offline: { label: `Complete pregnancy — ${motherName}` } });
      draft.clear();
      announceWrite(saved, "Pregnancy completed.");
      onSaved();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={pregnancy !== null} onClose={onClose} title="Complete pregnancy">
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-gray-600">
          {motherName} · Pregnancy #{pregnancy?.pregnancy_number} · registered {fmtDate(pregnancy?.pregnancy_registration_date ?? null)}
        </p>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-dark">How was it completed?</legend>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="radio" name="status" className="accent-primary" checked={form.status === "Delivered"} onChange={() => set({ status: "Delivered" })} />
            Delivered
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="radio" name="status" className="accent-primary" checked={form.status === "Closed"} onChange={() => set({ status: "Closed" })} />
            Closed for another reason
          </label>
        </fieldset>
        {form.status === "Delivered" ? (
          <FormField label="Delivery date" required>
            <input name="actual_delivery_date" type="date" value={form.delivered} required max={manilaToday()}
              min={pregnancy?.pregnancy_registration_date} onChange={(e) => set({ delivered: e.target.value })} className={inputClasses} />
          </FormField>
        ) : (
          <FormField label="Reason" required hint="In the staff's own words — for example, moved to another barangay.">
            <input name="closure_note" value={form.note} required maxLength={255} onChange={(e) => set({ note: e.target.value })} className={inputClasses} />
          </FormField>
        )}
        <DraftNotice draft={draft} />
        <button type="submit" disabled={saving} className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
          Complete pregnancy
        </button>
      </form>
    </Modal>
  );
}
