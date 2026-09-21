import { useEffect, useState } from "react";
import { FiCheck, FiEdit2 } from "react-icons/fi";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { personName } from "../../../shared/lib/names";
import Card from "../../../shared/ui/Card";
import { formatBirthdate, birthdateNote } from "../../../shared/lib/birthdate";
import PageHeader from "../../../shared/ui/PageHeader";
import { inputClasses } from "../../../shared/ui/FormField";
import type { Family, User } from "../../../shared/types";
import FamilyPanel from "../../resident/components/FamilyPanel";
import ChangePasswordCard from "../../account/components/ChangePasswordCard";
import ChangeEmailCard from "../components/ChangeEmailCard";
import { portalApi } from "../api";

/**
 * "My Profile" — the resident's own record, and the family attached to it.
 *
 * The family used to be its own menu entry. It is the same question ("what
 * does the barangay have on me?"), so it lives here instead: one page, one
 * button in the sidebar.
 *
 * Nearly everything is read-only. The Population Office owns the registry, so
 * corrections are made there; showing it here is what lets a resident notice
 * a mistake at all.
 *
 * THREE ROWS ARE THE EXCEPTION, and the resident owns all three:
 *
 *   Occupation      nobody at the counter knows what work somebody does
 *                   better than they do, and an office typing a neighbour's
 *                   occupation is guessing at the figure a livelihood
 *                   programme then gets planned around.
 *   Civil status    a marriage or a bereavement is true before any paperwork
 *                   reaches the barangay, and the resident is not obliged to
 *                   report it at a counter first.
 *   Contact number  the number the office rings when a certificate is ready.
 *                   A stale one fails silently — the document sits there and
 *                   nobody answers — so the person who knows it should be
 *                   able to fix it without queueing to do so.
 */

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value?: string | null;
  /** A qualification on the value — why it reads the way it does. */
  hint?: string;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray/60 py-2.5 text-sm last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-dark">
        {value || "—"}
        {hint && <span className="mt-0.5 block text-xs font-normal text-gray-400">{hint}</span>}
      </span>
    </div>
  );
}

/**
 * A row the resident may change, with its editor folded away until asked.
 *
 * One component rather than three copies: the rows differ only in where
 * their value comes from and whether it is picked from a list or typed, and
 * three hand-written editors is three places for the Save button to drift.
 */
