import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/auth/AuthContext";
import type { Resident } from "../../../shared/types";
import { HOME, BLANK_MEMBER } from "../lib/constants";
import { splitHeadName } from "../lib/rules";
import type { Codes, FormValue, Member, HouseCheck, DeathRow } from "../types";

export function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The form's answers: the household's fields, the member lines, and whether anything has changed since it was loaded.
 */
export function useCensusAnswers() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const today = todayDateString();
  const workerName = user?.name ?? "";

  const [codes, setCodes] = useState<{ member: Codes; household: Codes }>({
    member: {},
    household: {},
  });
  const [form, setForm] = useState<Record<string, FormValue>>({
    household_head_name: "",
    ...HOME,
    is_institutional: false,
    consent_given: false,
    respondent_name: "",
    consent_name: "",
    date_encoded: today,
    encoder_name: workerName,
    supervisor_name: workerName,
  });
  const [members, setMembers] = useState<Member[]>([{ ...BLANK_MEMBER }]);
  const [status, setStatus] = useState<"Draft" | "Submitted">("Draft");
  const [censusNo, setCensusNo] = useState("");
  const [matches, setMatches] = useState<Record<number, Resident | null>>({});
  const [checking, setChecking] = useState(false);
  const [houseCheck, setHouseCheck] = useState<HouseCheck | null>(null);
  /*
   * What Submit found missing. Held in state rather than shown as a toast,
   * because it is a list to work through, not a notification.
   */
  const [gaps, setGaps] = useState<string[]>([]);
  /*
   * Submitting creates people. A confirmation dialogue with a list of names
   * in it is not enough to check a form of ten against a paper sheet — the
   * office needs to see the answers, laid out the way they were typed.
   */
  const [previewOpen, setPreviewOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  /*
   * People the register already places in this household who are not on
   * this sheet.
   *
   * Checked when an existing form opens, because that is the moment the
   * office is about to add "the rest of the household" and has no way of
   * knowing who that is.
   */
  const [notOnSheet, setNotOnSheet] = useState<HouseCheck | null>(null);
  /*
   * What the form looked like when it was last saved or loaded.
   *
   * Verifying a different number throws the sheet away and starts again, so
   * something has to know whether there was anything worth keeping. A
   * snapshot compared as text is enough here — the form is small, and the
   * question is only "is this the same as what is stored".
   */
  const pristine = useRef("");
  const [saving, setSaving] = useState(false);
  /*
   * THE DRAFT, SAVED AS IT IS TYPED (2026-09-29).
   *
   * Where the last save stands — said beside Preview form, and only what
   * the server confirmed: "saved" is set when the server answered, never
   * before. `adoptedId` is the id a NEW form gave itself on its first save:
   * the address moves to it without the page reopening (see CensusRecord),
   * and the loader must not read the form back over what is being typed.
   */
  const [draftSave, setDraftSave] = useState<DraftSave>("idle");
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [draftError, setDraftError] = useState("");
  const adoptedId = useRef<string | null>(null);
  /* Preview form's own save has landed, so Submit knows which census to register. */
  const [previewReady, setPreviewReady] = useState(false);
  const [loading, setLoading] = useState(editing);
  const set = (key: string, value: FormValue) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Populate worker name and date_encoded if user profile loads after initial mount
  useEffect(() => {
    if (!user?.name || editing) return;
    setForm((prev) => {
      let changed = false;
      const next = { ...prev };
      if (!next.encoder_name) {
        next.encoder_name = user.name;
        changed = true;
      }
      if (!next.supervisor_name) {
        next.supervisor_name = user.name;
        changed = true;
      }
      if (!next.date_encoded) {
        next.date_encoded = todayDateString();
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [user?.name, editing]);

  // Name on the consent automatically tracks respondent_name
  useEffect(() => {
    if (form.consent_name !== form.respondent_name) {
      set("consent_name", form.respondent_name ?? "");
    }
  }, [form.respondent_name, form.consent_name]);
  /*
   * A list answer, read back safely.
   *
   * An older form saved before Q54–Q57 became lists holds nothing at all
   * under these keys, and a form loaded from the server holds whatever the
   * JSON column had. Neither is allowed to reach a .map().
   */
  const listOf = <T,>(key: string): T[] => (Array.isArray(form[key]) ? (form[key] as T[]) : []);
  /* An empty list is no answer, and no answer is null — not [] . */
  const setList = (key: string, next: string[] | DeathRow[]) =>
    set(key, next.length ? next : null);
  /**
   * Puts the head's name on line 1.
   *
   * Only while line 1 is still the head: once somebody has typed a different
   * name there, the grid is the record and this stops touching it. Silently
   * overwriting a line an encoder has already filled in is worse than making
   * them type the name twice.
   */
  /**
   * Line 1 IS the household head.
   *
   * The form says so in its own margin — "List HH members in this order:
   * Head, Spouse of Head, …" — and Q2 code 01 is Head. So the name is not
   * copied across on a best-effort basis; line 1 simply holds whatever the
   * head field holds, and there is no way for the two to disagree.
   *
   * An earlier version only filled line 1 while it looked untouched, so that
   * a hand-typed line would not be clobbered. That guard is what let the head
   * say "Dela Cruz, Juan" while line 1 said "Miguel": two answers to one
   * question, and no way to tell which the barangay meant.
   */
  const fillLineOneFrom = (full: string) => {
    const parts = splitHeadName(full);

    setMembers((prev) => {
      const first = prev[0] ?? { ...BLANK_MEMBER };

      return [
        {
          ...first,
          last_name: parts.last,
          first_name: parts.first,
          middle_name: parts.middle,
          // Q2 code 01. The head is the head.
          q2_relationship: 1,
        },
        ...prev.slice(1),
      ];
    });
  };
  /*
   * A yes/no, kept as 1 and 0.
   *
   * Every other answer on a line is text or one of the form's numbered
   * codes, and `setMember` turns "" into null — which is right for a box
   * somebody cleared and wrong for a switch somebody turned off. Laravel's
   * boolean rule takes 1 and 0, so the wire is happy and the type stays as
   * narrow as the other forty-four answers.
   */
  const setMemberFlag = (index: number, key: string, on: boolean) =>
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, [key]: on ? 1 : 0 } : m)));
  const setMember = (index: number, key: string, value: string) =>
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [key]: value === "" ? null : value } : m))
    );
  /**
   * Which other line on this form already carries a member's address.
   *
   * The register cannot hold one address twice, so a form that collects one
   * twice is a form that will lose a login at matching time. Both lines are
   * flagged: until one of them changes, neither is right.
   */
  const clashingLine = (index: number): number | null => {
    const email = String(members[index]?.email ?? "").trim().toLowerCase();
    if (!email) return null;

    const other = members.findIndex(
      (m, i) => i !== index && String(m.email ?? "").trim().toLowerCase() === email
    );

    return other === -1 ? null : other + 1;
  };
  // Lines with a name on them — a blank card the clerk has not filled in
  // yet is not a person.
  const filledLines = members.filter((mem) => mem.first_name || mem.last_name).length;
  /** Empty strings out, so a blank box is absent rather than an empty answer. */
  const clean = (source: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    Object.entries(source).forEach(([k, v]) => {
      if (v === "" || v === undefined) return;
      // The server owns these; sending them back invites a stale write.
      /*
        The server owns these. census_no is NOT among them: the paper form
        carries a number in its own boxes, and a clerk copying that number
        across is the point of the field — stripping it here meant the box
        accepted typing and threw it away.
      */
      if (["id", "created_at", "updated_at", "members", "resident", "recorder",
           "reviewer", "household", "status", "members_count",
           "submitted_at", "reviewed_at", "reviewed_by", "recorded_by",
           "rbim_census_id", "resident_id"].includes(k)) return;
      /*
       * A list answer — Q54 to Q57 — with its blank rows left behind.
       *
       * The lists always show one empty row to type into, and that row must
       * not travel: a household that named two diseases would otherwise be
       * recorded as naming three, the third being "". An emptied list is
       * sent as null rather than dropped, because a dropped key leaves the
       * old answer standing on the server.
       */
      if (Array.isArray(v)) {
        const rows = (v as unknown[])
          .map((row) =>
            typeof row === "string"
              ? row.trim()
              : Object.fromEntries(
                  Object.entries((row ?? {}) as Record<string, unknown>).filter(
                    ([, cell]) => String(cell ?? "").trim() !== ""
                  )
                )
          )
          .filter((row) => (typeof row === "string" ? row !== "" : Object.keys(row).length > 0));

        out[k] = rows.length ? rows : null;
        return;
      }

      out[k] = v;
    });
    return out;
  };
  /**
   * Everything a clerk could have typed, as one comparable string.
   *
   * The form NUMBER is left out on purpose. It is the thing being checked,
   * not work to be rescued — counting it meant that typing a number and
   * pressing Verify on an otherwise empty sheet asked whether to save the
   * number first, which is a question about nothing.
   */
  const snapshot = (
    f: Record<string, unknown> = form,
    mem: Member[] = members
  ) => {
    const { census_no: _ignored, ...rest } = clean(f);

    return JSON.stringify({ f: rest, m: mem.map((one) => clean(one)) });
  };
  const isDirty = () => snapshot() !== pristine.current;
  /** Nothing typed on this sheet at all — a new form's starting state. */
  const isBlankSheet = () => snapshot() === snapshot(
    {
      household_head_name: "",
      ...HOME,
      is_institutional: false,
      consent_given: false,
      respondent_name: "",
      consent_name: "",
      date_encoded: (form.date_encoded as string) || today,
      encoder_name: (form.encoder_name as string) || workerName,
      supervisor_name: (form.supervisor_name as string) || workerName,
    },
    [{ ...BLANK_MEMBER }],
  );
  /** Back to an empty sheet, keeping the number that was just checked. */
  const resetForm = (keepNumber: string) => {
    const blank = {
      census_no: keepNumber,
      household_head_name: "",
      ...HOME,
      is_institutional: false,
      consent_given: false,
      respondent_name: "",
      consent_name: "",
      date_encoded: todayDateString(),
      encoder_name: user?.name ?? "",
      supervisor_name: user?.name ?? "",
    };

    setForm(blank);
    setMembers([{ ...BLANK_MEMBER }]);
    pristine.current = snapshot(blank, [{ ...BLANK_MEMBER }]);
  };

  return {
    id, navigate, editing, codes, setCodes, form, setForm, members, setMembers, status,
    setStatus, censusNo, setCensusNo, matches, setMatches, checking, setChecking, houseCheck,
    setHouseCheck, gaps, setGaps, previewOpen, setPreviewOpen, registering, setRegistering,
    notOnSheet, setNotOnSheet, pristine, saving, setSaving, loading, setLoading, set, listOf,
    setList, fillLineOneFrom, setMemberFlag, setMember, clashingLine, filledLines, clean,
    snapshot, isDirty, isBlankSheet, resetForm,
    draftSave, setDraftSave, draftSavedAt, setDraftSavedAt, draftError, setDraftError, adoptedId,
    previewReady, setPreviewReady,
  };
}

export type CensusAnswersState = ReturnType<typeof useCensusAnswers>;

/** Where the draft's last save stands. */
export type DraftSave = "idle" | "saving" | "saved" | "error" | "offline";
