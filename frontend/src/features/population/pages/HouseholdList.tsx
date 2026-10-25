import { useEffect, useState, type FormEvent } from "react";
import { FiEdit2, FiEye, FiPlus, FiRepeat, FiUserPlus, FiX } from "react-icons/fi";
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
import ResidentMultiPicker from "../../resident/components/ResidentMultiPicker";
import HouseholdPicker from "../../resident/components/HouseholdPicker";
import { populationApi } from "../api";
import { useZoneNames } from "../lib/useZones";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

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
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageLoad = usePageLoad();

  // Modal for editing existing households
  const [modalOpen, setModalOpen] = useState(false);
  /** The household whose members are being read, if any. */
  const [viewing, setViewing] = useState<Household | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [number, setNumber] = useState("");
  const zones = useZoneNames();
  const [zone, setZone] = useState("");
  const [address, setAddress] = useState("");
  const [houseType, setHouseType] = useState("Concrete");
  const [head, setHead] = useState<Resident | null>(null);
  const [original, setOriginal] = useState<HouseholdFields | null>(null);
  const [saving, setSaving] = useState(false);

  // Transfer Resident Modal State (supports single or multiple residents + head assignment + inline household creation)
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferResidents, setTransferResidents] = useState<Resident[]>([]);
  const [assignedHeadId, setAssignedHeadId] = useState<number | null>(null);
  const [destinationMode, setDestinationMode] = useState<"existing" | "new">("existing");
  const [transferTargetHousehold, setTransferTargetHousehold] = useState<Household | null>(null);
  const [newHouseholdNumber, setNewHouseholdNumber] = useState("");
  const [newHouseholdZone, setNewHouseholdZone] = useState("");
  const [newHouseholdAddress, setNewHouseholdAddress] = useState("");
  const [newHouseholdType, setNewHouseholdType] = useState("Concrete");
  const [transferReason, setTransferReason] = useState("");
  const [transferSyncAddress, setTransferSyncAddress] = useState(true);
  const [transferring, setTransferring] = useState(false);

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

  useAutoRefresh(() => load(true), REFRESH.staff);
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

  const openTransfer = (
    residents?: Resident[] | Resident | null,
    targetHousehold?: Household | null
  ) => {
    const list: Resident[] = Array.isArray(residents)
      ? residents
      : residents
        ? [residents]
        : [];

    setTransferResidents(list);
    setAssignedHeadId(list.length > 0 ? list[0].id : null);
    setDestinationMode(targetHousehold ? "existing" : "existing");
    setTransferTargetHousehold(targetHousehold ?? null);
    setNewHouseholdNumber("");
    setNewHouseholdZone("");
    setNewHouseholdAddress("");
    setNewHouseholdType("Concrete");
    setTransferReason("");
    setTransferSyncAddress(true);
    setTransferModalOpen(true);
  };

  const handleTransferSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (transferResidents.length === 0) {
      toast("Please select at least one resident to transfer.", "error");
      return;
    }

    if (destinationMode === "existing") {
      if (!transferTargetHousehold) {
        toast("Please select a destination household.", "error");
        return;
      }
      const allAlreadyThere = transferResidents.every(
        (r) => r.household_id && r.household_id === transferTargetHousehold.id
      );
      if (allAlreadyThere) {
        toast(`All selected residents are already in household ${transferTargetHousehold.household_number}.`, "error");
        return;
      }
    } else {
      if (!newHouseholdNumber.trim()) {
        toast("Please enter a household number for the new household.", "error");
        return;
      }
      if (!newHouseholdZone) {
        toast("Please select a Zone / Purok for the new household.", "error");
        return;
      }
      if (!newHouseholdAddress.trim()) {
        toast("Please enter the street address for the new household.", "error");
        return;
      }
      if (transferResidents.length > 0 && assignedHeadId === null) {
        toast("Please assign one of the transferred residents as Household Head.", "error");
        return;
      }
    }

    const namesList = transferResidents.length <= 2
      ? transferResidents.map((r) => personName(r)).join(" and ")
      : `${personName(transferResidents[0])} and ${transferResidents.length - 1} other residents`;

    const targetDesc = destinationMode === "new"
      ? `new household ${newHouseholdNumber.trim()}`
      : `household ${transferTargetHousehold!.household_number}`;

    const headResident = transferResidents.find((r) => r.id === assignedHeadId);
    const headNotice = headResident
      ? ` (with ${personName(headResident)} as Household Head)`
      : "";

    if (
      !(await confirmAction({
        title: destinationMode === "new" ? "Create household & transfer?" : "Transfer residents?",
        text: `Transfer ${namesList} to ${targetDesc}${headNotice}?`,
        confirmText: destinationMode === "new" ? "Yes, create & transfer" : "Yes, transfer",
      }))
    ) {
      return;
    }

    setTransferring(true);
    try {
      const payload: Record<string, unknown> = {
        resident_ids: transferResidents.map((r) => r.id),
        head_resident_id: assignedHeadId ?? undefined,
        reason: transferReason.trim() || undefined,
        sync_address: transferSyncAddress,
      };

      if (destinationMode === "new") {
        payload.new_household = {
          household_number: newHouseholdNumber.trim(),
          zone_purok: newHouseholdZone,
          street_address: newHouseholdAddress.trim(),
          house_type: newHouseholdType,
        };
      } else {
        payload.household_id = transferTargetHousehold!.id;
      }

      const res = await populationApi.transferResident(payload);
      toast(res.data?.message || `${namesList} successfully transferred.`);
      setTransferModalOpen(false);
      load(true);

      // Refresh viewing household if currently open
      if (viewing) {
        populationApi.households({ params: { page } })
          .then((r) => {
            const list = (r.data?.data?.data ?? []) as Household[];
            const updated = list.find((h) => h.id === viewing.id);
            if (updated) setViewing(updated);
          })
          .catch(() => undefined);
      }
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setTransferring(false);
    }
  };

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
    const payload: Record<string, unknown> = {
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
        actions={
          <button
            type="button"
            onClick={() => openTransfer()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
          >
            <FiRepeat className="h-3.5 w-3.5" /> Transfer Resident
          </button>
        }
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

      {/* Who lives here modal */}
      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.household_number} — who lives here` : ""}
        size="wide"
      >
        {viewing && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-dark">
                  {[viewing.street_address, viewing.zone_purok].filter(Boolean).join(" · ")
                    || "No address recorded"}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Owner / Head: {viewing.head ? `${viewing.head.first_name} ${viewing.head.last_name}` : "No owner set"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openTransfer([], viewing)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
              >
                <FiUserPlus className="h-3.5 w-3.5" /> Move residents into this household
              </button>
            </div>

            <ResidentIdRoster
              heading="Members and their Resident IDs"
              people={[
                ...[...(viewing.residents ?? [])]
                  .sort((a, b) => {
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
                ...(viewing.head && !(viewing.residents ?? []).some((r) => r.id === viewing.head?.id)
                  ? [{ id: viewing.head.id, name: personName(viewing.head), detail: viewing.head.resident_number, badge: "Household Head", highlight: true }]
                  : []),
              ]}
              renderExtraActions={(person) => (
                <button
                  type="button"
                  onClick={() => {
                    const fullResident = (viewing.residents ?? []).find((r) => r.id === person.id)
                      ?? (viewing.head?.id === person.id ? viewing.head : null);
                    openTransfer(
                      fullResident
                        ? [{ ...fullResident, household: viewing }]
                        : [({ id: person.id, first_name: person.name, last_name: "", household: viewing } as any)],
                      null
                    );
                  }}
                  title="Transfer to another household"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-primary hover:text-primary hover:bg-primary/5"
                >
                  <FiRepeat className="h-3 w-3 text-primary" /> Transfer
                </button>
              )}
            />

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

      {/* Edit Household Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Household" : "Register Household"}>
        <form onSubmit={save} className="space-y-4">
          <FormField label="Household number" required>
            <input value={number} onChange={(e) => setNumber(e.target.value)} required className={inputClasses} placeholder="HH-2026-0009" />
          </FormField>
          <FormField label="Zone / Purok" required>
            <select value={zone} onChange={(e) => setZone(e.target.value)} required className={inputClasses}>
              <option value="">Select…</option>
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
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </Modal>

      {/* Transfer Resident Modal with Multi-Resident Selection, Head Assignment & Inline Household Creation */}
      <Modal
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfer Resident to Another Household"
        size="wide"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-dark">
            Transfer one or multiple residents to another household in the registry, or create a brand new household and designate who the Household Head will be.
          </div>

          {/* Residents Selection */}
          <div className="space-y-3">
            <FormField
              label="Residents to transfer *"
              hint="Search and select one or more residents to transfer together"
              plain
            >
              <ResidentMultiPicker
                value={transferResidents}
                onChange={(updated) => {
                  setTransferResidents(updated);
                  if (updated.length > 0) {
                    if (!assignedHeadId || !updated.some((r) => r.id === assignedHeadId)) {
                      setAssignedHeadId(updated[0].id);
                    }
                  } else {
                    setAssignedHeadId(null);
                  }
                }}
                placeholder="Search resident name or resident number to add to transfer…"
              />
            </FormField>

            {/* List of selected residents and Head Assignment */}
            {transferResidents.length > 0 && (
              <div className="rounded-2xl border border-gray/70 p-3.5 space-y-3 bg-secondary/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-dark">
                    Selected Residents ({transferResidents.length}) & Household Head Assignment
                  </span>
                  {transferResidents.length > 1 && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                      Multiple Residents
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-gray-500">
                  {transferResidents.length === 1
                    ? "Check the option below if this resident will be the Household Head:"
                    : "Select which resident will be assigned as the Household Head (Owner):"}
                </p>

                <div className="space-y-2">
                  {transferResidents.map((r) => {
                    const isHead = assignedHeadId === r.id;
                    return (
                      <label
                        key={r.id}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-2.5 transition-all ${
                          isHead
                            ? "border-primary bg-primary/5 shadow-xs"
                            : "border-gray/70 bg-white hover:border-gray"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="radio"
                            name="assigned_head_resident"
                            checked={isHead}
                            onChange={() => setAssignedHeadId(r.id)}
                            className="h-4 w-4 accent-primary cursor-pointer shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-dark truncate">{personName(r)}</p>
                            <p className="text-[11px] text-gray-500">
                              {r.resident_number}
                              {r.gender ? ` · ${r.gender}` : ""}
                              {r.household?.household_number ? ` · Current: ${r.household.household_number}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isHead ? (
                            <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                              ★ Household Head
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-gray-400">
                              Click to make Head
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const filtered = transferResidents.filter((x) => x.id !== r.id);
                              setTransferResidents(filtered);
                              if (assignedHeadId === r.id) {
                                setAssignedHeadId(filtered.length > 0 ? filtered[0].id : null);
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-danger cursor-pointer"
                            title="Remove from transfer"
                          >
                            <FiX className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </label>
                    );
                  })}

                  {/* Option to keep existing destination head if existing household has one */}
                  {destinationMode === "existing" && transferTargetHousehold?.head && (
                    <label
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-2.5 transition-all ${
                        assignedHeadId === null
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-gray/70 bg-white hover:border-gray"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="radio"
                          name="assigned_head_resident"
                          checked={assignedHeadId === null}
                          onChange={() => setAssignedHeadId(null)}
                          className="h-4 w-4 accent-primary cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-dark">
                            Keep Destination Household's Existing Head
                          </p>
                          <p className="text-[11px] text-gray-500">
                            Current Head: {personName(transferTargetHousehold.head)} (transferred residents join as members)
                          </p>
                        </div>
                      </div>
                      {assignedHeadId === null && (
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                          Current Head Maintained
                        </span>
                      )}
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Destination Selection with Toggle between Existing and New */}
          <div className="rounded-2xl border border-gray/70 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray/40 pb-2.5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-dark">
                  Destination Household *
                </span>
                <p className="text-[11px] text-gray-500">
                  {destinationMode === "existing"
                    ? "Move residents into an already registered household"
                    : "Create a new household record and move residents directly into it"}
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-secondary p-1 border border-gray/40">
                <button
                  type="button"
                  onClick={() => setDestinationMode("existing")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    destinationMode === "existing"
                      ? "bg-primary text-white shadow-xs"
                      : "text-gray-600 hover:text-primary"
                  }`}
                >
                  Select Existing
                </button>
                <button
                  type="button"
                  onClick={() => setDestinationMode("new")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    destinationMode === "new"
                      ? "bg-primary text-white shadow-xs"
                      : "text-gray-600 hover:text-primary"
                  }`}
                >
                  + Create New Household
                </button>
              </div>
            </div>

            {destinationMode === "existing" ? (
              <div className="space-y-2 pt-1">
                <HouseholdPicker
                  value={transferTargetHousehold?.id ? String(transferTargetHousehold.id) : ""}
                  selected={transferTargetHousehold}
                  onSelect={setTransferTargetHousehold}
                  onAddNew={() => setDestinationMode("new")}
                  placeholder="Search existing household by number, purok, or owner…"
                />

                {transferTargetHousehold && (
                  <div className="rounded-xl bg-secondary px-3.5 py-2.5 text-xs text-dark">
                    <p className="font-semibold text-primary">Destination: {transferTargetHousehold.household_number}</p>
                    <p className="text-gray-500 mt-0.5">
                      {[transferTargetHousehold.street_address, transferTargetHousehold.zone_purok].filter(Boolean).join(" · ") || "No address on file"}
                      {transferTargetHousehold.head ? ` · Owner: ${personName(transferTargetHousehold.head)}` : ""}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-primary/5 p-3.5 space-y-3 border border-primary/20">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <FiPlus className="h-4 w-4" />
                  <span>New Household Information</span>
                </div>

                <FormField label="Household Number" required hint="e.g. 18A019A or HH-2026-0009">
                  <input
                    type="text"
                    value={newHouseholdNumber}
                    onChange={(e) => setNewHouseholdNumber(e.target.value)}
                    placeholder="e.g. 18A019A"
                    required={destinationMode === "new"}
                    className={inputClasses}
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Zone / Purok" required>
                    <select
                      value={newHouseholdZone}
                      onChange={(e) => setNewHouseholdZone(e.target.value)}
                      required={destinationMode === "new"}
                      className={inputClasses}
                    >
                      <option value="">Select Zone / Purok…</option>
                      {zones.map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="House Type">
                    <select
                      value={newHouseholdType}
                      onChange={(e) => setNewHouseholdType(e.target.value)}
                      className={inputClasses}
                    >
                      <option>Concrete</option>
                      <option>Semi-concrete</option>
                      <option>Light materials</option>
                    </select>
                  </FormField>
                </div>

                <FormField label="Street Address" required hint="Specific street address in the barangay">
                  <input
                    type="text"
                    value={newHouseholdAddress}
                    onChange={(e) => setNewHouseholdAddress(e.target.value)}
                    placeholder="e.g. Zone 18A, Main Road"
                    required={destinationMode === "new"}
                    className={inputClasses}
                  />
                </FormField>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray/70 p-3">
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-dark">
              <input
                type="checkbox"
                checked={transferSyncAddress}
                onChange={(e) => setTransferSyncAddress(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-primary cursor-pointer"
              />
              <div>
                <span className="font-semibold">Update residents' Purok and Address</span>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  Automatically set the transferred residents' Zone / Purok and address to match the destination household.
                </p>
              </div>
            </label>
          </div>

          <FormField
            label="Reason for transfer (optional)"
            hint="e.g. Marriage, family relocation, independent living"
          >
            <input
              type="text"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="e.g. Moved to spouse's household, independent living"
              className={inputClasses}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray/50">
            <button
              type="button"
              onClick={() => setTransferModalOpen(false)}
              className="cursor-pointer rounded-full border border-gray px-5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray/20"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                transferring ||
                transferResidents.length === 0 ||
                (destinationMode === "existing" && !transferTargetHousehold) ||
                (destinationMode === "new" && (!newHouseholdNumber.trim() || !newHouseholdZone || !newHouseholdAddress.trim()))
              }
              className="cursor-pointer rounded-full bg-primary px-6 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {transferring
                ? "Processing…"
                : destinationMode === "new"
                  ? `Create Household & Transfer (${transferResidents.length})`
                  : `Confirm Transfer (${transferResidents.length})`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