function EditableRow({
  label,
  shown,
  initial,
  options,
  placeholder,
  allowEmpty = false,
  onSave,
}: {
  label: string;
  /** What the row reads while it is not being edited. */
  shown?: string | null;
  /** What the editor opens with — not always the stored value. */
  initial: string;
  /** Given for a dropdown; left out for a typed box. */
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** True where clearing the field is a real answer, as for a phone number. */
  allowEmpty?: boolean;
  onSave: (next: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (await onSave(draft)) setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const unchanged = draft === initial;
  const empty = draft.trim() === "";

  return (
    <div className="border-b border-gray/60 py-2.5 text-sm last:border-0">
      <div className="flex items-center justify-between gap-4">
        <span className="text-gray-500">{label}</span>

        {!editing && (
          <span className="flex items-center gap-2">
            <span className="text-right font-medium text-dark">{shown || "—"}</span>
            <button
              type="button"
              onClick={() => {
                setDraft(initial);
                setEditing(true);
              }}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-primary/40 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
            >
              <FiEdit2 className="h-3 w-3" aria-hidden="true" />
              Change
            </button>
          </span>
        )}
      </div>

      {editing && (
        <div className="mt-2 space-y-2">
          {options ? (
            <select
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={label}
              className={inputClasses}
            >
              <option value="">Choose…</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={label}
              placeholder={placeholder}
              className={inputClasses}
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving || unchanged || (empty && !allowEmpty)}
              onClick={save}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              <FiCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="cursor-pointer rounded-full border border-gray px-4 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:border-primary hover:text-primary"
            >
              Cancel
            </button>
            <span className="text-xs text-gray-400">
              Only you can change this. The office cannot.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  const [account, setAccount] = useState<User | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [familyError, setFamilyError] = useState("");

  /* The occupation list comes with the profile — the page cannot draw its one
     editable field without it. */
  const [occupations, setOccupations] = useState<string[]>([]);
  const [civilStatuses, setCivilStatuses] = useState<string[]>([]);

  /* Named rather than inline: the email card calls it once a change is
     confirmed, so the address on screen is the one now in use. */
  const loadProfile = () =>
    portalApi.profile()
      .then((r) => {
        setAccount(r.data.data.user ?? null);
        setOccupations(r.data.data.occupations ?? []);
        setCivilStatuses(r.data.data.civil_statuses ?? []);
      })
      .catch(() => undefined);

  useEffect(() => {
    loadProfile();
    portalApi.family()
      .then((r) => setFamily(r.data.data))
      .catch(() => setFamilyError("Your family record could not be loaded right now."));
  }, []);

  const resident = account?.resident;

  /*
   * What is already recorded, even when it is not on the list.
   *
   * Most of the register was filled in before there was a list — "Housewife",
   * "Fisherman", "Tricycle Driver". Offering only the list would blank those
   * the moment somebody opened the dropdown, so what they have is kept as a
   * choice of its own and said to be off the list.
   */
  const current = resident?.occupation ?? "";
  const offList = current !== "" && !occupations.includes(current);

  /*
   * "None" is shown as a dash.
   *
   * It is STORED as the word, because a dash in an exported column cannot be
   * told apart from an empty cell — and the two mean different things: one
   * says "no work", the other says nobody has asked yet.
   */
  const labelFor = (option: string) => (option === "None" ? "—" : option);

  /**
   * Sends one changed field and folds the new value back into the page.
   *
   * One field per request, because that is how the rows are edited — and a
   * request carrying only what changed cannot blank the other two if the
   * page's copy of them is out of date.
   *
   * Returns whether it landed, so the row knows whether to close.
   */
  const saveField = async (patch: Record<string, string>, said: string) => {
    try {
      await portalApi.updateDetails(patch);
      setAccount((was) =>
        was?.resident ? { ...was, resident: { ...was.resident, ...patch } } : was
      );
      toast(said);

      return true;
    } catch (err) {
      toast(errorMessage(err), "error");

      return false;
    }
  };

  const noFamily =
    family !== null &&
    (family.parents?.length ?? 0) === 0 &&
    (family.children?.length ?? 0) === 0 &&
    (family.siblings?.length ?? 0) === 0 &&
    !family.spouse;

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle="Your registered resident record and family. Visit the Population Office to correct any detail."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Resident information">
          <Row label="Resident No." value={resident?.resident_number} />
          <Row
            label="Full name"
            value={
              resident
                ? personName(resident)
                : undefined
            }
          />
          <Row label="Sex" value={resident?.gender} />
          {/*
            Month and year when that is all the census gave.

            A resident opened this page and read "June 30, 2002" — the 30 was
            put there by the system to fill a DATE column, and they had never
            given a day. Their own record is the last place they should meet
            an invented fact about themselves, and the note says plainly
            where to go if the real date matters to them.
          */}
          <Row
            label="Birthdate"
            value={formatBirthdate(resident?.birthdate, resident?.birthdate_is_estimated) || undefined}
            hint={birthdateNote(resident?.birthdate_is_estimated) || undefined}
          />
          <EditableRow
            label="Civil status"
            shown={resident?.civil_status}
            initial={resident?.civil_status ?? ""}
            options={civilStatuses.map((s) => ({ value: s, label: s }))}
            onSave={(next) =>
              saveField({ civil_status: next }, "Your civil status has been updated.")}
          />
          <EditableRow
            label="Occupation"
            shown={resident?.occupation ? labelFor(resident.occupation) : ""}
            /* Blank when what they have is not on the list, so the dropdown
               opens on "Choose…" rather than on a value it cannot show. */
            initial={offList ? "" : current}
            options={[
              /* What they already have, when the list does not hold it. */
              ...(offList ? [{ value: current, label: `${current} (already recorded)` }] : []),
              ...occupations.map((option) => ({ value: option, label: labelFor(option) })),
            ]}
            onSave={(next) =>
              saveField({ occupation: next }, "Your occupation has been updated.")}
          />
          <EditableRow
            label="Contact number"
            shown={resident?.contact_number}
            initial={resident?.contact_number ?? ""}
            placeholder="09XX XXX XXXX"
            /* Clearing it is a real answer: some residents have no number,
               and the office should read that rather than an old one. */
            allowEmpty
            onSave={(next) =>
              saveField({ contact_number: next.trim() }, "Your contact number has been updated.")}
          />
        </Card>

        <Card title="Residency & household">
          <Row label="Zone / Purok" value={resident?.zone_purok} />
          <Row label="Residency status" value={resident?.residency_status} />
          <Row label="Household No." value={resident?.household?.household_number} />
          <Row label="Household address" value={resident?.household?.street_address} />
          <Row label="Portal email" value={account?.email} />
        </Card>
      </div>

      {/*
        Under the record and above the family, because that is the order of
        how much it is used. A resident opens this page to check their
        details; changing a password is the rarer errand, and it should be
        findable without being the first thing in the way.
      */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChangeEmailCard current={account?.email} onChanged={loadProfile} />
        <ChangePasswordCard />
      </div>

      <div className="mt-6">
        {familyError ? (
          <Card title="My family">
            <p className="py-6 text-center text-sm text-danger">{familyError}</p>
          </Card>
        ) : !family ? (
          <Card title="My family">
            <p className="py-6 text-center text-sm text-gray-400">Loading your family…</p>
          </Card>
        ) : noFamily ? (
          <Card title="My family">
            <p className="py-8 text-center text-sm leading-relaxed text-gray-500">
              No family members are linked to your record yet.
              <br />
              Visit the <strong>Barangay Population Office</strong> to have your parents, spouse or
              children added — your grandparents, siblings and cousins then appear on their own.
            </p>
          </Card>
        ) : (
          <>
            {/* Names only: a resident may see who their relatives are, not open
                their registry records. */}
            <FamilyPanel family={family} title="My family" />
            <p className="mt-4 rounded-2xl border border-gray bg-white px-4 py-3 text-xs leading-relaxed text-gray-500">
              Something wrong or missing? Visit the <strong>Barangay Population Office</strong> with
              a valid ID and they will correct it. Grandparents, siblings, tita/tito and pinsan are
              worked out from your parents&rsquo; records, so they fill in as more of the family is
              registered.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
