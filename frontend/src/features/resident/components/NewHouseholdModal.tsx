import { useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "../../../shared/lib/api";
import { confirmAction } from "../../../shared/lib/confirm";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import DraftNotice from "../../../shared/ui/DraftNotice";
import Modal from "../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import type { Household } from "../../../shared/types";
import { populationApi } from "../../population/api";
import { useZoneNames } from "../../population/lib/useZones";

/**
 * Registers a household without leaving the form that needed one.
 *
 * Shared by Register Resident and the Add parent / child / spouse forms —
 * the second is the reason it exists: a parent who has moved into their own
 * house needs that house recorded in the same breath, and sending the clerk
 * off to another page to do it is how a family ends up half-linked.
 */

const INITIAL = { household_number: "", zone_purok: "", street_address: "", house_type: "" };

interface Props {
  open: boolean;
  onClose: () => void;
  /** The new household, already selected by the caller's picker. */
  onCreated: (household: Household) => void;
  /** Pre-fills the purok from whatever the form already knows. */
  defaultPurok?: string;
}

export default function NewHouseholdModal({ open, onClose, onCreated, defaultPurok }: Props) {
  /* The barangay's own zones, kept by the Health Station. */
  const zones = useZoneNames();
  const [form, setForm] = useState(INITIAL);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...INITIAL, zone_purok: defaultPurok ?? "" });
    setError("");
  }, [open, defaultPurok]);

  const starting = { ...INITIAL, zone_purok: defaultPurok ?? "" };
  const draft = useModalDraft("new-household", open, form, (kept) => setForm({ ...starting, ...kept }), {
    blank: starting,
    reset: () => setForm(starting),
  });

  const set = (key: keyof typeof INITIAL) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(await confirmAction({ title: "Register this household?", confirmText: "Yes, register" }))) return;
    setSaving(true);
    setError("");
    try {
      const response = await populationApi.createHousehold(form);
      draft.clear();
      onCreated(response.data.data);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Register Household">
      {error && (
        <p className="mb-4 rounded-xl bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger">{error}</p>
      )}
      <form onSubmit={save} className="space-y-4">
        <FormField label="Household number" required>
          <input value={form.household_number} onChange={set("household_number")} required className={inputClasses} placeholder="e.g. HH-2026-0012" />
        </FormField>
        <FormField label="Zone / Purok" required>
          <select value={form.zone_purok} onChange={set("zone_purok")} required className={inputClasses}>
            <option value="">Select…</option>
            {/* The barangay's own list — see useZones. */}
            {zones.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Street address" required>
          <input value={form.street_address} onChange={set("street_address")} required className={inputClasses} />
        </FormField>
        <FormField label="House type">
          <input value={form.house_type} onChange={set("house_type")} className={inputClasses} placeholder="e.g. Concrete, Semi-concrete" />
        </FormField>
        <DraftNotice draft={draft} />
        <button
          type="submit"
          disabled={saving}
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : "Register household & select it"}
        </button>
      </form>
    </Modal>
  );
}
