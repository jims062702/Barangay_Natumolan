import { useState, useRef, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { errorMessage, fieldErrors } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { showServerFieldErrors } from "../../../shared/lib/formErrors";
import { formatBirthdate } from "../../../shared/lib/birthdate";
import type { Household } from "../../../shared/types";
import { type ResidentForm, RESIDENT_FORM_INITIAL, buildResidentPayload } from "../components/ResidentFormFields";
import { isAdopted } from "../components/intake/relations";
import { residentApi } from "../api";
import { rbimApi } from "../../rbim/api";
import type { CensusHandoff, Member, DuplicateWarning } from "../components/intake/types";

/**
 * The state and handlers of <ResidentCreate>, so its sections can share them.
 */
export function useResidentIntake() {
  const handoff = (useLocation().state ?? null) as CensusHandoff | null;

  const [form, setForm] = useState<ResidentForm>({
    ...RESIDENT_FORM_INITIAL,
    ...(handoff?.censusPrefill ?? {}),
  });
  const [manualSectors, setManualSectors] = useState<string[]>([]);
  // When on, length of residence follows the age (years since birth) and the
  // field is locked; turning it off restores whatever was typed before.
  const [autoLength, setAutoLength] = useState(false);
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const [step, setStep] = useState<"form" | "preview">("form");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateWarning[] | null>(null);
  // Inline "register household" so the clerk doesn't have to leave the form.
  const [hhOpen, setHhOpen] = useState(false);
  // Opt-in: make the resident being registered the owner/head of the selected
  // household. Off by default so it is never set unless the clerk chooses to.
  const [makeOwner, setMakeOwner] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();

  const residentName = `${form.first_name} ${form.last_name}`.trim();

  const patch = (values: Partial<ResidentForm>) => setForm((prev) => ({ ...prev, ...values }));

  /**
   * Selecting a household fills the owner's purok from it — and everybody
   * else's. They live in the same house; asking again per person is asking
   * the same question five times.
   */
  const selectHousehold = (household: Household | null) => {
    setSelectedHousehold(household);
    setForm((prev) => ({
      ...prev,
      household_id: household ? String(household.id) : "",
      zone_purok: household?.zone_purok || prev.zone_purok,
    }));
    setMembers((prev) =>
      prev.map((m) => ({
        ...m,
        form: {
          ...m.form,
          household_id: household ? String(household.id) : "",
          zone_purok: household?.zone_purok || m.form.zone_purok,
        },
      }))
    );
    if (!household) setMakeOwner(false); // no household → nothing to own
  };

  const toggleSector = (sector: string) =>
    setManualSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    );

  const addMember = () =>
    setMembers((prev) => [
      ...prev,
      {
        form: {
          ...RESIDENT_FORM_INITIAL,
          /*
           * The house carries over; the SURNAME does not. Households share an
           * address, not a name — a married daughter, a step-child, a boarder
           * all carry their own. Filling it in is a guess that gets saved as
           * fact the moment nobody notices it.
           */
          household_id: form.household_id,
          zone_purok: form.zone_purok,
          residency_status: form.residency_status,
        },
        manualSectors: [],
        autoLength: false,
        relation: null,
        relationship: null,
        livesOutside: null,
        otherParent: null,
        unionType: null,
      },
    ]);

  /*
   * Whether a partner is being registered alongside the owner. Only then is
   * "the owner's spouse" an answer the form can offer — the owner is new, so
   * there is no existing marriage to fall back on.
   */
  const hasSpouse = members.some((m) => m.relation === "spouse");

  // The partner being registered alongside the owner, so the child blocks can
  // name them instead of saying "the spouse".
  const spouseMember = members.find((m) => m.relation === "spouse");
  const spouseName = spouseMember
    ? `${spouseMember.form.first_name} ${spouseMember.form.last_name}`.trim()
    : "";
  const spouseGender = spouseMember?.form.gender ?? "";

  const setMember = (index: number, changes: Partial<Member>) =>
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, ...changes } : m)));

  const patchMember = (index: number, values: Partial<ResidentForm>) =>
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, form: { ...m.form, ...values } } : m))
    );

  /** Everything the clerk typed, in the shape the server takes it. */
  const payload = (confirmNamesakes: boolean) => ({
    confirm_namesakes: confirmNamesakes || undefined,
    make_household_head: makeOwner && !!form.household_id,
    head: buildResidentPayload(form, manualSectors, autoLength),
    members: members.map((m) => ({
      relation: m.relation,
      relationship: m.relationship || undefined,
      union_type: m.relation === "spouse" ? (m.unionType ?? undefined) : undefined,
      // Only sent for a child, and only once answered — the server keeps its
      // own presumption for anything it is not told about.
      other_parent:
        m.relation === "child" && m.otherParent && !isAdopted(m.relationship)
          ? {
              /*
               * Picking somebody from the search means linking them, not
               * making a second record of them — so it goes as "resident"
               * whichever list they were found in.
               */
              kind:
                m.otherParent.kind === "outside" && m.otherParent.resident
                  ? "resident"
                  : m.otherParent.kind,
              resident_id: m.otherParent.resident?.id,
              first_name: m.otherParent.first_name || undefined,
              middle_name: m.otherParent.middle_name || undefined,
              last_name: m.otherParent.last_name || undefined,
              gender: m.otherParent.gender || undefined,
              contact_number: m.otherParent.contact_number || undefined,
              address: m.otherParent.address || undefined,
            }
          : undefined,
      ...(m.livesOutside
        ? {
            // Only what the barangay needs to reach somebody living elsewhere.
            record_type: "Non-resident",
            first_name: m.form.first_name,
            middle_name: m.form.middle_name || undefined,
            last_name: m.form.last_name,
            suffix: m.form.suffix || undefined,
            gender: m.form.gender || undefined,
            contact_number: m.form.contact_number || undefined,
            address: m.form.address || undefined,
          }
        : buildResidentPayload(m.form, m.manualSectors, m.autoLength)),
    })),
  });

  const register = async (confirmNamesakes: boolean) => {
    setError("");
    setSaving(true);
    try {
      const response = await residentApi.registerHousehold(payload(confirmNamesakes));
      const created = response.data.data.head.id;

      /*
       * Back to the census, with the line joined up.
       *
       * Without this the office registers somebody and the census line still
       * says nobody — two records of one person and nothing connecting them,
       * which is the state the whole reconciliation step exists to prevent.
       * The registration itself already succeeded, so a failure here is
       * reported and not raised: the person exists either way.
       */
      const back = handoff?.censusReturn;

      if (back) {
        try {
          await rbimApi.matchMember(back.censusId, back.memberId, {
            resident_id: created,
          });
          toast(`Registered, and line ${back.line} of ${back.censusNo} now points to them.`);
        } catch {
          toast(
            `Registered — but line ${back.line} of ${back.censusNo} could not be matched. Match it on the census form.`,
            "warning"
          );
        }

        navigate(`/population/rbim/${back.censusId}`);
        return;
      }

      navigate(`/population/residents/${created}`);
    } catch (err) {
      const found = (err as { response?: { status?: number; data?: { errors?: { possible_duplicates?: DuplicateWarning[] } } } })
        .response;

      // 409 = somebody in this household may already be registered. Shown on
      // the preview, all of them at once, so it is one decision and not six.
      if (found?.status === 409 && found.data?.errors?.possible_duplicates) {
        setDuplicates(found.data.errors.possible_duplicates);
        setError(errorMessage(err));
        setSaving(false);
        return;
      }

      // A field problem sends them back to fix it — a preview they cannot
      // edit is a dead end.
      setStep("form");
      const shownInline = showServerFieldErrors(formRef.current, fieldErrors(err));
      setError(shownInline ? "" : errorMessage(err));
      setSaving(false);
    }
  };

  const review = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    /*
     * Nothing is pre-picked, so nothing may be skipped.
     *
     * The browser enforces the typed fields on its own, but these are
     * buttons — it has nothing to check. Left unanswered they would reach
     * the server as "no relation", and a household would be registered as
     * six unrelated people living at one address.
     */
    const unanswered = members.findIndex(
      (m) =>
        m.relation === null ||
        (m.relation !== "none" && m.livesOutside === null) ||
        (m.relation === "spouse" && m.unionType === null) ||
        (m.relation === "child" &&
          !isAdopted(m.relationship) &&
          !hasSpouse &&
          m.otherParent === null)
    );

    if (unanswered !== -1) {
      const who =
        `${members[unanswered].form.first_name} ${members[unanswered].form.last_name}`.trim();

      setError(
        `Person ${unanswered + 1}${who ? " (" + who + ")" : ""} still has a question unanswered. ` +
          "Every household member needs their relation, where they live, and — for a spouse " +
          "or a child — whether they are married and who the other parent is."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setError("");
    setDuplicates(null);
    setStep("preview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const total = members.length + 1;

  /** How the chosen other parent reads back on the preview. */
  const otherParentName = (member: Member): string => {
    const parent = member.otherParent;
    if (!parent) return "—";

    if (parent.kind === "spouse") {
      const spouse = members.find((m) => m.relation === "spouse");
      const name = spouse
        ? `${spouse.form.first_name} ${spouse.form.last_name}`.trim()
        : "";
      // Named, not just "the spouse" — the point of a preview is to be read.
      return name || `${residentName || "the owner"}’s spouse`;
    }

    if (parent.kind === "resident") {
      return parent.resident?.full_name ?? "nobody chosen";
    }

    if (parent.kind === "outside") {
      const name = `${parent.first_name} ${parent.last_name}`.trim();
      return (name || "unnamed") + " (outside the barangay)";
    }

    return "not recorded";
  };

  /* ------------------------------------------------------------------ */

  const Line = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex gap-2 text-xs">
      <dt className="w-32 shrink-0 text-gray-400">{label}</dt>
      <dd className={value ? "text-dark" : "text-gray-300"}>{value || "—"}</dd>
    </div>
  );

  const personSummary = (
    person: ResidentForm,
    sectors: string[],
    heading: string,
    badge?: string,
    key?: number
  ) => (
    <div key={key ?? "head"} className="rounded-2xl border border-gray p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-dark">
          {[person.first_name, person.middle_name, person.last_name, person.suffix]
            .filter(Boolean)
            .join(" ") || "(no name entered)"}
        </p>
        <span className="flex items-center gap-2">
          {badge && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
              {badge}
            </span>
          )}
          <span className="text-[11px] uppercase tracking-wide text-gray-400">{heading}</span>
        </span>
      </div>
      <dl className="grid gap-1.5 sm:grid-cols-2">
        <Line label="Sex" value={person.gender} />
        <Line
          label="Birthdate"
          value={formatBirthdate(person.birthdate, person.birthdate_is_estimated)}
        />
        <Line label="Civil status" value={person.civil_status} />
        <Line label="Place of birth" value={person.birth_place} />
        <Line label="Occupation" value={person.occupation} />
        <Line label="Contact" value={person.contact_number} />
        <Line label="Email" value={person.email} />
        <Line label="Purok" value={person.zone_purok} />
        <Line label="Residency" value={person.residency_status} />
        <Line label="Education" value={person.educational_attainment} />
        <Line label="Sectors" value={sectors.join(", ")} />
      </dl>
      {person.email ? (
        <p className="mt-3 rounded-lg bg-secondary/70 px-3 py-2 text-[11px] leading-relaxed text-gray-600">
          A portal account will be emailed to <strong>{person.email}</strong>.
        </p>
      ) : (
        <p className="mt-3 text-[11px] text-gray-400">
          No email — no portal account. One can be issued later from their profile.
        </p>
      )}
    </div>
  );

  return {
    handoff, form, setForm, manualSectors, setManualSectors, autoLength, setAutoLength,
    selectedHousehold, setSelectedHousehold, members, setMembers, step, setStep, error,
    setError, saving, setSaving, duplicates, setDuplicates, hhOpen, setHhOpen, makeOwner,
    setMakeOwner, formRef, navigate, residentName, patch, selectHousehold, toggleSector,
    addMember, hasSpouse, spouseMember, spouseName, spouseGender, setMember, patchMember,
    payload, register, review, total, otherParentName, Line, personSummary,
  };
}

export type ResidentIntakeState = ReturnType<typeof useResidentIntake>;
