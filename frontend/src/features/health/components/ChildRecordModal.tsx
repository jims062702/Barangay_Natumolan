import { useEffect, useMemo, useState, type FormEvent } from "react";
import { errorMessage } from "../../../shared/lib/api";
import { announceWrite } from "../../../shared/lib/announceWrite";
import { toast } from "../../../shared/lib/toast";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import DraftNotice from "../../../shared/ui/DraftNotice";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import Modal from "../../../shared/ui/Modal";
import type { Resident } from "../../../shared/types";
import ResidentPicker from "../../resident/components/ResidentPicker";
import { healthApi } from "../api";
import { fmtDate, manilaToday, NUTRITIONAL_STATUSES } from "../lib/records";
import type { MotherChildren, RegisterPerson } from "../types";

/**
 * A new Child Health & Nutrition record — the MOTHER first.
 *
 *   1. find the mother (women only) on the Population Office's register
 *   2. her details and the fathers of her children appear, read from the
 *      register — nothing about who anybody is is typed here
 *   3. choose the child, or several (twins), from the children the register
 *      lists as hers
 *   4. each child's weighing: weight, height, nutritional status
 *
 * The date is the day it is recorded, set by the server. A child who is not
 * on the register — or not linked to the mother — is registered by the
 * Population Office first; there is no way to add one here.
 *
 * Every chosen child gets a record of their own.
 */

interface Entry {
  weight: string;
  height: string;
  status: string;
}

interface Draft {
  mother: Resident | null;
  entries: Record<string, Entry>;
}

const BLANK: Draft = { mother: null, entries: {} };
const NO_REGISTER = "Please coordinate with the Population Office to register or update the resident before creating a health record.";

/** A resident as the picker shows a choice, from what the register sent us. */
const asPicked = (p: RegisterPerson): Resident =>
  ({ id: p.id, first_name: p.name, last_name: "", resident_number: p.resident_number ?? undefined, birthdate: p.birthdate,
    zone_purok: p.zone_purok, gender: p.sex }) as unknown as Resident;

