import { useEffect, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { confirmAction } from "../../../shared/lib/confirm";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import Modal from "../../../shared/ui/Modal";
import PageHeader from "../../../shared/ui/PageHeader";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import { populationApi } from "../api";
import { forgetZones, type Bhw, type Zone } from "../lib/useZones";

/**
 * Zones & BHWs — the Population Office's own list.
 *
 * The barangay's twenty-five zones used to be five hard-coded "Purok"
 * entries in the frontend, which meant the register could not record where
 * anybody actually lived and nobody could fix it without a developer. Zones
 * split — 18 into A and B, 21 into A, B and C — and when the next one does,
 * this is where it gets added.
 *
 * ASSIGNMENT IS MADE ON THE ZONE, never on the worker. A BHW covers several
 * zones and a zone has one BHW, so the link belongs on the zone; her areas
 * are simply the zones pointing at her, and the two can never disagree.
 */
export default function Zones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [bhws, setBhws] = useState<Bhw[]>([]);
  const [loading, setLoading] = useState(true);

  const [zoneForm, setZoneForm] = useState<{ id?: number; name: string; bhw_id: string; is_active: boolean } | null>(null);
  const [bhwForm, setBhwForm] = useState<{ id?: number; name: string; contact_number: string; is_active: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    populationApi.zones({ params: { include_inactive: 1 } })
      .then((r) => {
        setZones(r.data.data.zones ?? []);
        setBhws(r.data.data.bhws ?? []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  /* The dropdowns on every other form read a shared copy of this list, so a
     change here has to drop it or they keep offering the old names. */
  const reload = () => {
    forgetZones();
    load();
  };

  const saveZone = async () => {
    if (!zoneForm) return;
    setSaving(true);
    try {
      const body = {
        name: zoneForm.name.trim(),
        bhw_id: zoneForm.bhw_id === "" ? null : Number(zoneForm.bhw_id),
        is_active: zoneForm.is_active,
      };
      const r = zoneForm.id
        ? await populationApi.updateZone(zoneForm.id, body)
        : await populationApi.createZone(body);
      toast(r.data.message);
      setZoneForm(null);
      reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const saveBhw = async () => {
    if (!bhwForm) return;
    setSaving(true);
    try {
      const body = {
        name: bhwForm.name.trim(),
        contact_number: bhwForm.contact_number.trim() || null,
        is_active: bhwForm.is_active,
      };
      const r = bhwForm.id
        ? await populationApi.updateBhw(bhwForm.id, body)
        : await populationApi.createBhw(body);
      toast(r.data.message);
      setBhwForm(null);
      reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const removeZone = async (zone: Zone) => {
    if (!(await confirmAction({
      title: `Remove ${zone.name}?`,
      text: "Only a zone nobody is recorded in can be removed.",
      confirmText: "Yes, remove",
      danger: true,
    }))) return;
    try {
      const r = await populationApi.deleteZone(zone.id);
      toast(r.data.message);
      reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const removeBhw = async (bhw: Bhw) => {
    if (!(await confirmAction({
      title: `Remove ${bhw.name}?`,
      text: "Only a health worker who covers no zones can be removed.",
      confirmText: "Yes, remove",
      danger: true,
    }))) return;
    try {
      const r = await populationApi.deleteBhw(bhw.id);
      toast(r.data.message);
      reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  /* Her areas, read off the zones rather than stored twice. */
  const areasOf = (bhw: Bhw) =>
    zones.filter((z) => z.bhw_id === bhw.id).map((z) => z.name);

  const unassigned = zones.filter((z) => z.is_active && !z.bhw_id);

  return (
    <div>
      <PageHeader
        title="Zones & BHWs"
        subtitle="The barangay's zones, and the health worker covering each. Every form that asks where somebody lives reads this list."
      />

      {/*
        The gap, said plainly and at the top.

        A zone with nobody covering it is the one fact on this page somebody
        has to act on, and it would otherwise be a blank cell two-thirds of
        the way down a table of twenty-five rows.
      */}
      {unassigned.length > 0 && (
        <div className="mb-4 rounded-2xl border border-warning/40 bg-warning/5 px-4 py-3">
          <p className="text-sm font-semibold text-dark">
            {unassigned.length === 1 ? "One zone has" : `${unassigned.length} zones have`} no health worker
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            {unassigned.map((z) => z.name).join(", ")} — nobody is recorded as covering{" "}
            {unassigned.length === 1 ? "it" : "them"}. Assign someone, or leave it as it is if that
            is correct for now.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card
            title="Zones"
            action={
              <button
                type="button"
                onClick={() => setZoneForm({ name: "", bhw_id: "", is_active: true })}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                <FiPlus className="h-3.5 w-3.5" aria-hidden="true" />
                Add zone
              </button>
            }
          >
            <DataTable
              loading={loading}
              rows={zones}
              rowKey={(z: Zone) => z.id}
              columns={[
                {
                  header: "Zone",
                  render: (z: Zone) => (
                    <span className="font-medium text-dark">
                      {z.name}
                      {!z.is_active && (
                        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          Not in use
                        </span>
                      )}
                    </span>
                  ),
                },
                {
                  header: "Health worker",
                  render: (z: Zone) =>
                    z.bhw
                      ? z.bhw.name
                      : <span className="text-warning">Nobody assigned</span>,
                },
                {
                  header: "",
                  render: (z: Zone) => (
                    <span className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        aria-label={`Edit ${z.name}`}
                        onClick={() => setZoneForm({
                          id: z.id,
                          name: z.name,
                          bhw_id: z.bhw_id ? String(z.bhw_id) : "",
                          is_active: z.is_active,
                        })}
                        className="cursor-pointer rounded-full border border-gray p-1.5 text-gray-500 transition-colors hover:border-primary hover:text-primary"
                      >
                        <FiEdit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${z.name}`}
                        onClick={() => removeZone(z)}
                        className="cursor-pointer rounded-full border border-gray p-1.5 text-gray-500 transition-colors hover:border-danger hover:text-danger"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card
            title="Health workers"
            action={
              <button
                type="button"
                onClick={() => setBhwForm({ name: "", contact_number: "", is_active: true })}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                <FiPlus className="h-3.5 w-3.5" aria-hidden="true" />
                Add BHW
              </button>
            }
          >
            <ul className="flex flex-col gap-2.5">
              {bhws.length === 0 && !loading && (
                <li className="py-3 text-center text-sm text-gray-400">No health workers yet.</li>
              )}
              {bhws.map((bhw) => {
                const areas = areasOf(bhw);

                return (
                  <li key={bhw.id} className="rounded-xl border border-gray/70 px-3.5 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-dark">
                          {bhw.name}
                          {!bhw.is_active && (
                            <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                              Retired
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {areas.length > 0 ? areas.join(", ") : "No zones assigned"}
                        </p>
                        {bhw.contact_number && (
                          <p className="mt-0.5 text-xs text-gray-400">{bhw.contact_number}</p>
                        )}
                      </div>
                      <span className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          aria-label={`Edit ${bhw.name}`}
                          onClick={() => setBhwForm({
                            id: bhw.id,
                            name: bhw.name,
                            contact_number: bhw.contact_number ?? "",
                            is_active: bhw.is_active,
                          })}
                          className="cursor-pointer rounded-full border border-gray p-1.5 text-gray-500 transition-colors hover:border-primary hover:text-primary"
                        >
                          <FiEdit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${bhw.name}`}
                          onClick={() => removeBhw(bhw)}
                          className="cursor-pointer rounded-full border border-gray p-1.5 text-gray-500 transition-colors hover:border-danger hover:text-danger"
                        >
                          <FiTrash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <Modal
        open={zoneForm !== null}
        onClose={() => setZoneForm(null)}
        title={zoneForm?.id ? `Edit ${zoneForm.name}` : "Add a zone"}
      >
        {zoneForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); void saveZone(); }}
            className="flex flex-col gap-4"
          >
            <FormField label="Zone name" required hint="For example: Zone 22, or Zone 21D.">
              <input
                value={zoneForm.name}
                onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                required
                maxLength={40}
                className={inputClasses}
                placeholder="Zone 22"
              />
            </FormField>

            <FormField label="Health worker">
              <select
                value={zoneForm.bhw_id}
                onChange={(e) => setZoneForm({ ...zoneForm, bhw_id: e.target.value })}
                className={inputClasses}
              >
                <option value="">Nobody assigned</option>
                {bhws.filter((b) => b.is_active || String(b.id) === zoneForm.bhw_id).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </FormField>

            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-dark">
              <input
                type="checkbox"
                checked={zoneForm.is_active}
                onChange={(e) => setZoneForm({ ...zoneForm, is_active: e.target.checked })}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
              />
              <span>
                Offer this zone on forms
                <span className="mt-0.5 block text-xs text-gray-500">
                  Switch it off for a zone that no longer exists. Everybody already recorded in it
                  stays as they are — it simply stops being a choice.
                </span>
              </span>
            </label>

            <button
              type="submit"
              disabled={saving || zoneForm.name.trim() === ""}
              className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? "Saving…" : zoneForm.id ? "Save changes" : "Add zone"}
            </button>
          </form>
        )}
      </Modal>

      <Modal
        open={bhwForm !== null}
        onClose={() => setBhwForm(null)}
        title={bhwForm?.id ? `Edit ${bhwForm.name}` : "Add a health worker"}
      >
        {bhwForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); void saveBhw(); }}
            className="flex flex-col gap-4"
          >
            <FormField label="Full name" required>
              <input
                value={bhwForm.name}
                onChange={(e) => setBhwForm({ ...bhwForm, name: e.target.value })}
                required
                maxLength={120}
                className={inputClasses}
                placeholder="JUANA D. SANTOS"
              />
            </FormField>

            <FormField label="Contact number">
              <input
                value={bhwForm.contact_number}
                onChange={(e) => setBhwForm({ ...bhwForm, contact_number: e.target.value })}
                maxLength={20}
                className={inputClasses}
                placeholder="09XX XXX XXXX"
              />
            </FormField>

            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-dark">
              <input
                type="checkbox"
                checked={bhwForm.is_active}
                onChange={(e) => setBhwForm({ ...bhwForm, is_active: e.target.checked })}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
              />
              <span>
                Still working
                <span className="mt-0.5 block text-xs text-gray-500">
                  Switch this off when she leaves. Her name stays on the visits she already made,
                  and she stops being offered for new zones.
                </span>
              </span>
            </label>

            <p className="rounded-xl border border-gray/70 bg-secondary px-3 py-2 text-xs leading-relaxed text-gray-600">
              Her areas are set on the zone, not here — open a zone and choose her. That way one
              place decides who covers it.
            </p>

            <button
              type="submit"
              disabled={saving || bhwForm.name.trim() === ""}
              className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? "Saving…" : bhwForm.id ? "Save changes" : "Add health worker"}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
