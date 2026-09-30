import { useEffect, useState, type FormEvent } from "react";
import { FiEdit2, FiEye } from "react-icons/fi";
import { personName } from "../../../shared/lib/names";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { confirmAction } from "../../../shared/lib/confirm";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import DraftNotice from "../../../shared/ui/DraftNotice";
import Modal from "../../../shared/ui/Modal";
import { ResidentIdRoster } from "../../resident/components/ResidentIdRoster";
import PageHeader from "../../../shared/ui/PageHeader";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import type { Household, Resident } from "../../../shared/types";
import { ageFromBirthdate } from "../../resident/components/ResidentFormFields";
import ResidentPicker from "../../resident/components/ResidentPicker";
import { populationApi } from "../api";
import { useZoneNames } from "../lib/useZones";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";


// @frezieh palambing ko dol

interface HouseholdFields {
  number: string;
  zone: string;
  address: string;
  houseType: string;
  head: Resident | null;
}

export default function HouseholdList() {
  const [rows, setRows] = useState<Household[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  // So the footer can say WHICH rows are on screen, not only the page.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();

  // One modal for both add and edit — editingId null = adding.
  const [modalOpen, setModalOpen] = useState(false);
  /** The household whose members are being read, if any. */
  const [viewing, setViewing] = useState<Household | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [number, setNumber] = useState("");
  /* The barangay's own zones, kept by the Health Station. */
  const zones = useZoneNames();
  const [zone, setZone] = useState("");
  const [address, setAddress] = useState("");
  const [houseType, setHouseType] = useState("Concrete");
  const [head, setHead] = useState<Resident | null>(null);
  /* The household as it was when the form opened: what a draft is typed against. */
  const [original, setOriginal] = useState<HouseholdFields | null>(null);
  const [saving, setSaving] = useState(false);

  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is
   * reading; a first load or a filter change should still say it is
   * working. Same fetch, and only the announcement differs.
   */
  const load = (silent = false) => {
    if (!silent) setLoading(true);
    populationApi.households({ params: { page } })
      .then((r) => {
        setRows(r.data.data.data ?? []);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
      })
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Live updates without a manual refresh.
  useAutoRefresh(() => load(true), REFRESH.staff);

  /*
   * Somebody else's change, about a second after they make it.
   *
   * The timer above stays as a backstop: if the pulse cannot be
   * reached the page is a few seconds stale rather than frozen.
   */
  usePulse("households", () => load(true));


  const fill = (f: HouseholdFields) => {
    setNumber(f.number);
    setZone(f.zone);
    setAddress(f.address);
    setHouseType(f.houseType);
    setHead(f.head);
  };

  const openEdit = (h: Household) => {
    const fields: HouseholdFields = {
      number: h.household_number ?? "",
      zone: h.zone_purok ?? "",
      address: h.street_address ?? "",
      houseType: h.house_type ?? "Concrete",
      head: h.head ?? null,
    };
    setEditingId(h.id);
    setOriginal(fields);
    fill(fields);
    setModalOpen(true);
  };

  /*
   * Unsaved edits, kept per household. The household's values when the form
   * opened are the draft's version: if somebody saves the household in the
   * meantime, the old typing is not laid over the newer record.
   */
  const draft = useModalDraft<HouseholdFields>(
    editingId ? `edit-household:${editingId}` : null,
    modalOpen,
    { number, zone, address, houseType, head },
    fill,
    {
      blank: original ?? undefined,
      reset: () => original && fill(original),
      version: original ? JSON.stringify({ ...original, head: original.head?.id ?? null }) : null,
    },
  );

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const editing = editingId !== null;
    if (
      !(await confirmAction({
        title: editing ? "Save changes to this household?" : "Add this household?",
        confirmText: editing ? "Yes, save" : "Yes, add",
      }))
    )
      return;
    setSaving(true);
    const payload = {
      household_number: number,
      zone_purok: zone,
      street_address: address,
      house_type: houseType,
      household_head_id: head?.id ?? null,
    };
    try {
      if (editing) {
        await populationApi.updateHousehold(editingId, payload, {
          offline: { label: `Household ${number || editingId}` },
        });
        toast("Household updated.");
      } else {
        await populationApi.createHousehold(payload, {
          offline: { label: `Household ${number || "(new)"}` },
        });
        toast("Household registered.");
      }
      draft.clear();
      setModalOpen(false);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => load()} />;

  return (
    <div>
      <PageHeader
        title="Households"
        subtitle="Shared population registry — the Main Office verifies records against this list"
      />

      <Card>
        <DataTable
          columns={[
            {
              header: "Household Number",
              render: (h: Household) => <span className="font-medium text-dark">{h.household_number}</span>,
            },
            { header: "Zone / Purok", render: (h: Household) => h.zone_purok ?? "—" },
            { header: "Address", render: (h: Household) => h.street_address ?? "—" },
            {
              header: "Owner / Head",
              render: (h: Household) =>
                h.head ? (
                  <span className="font-medium text-dark">
                    {h.head.first_name} {h.head.last_name}
                  </span>
                ) : (
                  <span className="text-gray-400">No owner set</span>
                ),
            },
            {
              /*
                A count, not a button. Opening the household is the eye in
                Actions — one place to click, the same place on every row,
                beside Edit.
              */
              header: "Members",
              render: (h: Household) => {
                const count = (h.residents ?? []).length;

                return count === 0 ? (
                  <span className="text-gray-400">Nobody yet</span>
                ) : (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {count} {count === 1 ? "person" : "people"}
                  </span>
                );
              },
            },
            {
              header: "Actions",
              render: (h: Household) => (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setViewing(h)}
                    title="View who lives here"
                    aria-label={`View who lives in household ${h.household_number}`}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray text-gray-500 transition-colors hover:border-primary hover:text-primary"
                  >
                    <FiEye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(h)}
                    title="Edit household"
                    aria-label={`Edit household ${h.household_number}`}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray text-gray-500 transition-colors hover:border-primary hover:text-primary"
                  >
                    <FiEdit2 className="h-4 w-4" />
                  </button>
                </span>
              ),
            },
          ]}
          rows={rows}
          rowKey={(h) => h.id}
          numbered
          total={total}
          searchable
          searchPlaceholder="Search by Household Number, Owner, Street or Zone / Purok…"
          getSearchText={(h) =>
            `${h.household_number} ${h.zone_purok ?? ""} ${h.street_address ?? ""} ${
              h.head ? `${h.head.first_name} ${h.head.last_name}` : ""
            }`
          }
          filters={[{ label: "Zone / Purok", getValue: (h) => h.zone_purok ?? "" }]}
          loading={loading}
          page={page}
          lastPage={lastPage}
          onPageChange={setPage}
        />
      </Card>

      {/*
        Who lives here.

        The head is first and said to be the head, because "who owns this
        house" is the question this registry is opened for. Everybody else
        follows in the order the register holds them.
      */}
      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.household_number} — who lives here` : ""}
        size="wide"
      >
        {viewing && (
          <div>
            <p className="mb-4 text-xs leading-relaxed text-gray-500">
              {[viewing.street_address, viewing.zone_purok].filter(Boolean).join(" · ")
                || "No address recorded"}
            </p>

            {/*
              A name on its own answers nothing. Two Juan Dela Cruzes in one
              household are the same row twice until something tells them
              apart, and "who is the child here" is the question this list is
              opened for — so sex, age and what they are to the head travel
              with the name.
            */}
            {/*
              Every member, the head first, each with their own Resident ID
              standing and the action that fits it — see ResidentIdRoster.
            */}
            <ResidentIdRoster
              heading="Members and their Resident IDs"
              people={[
                ...[...(viewing.residents ?? [])]
                  .sort((a, b) => {
                    // The head first, then the oldest down — a household reads
                    // the way it is spoken about.
                    if (a.id === viewing.head?.id) return -1;
                    if (b.id === viewing.head?.id) return 1;
                    return String(a.birthdate ?? "").localeCompare(String(b.birthdate ?? ""));
                  })
                  .map((person) => {
                    const age = ageFromBirthdate(String(person.birthdate ?? ""));
                    const isHead = person.id === viewing.head?.id || person.relation_to_head === "Head";

                    return {
                      id: person.id,
                      name: personName(person),
                      detail: [person.resident_number, person.gender, age !== null ? `${age} years old` : null].filter(Boolean).join(" · "),
                      badge: isHead ? "Household Head" : (person.relation_to_head ?? undefined),
                      highlight: isHead,
                    };
                  }),
                /* A head recorded here but not living here is still somebody whose ID the office may manage. */
                ...(viewing.head && !(viewing.residents ?? []).some((r) => r.id === viewing.head?.id)
                  ? [{ id: viewing.head.id, name: personName(viewing.head), detail: viewing.head.resident_number, badge: "Household Head", highlight: true }]
                  : []),
              ]}
            />

            {/*
              A head who is not among the members is somebody who moved out
              without the register being told — or who is recorded as heading
              two houses at once. Saying so is more use than quietly listing
              one person fewer.
            */}
            {viewing.head
              && !(viewing.residents ?? []).some((r) => r.id === viewing.head?.id) && (
              <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2 text-xs leading-relaxed text-amber-700">
                <strong>{personName(viewing.head)}</strong> is recorded as the head of this
                household but is not living in it. Either they have moved and the register was
                not told, or the head needs setting again.
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Household" : "Register Household"}>
        <form onSubmit={save} className="space-y-4">
          <FormField label="Household number" required>
            <input value={number} onChange={(e) => setNumber(e.target.value)} required className={inputClasses} placeholder="HH-2026-0009" />
          </FormField>
          <FormField label="Zone / Purok" required>
            <select value={zone} onChange={(e) => setZone(e.target.value)} required className={inputClasses}>
              <option value="">Select…</option>
              {/*
                The barangay's own list, kept by the Health Station. This was
                "Purok 1" to "Purok 5" written out here — five choices for a
                barangay with twenty-five zones, none of them named that.
              */}
              {zones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
              {zone && !zones.includes(zone) && (
                <option value={zone}>{zone} (no longer in use)</option>
              )}
            </select>
          </FormField>
          <FormField label="Street address" required>
            <input value={address} onChange={(e) => setAddress(e.target.value)} required className={inputClasses} />
          </FormField>
          <FormField label="House type">
            <select value={houseType} onChange={(e) => setHouseType(e.target.value)} className={inputClasses}>
              <option>Concrete</option>
              <option>Semi-concrete</option>
              <option>Light materials</option>
            </select>
          </FormField>
          <FormField label="Household head (owner)" hint="Search a resident — they become the identified owner of this household" plain>
            <ResidentPicker value={head} onChange={setHead} />
          </FormField>
          <DraftNotice draft={draft} />
          <button
            type="submit"
            disabled={saving}
            className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {saving ? "Saving…" : editingId ? "Save changes" : "Register"}
          </button>
        </form>
      </Modal>

    </div>
  );
}