export default function ChildRecordModal({
  open,
  onClose,
  onSaved,
  forChild = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Adding to one child's history: their mother is already known, and they are chosen. */
  forChild?: { child: RegisterPerson; mother: RegisterPerson | null } | null;
}) {
  const [mother, setMother] = useState<Resident | null>(null);
  const [data, setData] = useState<MotherChildren | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookError, setLookError] = useState("");
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [saving, setSaving] = useState(false);

  /* Opened afresh every time: a form that opens holding the last child's
     weight is how one child's reading lands on another. */
  useEffect(() => {
    if (!open) return;
    setMother(forChild?.mother ? asPicked(forChild.mother) : null);
    setEntries(forChild ? { [forChild.child.id]: { weight: "", height: "", status: "" } } : {});
    setLookError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const draft = useModalDraft<Draft>(
    forChild ? `add-child-health:${forChild.child.id}` : "add-child-health",
    open,
    { mother, entries },
    (kept) => {
      if (!forChild) setMother(kept.mother);
      setEntries(kept.entries ?? {});
    },
    {
      blank: forChild
        ? { mother: forChild.mother ? asPicked(forChild.mother) : null, entries: { [forChild.child.id]: { weight: "", height: "", status: "" } } }
        : BLANK,
      reset: () => {
        if (!forChild) setMother(null);
        setEntries(forChild ? { [forChild.child.id]: { weight: "", height: "", status: "" } } : {});
      },
    },
  );

  /*
   * The mother's children, from the register. A new mother clears the old
   * list at once — her children are never shown under another mother's
   * name — and keeps only what was typed for children who are hers.
   */
  useEffect(() => {
    setData(null);
    setLookError("");
    if (!mother) {
      setEntries({});

      return;
    }
    let alive = true;
    setLooking(true);
    healthApi.motherChildren(mother.id)
      .then((r) => {
        if (!alive) return;
        const found = r.data.data as MotherChildren;
        setData(found);
        const mine = new Set(found.children.map((c) => String(c.id)));
        setEntries((was) => Object.fromEntries(Object.entries(was).filter(([id]) => mine.has(id))));
      })
      .catch((err) => alive && setLookError(errorMessage(err)))
      .finally(() => alive && setLooking(false));

    return () => {
      alive = false;
    };
  }, [mother]);

  /* The fathers of her children, as the register names them — grouped, so
     twins with one father show him once. */
  const fathers = useMemo(() => {
    const byId = new Map<number, { father: RegisterPerson; of: string[] }>();
    for (const c of data?.children ?? []) {
      if (!c.father) continue;
      const known = byId.get(c.father.id);
      if (known) known.of.push(c.name);
      else byId.set(c.father.id, { father: c.father, of: [c.name] });
    }

    return [...byId.values()];
  }, [data]);

  const chosen = (data?.children ?? []).filter((c) => entries[c.id] !== undefined);
  const toggle = (id: number) => setEntries((was) => {
    const next = { ...was };
    if (next[id]) delete next[id];
    else next[id] = { weight: "", height: "", status: "" };

    return next;
  });
  const setEntry = (id: number, patch: Partial<Entry>) =>
    setEntries((was) => ({ ...was, [id]: { ...was[id], ...patch } }));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mother || chosen.length === 0 || saving) return;

    setSaving(true);
    try {
      const saved = await healthApi.recordChildHealth({
        mother_id: mother.id,
        /* The day it was recorded — for a record kept on the device until
           the line returns. The server sets it, and never later than today. */
        recorded_on: manilaToday(),
        records: chosen.map((c) => ({
          child_id: c.id,
          current_weight: entries[c.id].weight,
          current_height: entries[c.id].height,
          nutritional_status: entries[c.id].status,
        })),
      }, { offline: { label: `Child health — ${chosen.map((c) => c.name).join(", ")}` } });
      draft.clear();
      announceWrite(saved, chosen.length === 1 ? "Child health record saved." : `${chosen.length} child health records saved.`);
      onSaved();
      onClose();
    } catch (err) {
      /* The draft and every value stay, for a retry. */
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={forChild ? `Add record — ${forChild.child.name}` : "Record child health"} size="wide">
      <form onSubmit={save} className="space-y-5">
        {/* ---------------- The mother ---------------- */}
        <fieldset className="space-y-3 rounded-2xl border border-gray p-4">
          <legend className="px-1 text-sm font-semibold text-dark">Mother Information</legend>
          {forChild ? (
            forChild.mother ? null : (
              <p className="text-sm text-warning">
                The register does not name this child&apos;s mother. {NO_REGISTER}
              </p>
            )
          ) : (
            <FormField label="Mother" required plain>
              <ResidentPicker
                value={mother}
                onChange={setMother}
                gender="Female"
                minAge={5}
                maxAge={51}
                placeholder="Search a Female Resident (5 to below 51 yrs) by Name or Resident Number…"
                notFound={NO_REGISTER}
              />
            </FormField>
          )}
          {looking && <p className="text-xs text-gray-400">Reading the register…</p>}
          {lookError && <p className="text-sm text-danger">{lookError}</p>}
          {data && (
            <dl className="grid gap-x-6 gap-y-2 rounded-xl bg-secondary/60 p-3 text-sm sm:grid-cols-3">
              <Fact label="Mother" value={data.mother.name} />
              <Fact label="Mother's address" value={data.mother.address || data.mother.zone_purok || "Not recorded"} />
              <Fact label="Mother's Contact Number" value={data.mother.contact_number || "Not recorded"} />
            </dl>
          )}
        </fieldset>

        {data && (
          <>
            {/* ---------------- The fathers ---------------- */}
            <fieldset className="space-y-2 rounded-2xl border border-gray p-4">
              <legend className="px-1 text-sm font-semibold text-dark">Father Information</legend>
              {fathers.length === 0 ? (
                <p className="text-sm text-gray-500">Father information is not available in the Population record.</p>
              ) : (
                <ul className="space-y-2">
                  {fathers.map(({ father, of }) => (
                    <li key={father.id} className="rounded-xl bg-secondary/60 p-3 text-sm">
                      <p className="font-semibold text-dark">{father.name}</p>
                      <p className="text-gray-600">
                        {[father.address || father.zone_purok, father.contact_number].filter(Boolean).join(" · ") || "No address or contact on the register"}
                      </p>
                      {(data.children.length > 1 || of.length > 1) && (
                        <p className="text-xs text-gray-500">Father of {of.join(", ")}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-gray-400">From the Population Office&apos;s records. Corrections are made there.</p>
            </fieldset>

            {/* ---------------- The children ---------------- */}
            <fieldset className="space-y-2 rounded-2xl border border-gray p-4">
              <legend className="px-1 text-sm font-semibold text-dark">Children — choose one or more</legend>
              {data.children.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No children are currently linked to this mother in the Population records. Please coordinate with the
                  Population Office to register the child and establish the parent relationship.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {data.children.map((c) => (
                    <li key={c.id}>
                      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors ${
                        entries[c.id] ? "border-primary bg-primary/5" : "border-gray hover:border-primary/40"}`}>
                        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={entries[c.id] !== undefined}
                          onChange={() => toggle(c.id)} aria-label={`Record ${c.name}`} disabled={!!forChild} />
                        <span className="min-w-0">
                          <span className="block font-semibold text-dark">{c.name}</span>
                          <span className="block text-xs text-gray-600">
                            Born {fmtDate(c.birthdate)} · {c.sex ?? "Sex not recorded"}{c.age !== null ? ` · ${c.age} yr${c.age === 1 ? "" : "s"}` : ""}
                          </span>
                          <span className="block text-xs text-gray-500">
                            Father: {c.father?.name ?? "not recorded"}
                            {c.records > 0 ? ` · ${c.records} earlier record${c.records === 1 ? "" : "s"}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          </>
        )}

        {/* ---------------- The weighing, per child ---------------- */}
        {chosen.length > 0 && (
          <fieldset className="space-y-3 rounded-2xl border border-gray p-4">
            <legend className="px-1 text-sm font-semibold text-dark">Health Record</legend>
            <p className="text-sm text-gray-600">
              Record date: <span className="font-semibold text-dark">{fmtDate(manilaToday(), true)}</span>
              <span className="text-xs text-gray-400"> — the day it is recorded</span>
            </p>
            {chosen.map((c) => (
              <div key={c.id} className="rounded-xl bg-secondary/40 p-3">
                <p className="mb-2 text-sm font-semibold text-dark">{c.name}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField label="Nutritional status" required>
                    <select name={`status-${c.id}`} value={entries[c.id].status} required
                      onChange={(e) => setEntry(c.id, { status: e.target.value })} className={inputClasses}>
                      <option value="">Choose…</option>
                      {NUTRITIONAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Weight (kg)" required>
                    <input name={`weight-${c.id}`} type="number" step="0.01" min="0.3" max="80" required value={entries[c.id].weight}
                      onChange={(e) => setEntry(c.id, { weight: e.target.value })} className={inputClasses} />
                  </FormField>
                  <FormField label="Height (cm)" required>
                    <input name={`height-${c.id}`} type="number" step="0.1" min="20" max="200" required value={entries[c.id].height}
                      onChange={(e) => setEntry(c.id, { height: e.target.value })} className={inputClasses} />
                  </FormField>
                </div>
              </div>
            ))}
          </fieldset>
        )}

        <DraftNotice draft={draft} />

        <button
          type="submit"
          disabled={!mother || chosen.length === 0 || saving}
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : chosen.length > 1 ? `Save ${chosen.length} records` : "Save record"}
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
