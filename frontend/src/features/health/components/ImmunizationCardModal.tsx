import { useEffect, useRef, useState, type FormEvent } from "react";
import { FiEdit2 } from "react-icons/fi";
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
import { ADULT_VACCINES, CHILD_VACCINES, DELIVERY_TYPES } from "../lib/itrVaccines";
import type { ImmunizationCard } from "../types";

/**
 * One person's IMMUNIZATION RECORD, as the DOH Individual Treatment Record
 * lays it out.
 *
 * It replaced a form that took one vaccine at a time with a Pending/Missed
 * status — a shape the paper card does not have. The card has a few once-only
 * lines (newborn screening, type of delivery, birth weight and length), then
 * one blank per vaccine for the day it was given, then "Others" and "Booster",
 * then the adult immunizations boxed off at the foot. So does this.
 *
 * NAME, ZONE, SEX AND ADDRESS ARE NOT ASKED. They are on the resident record
 * and shown from it; a second copy typed here would be the one that goes
 * stale when the family moves.
 *
 * A date cleared from a box takes that dose off the record — that is how a
 * wrong entry is corrected — and saving asks first.
 */
type CardField = "screening" | "delivery" | "birthWeight" | "birthLength" | "others" | "booster";

export default function ImmunizationCardModal({
  open,
  onClose,
  resident: fixedResident,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Opened from a row: the person is already known and cannot be changed. */
  resident?: Resident | null;
  onSaved: () => void;
}) {
  const [picked, setPicked] = useState<Resident | null>(null);
  const person = fixedResident ?? picked;

  const [card, setCard] = useState<ImmunizationCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState<boolean>(!fixedResident);

  /* The editable half of the card. */
  const [screening, setScreening] = useState("");
  const [delivery, setDelivery] = useState("");
  const [birthWeight, setBirthWeight] = useState("");
  const [birthLength, setBirthLength] = useState("");
  const [others, setOthers] = useState("");
  const [booster, setBooster] = useState("");
  const [doses, setDoses] = useState<Record<string, string>>({});
  /* What the card held when it opened, so only real changes are sent. */
  const [original, setOriginal] = useState<Record<string, string>>({});

  const clearFields = () => {
    setScreening("");
    setDelivery("");
    setBirthWeight("");
    setBirthLength("");
    setOthers("");
    setBooster("");
    setDoses({});
  };

  const reset = () => {
    setCard(null);
    clearFields();
    setOriginal({});
    setIsEditing(!fixedResident);
  };

  /*
   * Whose stored card the boxes are showing, or null while they only hold
   * what was typed before anybody was chosen.
   *
   * THE WHOLE CARD SHOWS FROM THE START. It used to appear only once a name
   * was picked, so the nurse saw one search box and a Save button and had no
   * idea what the record asked for. Now every box is there and can be filled
   * first — which means choosing the person afterwards must not wipe what was
   * typed, and switching to somebody else must not leave the first person's
   * doses sitting in the boxes to be saved onto the second.
   */
  const loadedFrom = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      reset();
      loadedFrom.current = null;
      setIsEditing(false);
      return;
    }

    setIsEditing(!fixedResident);

    if (!person) {
      /* The person was taken off. Boxes that held THEIR card go with them;
         boxes typed before anybody was chosen stay. */
      if (loadedFrom.current !== null) {
        clearFields();
        loadedFrom.current = null;
      }
      setCard(null);
      setOriginal({});
      return;
    }

    /* Switching from one person's card to another's starts clean. */
    if (loadedFrom.current !== null && loadedFrom.current !== person.id) {
      clearFields();
    }
    loadedFrom.current = person.id;

    setLoading(true);
    healthApi.immunizationCard(person.id)
      .then((r) => {
        const c: ImmunizationCard = r.data.data;
        setCard(c);
        /*
         * What was typed wins over what was stored, box by box: it is the
         * newer entry, made by the person at the table right now. A box left
         * empty takes the stored value, so a card filled in before the name
         * was chosen does not blank the doses already on record.
         */
        setScreening((was) => was || (c.profile?.newborn_screening_date?.slice(0, 10) ?? ""));
        setDelivery((was) => was || (c.profile?.delivery_type ?? ""));
        setBirthWeight((was) => was || (c.profile?.birth_weight_kg ?? ""));
        setBirthLength((was) => was || (c.profile?.birth_length_cm ?? ""));
        setOthers((was) => was || (c.profile?.others ?? ""));
        setBooster((was) => was || (c.profile?.booster ?? ""));
        setDoses((was) => ({
          ...(c.doses ?? {}),
          ...Object.fromEntries(Object.entries(was).filter(([, d]) => d)),
        }));
        setOriginal(c.doses ?? {});
      })
      .catch(() => {
        /*
         * No line and nothing held for this person: keep the boxes as they
         * are rather than refusing. The station still has to write today's
         * dose down, and a card that will not open is a dose that goes on
         * paper only.
         */
        setCard(null);
        setOriginal({});
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, person?.id]);

  /*
   * THE DRAFT HOLDS ONLY WHAT WAS CHANGED against the stored card — not the
   * card. Put back, those changes land on the card as it is NOW (typed wins,
   * box by box, exactly as above), so a dose another nurse recorded in the
   * meantime is not overwritten by an old copy of the card.
   */
  const stored: Record<CardField, string> = {
    screening: card?.profile?.newborn_screening_date?.slice(0, 10) ?? "",
    delivery: card?.profile?.delivery_type ?? "",
    birthWeight: card?.profile?.birth_weight_kg ?? "",
    birthLength: card?.profile?.birth_length_cm ?? "",
    others: card?.profile?.others ?? "",
    booster: card?.profile?.booster ?? "",
  };
  const typed: Record<CardField, string> = { screening, delivery, birthWeight, birthLength, others, booster };
  const fieldChanges = Object.fromEntries(
    (Object.keys(typed) as CardField[]).filter((k) => typed[k] !== stored[k]).map((k) => [k, typed[k]]),
  );
  const doseChanges = Object.fromEntries(
    Object.entries(doses).filter(([vaccine, date]) => (date ?? "") !== (original[vaccine] ?? "") && date),
  );
  const draft = useModalDraft<{ picked: Resident | null; fields: Partial<Record<CardField, string>>; doses: Record<string, string> }>(
    fixedResident ? `immunization-card:${fixedResident.id}` : "immunization-card",
    open,
    { picked: fixedResident ? null : picked, fields: fieldChanges, doses: doseChanges },
    (kept) => {
      if (!fixedResident && kept.picked) setPicked(kept.picked);
      const f = kept.fields ?? {};
      if (f.screening !== undefined) setScreening(f.screening);
      if (f.delivery !== undefined) setDelivery(f.delivery);
      if (f.birthWeight !== undefined) setBirthWeight(f.birthWeight);
      if (f.birthLength !== undefined) setBirthLength(f.birthLength);
      if (f.others !== undefined) setOthers(f.others);
      if (f.booster !== undefined) setBooster(f.booster);
      if (kept.doses) setDoses((was) => ({ ...was, ...kept.doses }));
    },
    {
      isEmpty: (v) => !v.picked && Object.keys(v.fields).length === 0 && Object.keys(v.doses).length === 0,
      reset: () => {
        if (!fixedResident) setPicked(null);
        clearFields();
        /* The stored card comes back into the boxes. */
        if (card) {
          setScreening(stored.screening);
          setDelivery(stored.delivery);
          setBirthWeight(stored.birthWeight);
          setBirthLength(stored.birthLength);
          setOthers(stored.others);
          setBooster(stored.booster);
          setDoses(card.doses ?? {});
        }
      },
    },
  );

  const childVaccines = card?.child_vaccines ?? CHILD_VACCINES;
  const adultVaccines = card?.adult_vaccines ?? ADULT_VACCINES;
  const deliveryTypes = card?.delivery_types ?? [...DELIVERY_TYPES];

  const today = new Date().toLocaleDateString("en-CA");
  const born = card?.resident.birthdate?.slice(0, 10) || person?.birthdate?.slice(0, 10) || undefined;

  const setDose = (vaccine: string, date: string) =>
    setDoses((was) => ({ ...was, [vaccine]: date }));

  const close = () => {
    setPicked(null);
    reset();
    onClose();
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!person) {
      toast("Please search and select a resident first before saving.", "error");
      return;
    }

    /* Only the boxes that changed. An empty value takes a recorded dose
       off; an untouched box is not sent, so it cannot be disturbed. */
    const changed: Record<string, string | null> = {};
    for (const vaccine of [...childVaccines, ...adultVaccines]) {
      const now = doses[vaccine] ?? "";
      const was = original[vaccine] ?? "";
      if (now !== was) changed[vaccine] = now || null;
    }
    const removed = Object.entries(changed).filter(([, d]) => d === null).map(([v]) => v);

    if (!(await confirmAction({
      title: "Save this immunization record?",
      text: removed.length
        ? `This takes ${removed.join(", ")} off the record.`
        : undefined,
      confirmText: "Yes, save",
      danger: removed.length > 0,
    }))) return;

    setSaving(true);
    try {
      const saved = await healthApi.saveImmunizationCard(person.id, {
        newborn_screening_date: screening || null,
        delivery_type: delivery || null,
        birth_weight_kg: birthWeight || null,
        birth_length_cm: birthLength || null,
        others: others.trim() || null,
        booster: booster.trim() || null,
        doses: changed,
      }, { offline: { label: `Immunization record — ${person.first_name} ${person.last_name}` } });
      draft.clear();
      announceWrite(saved, "Immunization record saved.");
      onSaved();
      close();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const doseGrid = (vaccines: string[]) => (
    <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {vaccines.map((vaccine) => (
        <label key={vaccine} className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-dark">{vaccine}</span>
          <input
            type="date"
            value={doses[vaccine] ?? ""}
            min={born}
            max={today}
            disabled={!isEditing}
            onChange={(e) => setDose(vaccine, e.target.value)}
            className={`${inputClasses} max-w-[10.5rem] py-1.5 text-sm`}
            aria-label={`${vaccine} — date given`}
          />
        </label>
      ))}
    </div>
  );

  const facts = card?.resident;

  return (
    <Modal open={open} onClose={close} title="Immunization Record" size="xl">
      <form onSubmit={save} className="space-y-6">
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
              isEditing
                ? "border border-primary/20 bg-primary/10 text-primary"
                : "border border-gray-200 bg-gray-100 text-gray-600"
            }`}
          >
            {isEditing ? "Edit mode" : "View mode (Read-only)"}
          </span>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <FiEdit2 className="h-3.5 w-3.5" aria-hidden="true" /> Edit record
            </button>
          )}
        </div>

        {!fixedResident && (
          <FormField label="Name" required plain>
            <ResidentPicker value={picked} onChange={setPicked} />
          </FormField>
        )}

        {/*
          EVERYTHING SHOWS FROM THE START. The register lines read "—" until a
          name is chosen, and every box below can be filled first.
        */}
            {/* From the register — shown, never asked. */}
            <dl className="grid gap-x-6 gap-y-1.5 rounded-xl bg-secondary/60 px-4 py-3 text-sm sm:grid-cols-2">
              {[
                ["Name", facts?.full_name ?? (person ? `${person.first_name} ${person.last_name}` : "—")],
                ["Zone", facts?.zone_purok ?? person?.zone_purok ?? "—"],
                ["Sex", facts?.gender ?? person?.gender ?? "—"],
                ["Birthday", born ? new Date(born).toLocaleDateString("en-PH") : "—"],
                ["Address", facts?.address ?? person?.address ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="w-20 shrink-0 text-gray-500">{label}</dt>
                  <dd className="font-medium text-dark">{value || "—"}</dd>
                </div>
              ))}
              {!person && (
                <p className="text-xs text-gray-500 sm:col-span-2">
                  Filled in from the register once the name is chosen above.
                </p>
              )}
            </dl>

            {/* A line, not a blank: the boxes stay where they are while the
                stored record is fetched, so nothing jumps under the pen. */}
            {loading && (
              <p className="-mt-3 text-xs text-gray-400">Opening their record…</p>
            )}

                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    At birth
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Newborn screening">
                      <input
                        type="date"
                        value={screening}
                        min={born}
                        max={today}
                        disabled={!isEditing}
                        onChange={(e) => setScreening(e.target.value)}
                        className={inputClasses}
                      />
                    </FormField>
                    <FormField label="Type of delivery" plain>
                      <div className="flex gap-4 pt-2.5">
                        {deliveryTypes.map((t) => (
                          <label key={t} className={`flex items-center gap-2 text-sm text-dark ${isEditing ? "cursor-pointer" : "cursor-default opacity-80"}`}>
                            <input
                              type="radio"
                              name="delivery"
                              checked={delivery === t}
                              disabled={!isEditing}
                              onChange={() => setDelivery(t)}
                              className="h-4 w-4 accent-primary disabled:cursor-not-allowed"
                            />
                            {t}
                          </label>
                        ))}
                        {isEditing && delivery && (
                          <button
                            type="button"
                            onClick={() => setDelivery("")}
                            className="cursor-pointer text-xs text-gray-400 hover:text-dark"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </FormField>
                    <FormField label="Birth weight (kg)">
                      <input
                        type="number"
                        step="0.01"
                        min="0.3"
                        max="7"
                        value={birthWeight}
                        disabled={!isEditing}
                        onChange={(e) => setBirthWeight(e.target.value)}
                        className={inputClasses}
                        placeholder="3.20"
                      />
                    </FormField>
                    <FormField label="Birth length (cm)">
                      <input
                        type="number"
                        step="0.1"
                        min="20"
                        max="70"
                        value={birthLength}
                        disabled={!isEditing}
                        onChange={(e) => setBirthLength(e.target.value)}
                        className={inputClasses}
                        placeholder="50.0"
                      />
                    </FormField>
                  </div>
                </section>

                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Immunization — date given
                  </h3>
                  <p className="mb-3 text-xs text-gray-400">
                    {isEditing ? "Leave a box empty if the dose has not been given." : "Dates when vaccines were administered."}
                  </p>
                  {doseGrid(childVaccines)}

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <FormField label="Others">
                      <input
                        value={others}
                        disabled={!isEditing}
                        onChange={(e) => setOthers(e.target.value)}
                        maxLength={500}
                        className={inputClasses}
                      />
                    </FormField>
                    <FormField label="Booster">
                      <input
                        value={booster}
                        disabled={!isEditing}
                        onChange={(e) => setBooster(e.target.value)}
                        maxLength={500}
                        className={inputClasses}
                      />
                    </FormField>
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Adult immunization — date given
                  </h3>
                  {doseGrid(adultVaccines)}
                </section>

        {isEditing && <DraftNotice draft={draft} />}

        {!isEditing ? (
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={close}
              className="w-1/2 cursor-pointer rounded-full border border-gray py-2.5 text-sm font-semibold text-dark transition-colors hover:bg-secondary"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={loading || !person}
              className="inline-flex w-1/2 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              <FiEdit2 className="h-4 w-4" aria-hidden="true" /> Edit record
            </button>
          </div>
        ) : (
          <div className="flex gap-3 pt-2">
            {fixedResident && (
              <button
                type="button"
                onClick={() => {
                  if (card) {
                    setScreening(stored.screening);
                    setDelivery(stored.delivery);
                    setBirthWeight(stored.birthWeight);
                    setBirthLength(stored.birthLength);
                    setOthers(stored.others);
                    setBooster(stored.booster);
                    setDoses(card.doses ?? {});
                  }
                  setIsEditing(false);
                }}
                className="w-1/3 cursor-pointer rounded-full border border-gray py-2.5 text-sm font-semibold text-dark transition-colors hover:bg-secondary"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading || saving}
              className={`${fixedResident ? "w-2/3" : "w-full"} cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50`}
            >
              {saving ? "Saving…" : person ? "Save record" : "Select a resident to save record"}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
