import { type FormEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { isOffline } from "../../../shared/offline/connectivity";
import { enqueue } from "../../../shared/offline/writeQueue";
import { toast } from "../../../shared/lib/toast";
import { api, errorMessage } from "../../../shared/lib/api";
import { ageOf } from "../lib/rules";
import { censusFormKey } from "../lib/formKey";
import { rbimApi } from "../api";
import { RESIDENTS_HOME } from "../../resident/lib/paths";
import type { CensusAnswersState } from "./useCensusAnswers";
import type { Member } from "../types";
import type { Resident } from "../../../shared/types";

/**
 * Saving the form as a draft, and registering the household from it once
 * nothing is missing.
 *
 * THE DRAFT IS THE SERVER'S (2026-09-29). What is typed is saved to the
 * census record itself — a Draft — as the office types (useCensusAutosave),
 * when Preview form is pressed, and when the page is left; so a refresh, a
 * trip to another page, or a closed tab finds it again, at its own address
 * and under "Draft available". Nothing is announced unless it fails: the
 * line beside Preview form says "Draft saved" only once the server has
 * answered, and a save that did not happen is said to have not happened.
 */
export function useCensusSubmit(ctx: CensusAnswersState) {
  const {
    adoptedId, clean, form, id, isBlankSheet, isDirty, matches, members, navigate, pristine,
    setCensusNo, setDraftError, setDraftSave, setDraftSavedAt, setForm, setGaps, setPreviewOpen,
    setPreviewReady, setRegistering, setSaving, snapshot, setMatches, setStatus, status,
  } = ctx;
  const location = useLocation();

  /* Registered just now: the preview stays open, so their Resident IDs can
     be issued without leaving the form. */
  const [justRegistered, setJustRegistered] = useState(false);

  /**
   * What the register still needs, line by line.
   *
   * The same rules the server applies, worked out here so the office reads
   * them on the form instead of in a toast. A toast is one sentence that
   * appears after the press and is gone four seconds later — which is how a
   * clerk ends up pressing Submit three times without ever learning that
   * line 4 has no sex on it.
   *
   * Only the lines that will actually be registered. A visiting cousin
   * switched off is nobody's missing birthday.
   */
  const registrationGaps = (): string[] => {
    const gaps: string[] = [];

    /* A draft may be saved before the head is named; it is not registered so. */
    if (!String(form.household_head_name ?? "").trim()) {
      gaps.push("The household head's name, at the top of the form.");
    }

    if (!String(form.zone_purok ?? "").trim()) {
      gaps.push("The purok, at the top of the form — every resident record carries one.");
    }

    if (!form.consent_given) {
      gaps.push("The respondent's consent, at the bottom — the census may not be used without it.");
    }

    members.forEach((mem, index) => {
      const named = String(mem.first_name ?? "").trim() || String(mem.last_name ?? "").trim();
      if (!named) return;

      // Line 1 is the head and is always registered, switch or no switch.
      const willRegister = index === 0 || Number(mem.register_as_resident ?? 1) === 1;
      if (!willRegister) return;

      const who = `${mem.first_name ?? ""} ${mem.last_name ?? ""}`.trim();

      /*
       * Somebody already on the register is not re-checked — save for the
       * one thing the census is there to put right: a birthdate the register
       * holds only as a month and a year (the imported sheet gave no day), or
       * not at all. The census date replaces it, so it has to be a whole one.
       */
      const onRegister = matches[index];
      if (onRegister) {
        if ((!onRegister.birthdate || onRegister.birthdate_is_estimated) && !mem.q5_birthdate) {
          gaps.push(`Line ${index + 1}${who ? ` (${who})` : ""} needs the full date of birth — month, day and year (Q5): `
            + "the register has only the month and year.");
        }
        return;
      }

      const missing: string[] = [];

      if (!String(mem.first_name ?? "").trim()) missing.push("a first name (Q1)");
      if (!String(mem.last_name ?? "").trim()) missing.push("a surname (Q1)");
      if (![1, 2].includes(Number(mem.q3_sex))) missing.push("sex (Q3)");
      /* The whole date (2026-09-30): a month and a year is not a birthday,
         and the profile and the certificates print the day. */
      if (!mem.q5_birthdate) {
        missing.push("a date of birth — month, day and year (Q5)");
      }

      if (missing.length) {
        gaps.push(`Line ${index + 1}${who ? ` (${who})` : ""} needs ${missing.join(", ")}.`);
      }
    });

    return gaps;
  };

  /** The census this page is — its id once the first draft is saved. */
  const savedId = useRef<string | undefined>(id);
  useEffect(() => {
    if (id) savedId.current = id;
  }, [id]);

  /* A save that finishes after the office has left must not pull them back. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  /** The form, as the server takes it. */
  const payloadOf = (f: Record<string, unknown>, mem: Member[]) => ({
    ...clean(f),
    // The counted value, not whatever the field last held — the box is
    // read-only now and the grid is the answer.
    total_members: mem.filter((m) => m.first_name || m.last_name).length,
    members: mem
      .filter((m) => m.first_name || m.last_name)
      /*
       * The age is written into the row on the way out, not held in state.
       * Keeping a derived value in state means an effect that watches Q5
       * and writes Q4, which is a render loop waiting to happen; filling
       * it here means the census line still carries the age it was read at.
       */
      .map((m, i) => ({
        ...clean(m),
        line_no: i + 1,
        q4_age: ageOf(m) ?? undefined,
      })),
  });

  /*
   * ONE SAVE AT A TIME, IN ORDER. A second save waits for the first — so a
   * new form is created ONCE, and every later save updates that same draft
   * (never a second draft for a second press or a quick typist).
   */
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const creating = useRef(false);
  const lastFailure = useRef("");
  /* Set once the office discards the draft: nothing is saved after that. */
  const discarded = useRef(false);

  const writeDraft = async (f: Record<string, unknown>, mem: Member[]): Promise<string | undefined> => {
    if (discarded.current) return undefined;

    const payload = payloadOf(f, mem);
    const sent = snapshot(f, mem);
    setDraftSave("saving");

    try {
      if (savedId.current) {
        await rbimApi.updateCensus(savedId.current, payload);
      } else {
        creating.current = true;
        const r = await rbimApi.createCensus(payload);
        const created = r.data.data as { id: number; census_no: string | null };
        savedId.current = String(created.id);
        adoptedId.current = savedId.current;
        setCensusNo(created.census_no ?? "");
        /* The number the server gave it, in its box — unless one was typed. */
        setForm((prev) => (String(prev.census_no ?? "").trim() ? prev : { ...prev, census_no: created.census_no ?? "" }));

        /*
         * Its own address now, so a refresh opens THIS draft — moved to in
         * place (the form's key rides along), not reopened.
         */
        if (mounted.current) {
          const carried = (location.state as { censusFormKey?: string } | null)?.censusFormKey;
          navigate(`/population/rbim/${created.id}`, {
            replace: true,
            state: { censusFormKey: censusFormKey(undefined, location.key, carried) },
          });
        }
      }

      pristine.current = sent;
      lastFailure.current = "";
      setDraftSave("saved");
      setDraftSavedAt(new Date());
      setDraftError("");

      return savedId.current;
    } catch (err) {
      const message = errorMessage(err);
      setDraftSave("error");
      setDraftError(message);
      /* Said once, not on every retry of the same failure. */
      if (lastFailure.current !== message) {
        toast(`The draft could not be saved: ${message}`, "error");
        lastFailure.current = message;
      }

      return undefined;
    } finally {
      creating.current = false;
    }
  };

  /** Save what is on screen now (after any save still under way). */
  const persist = (f: Record<string, unknown> = form, mem: Member[] = members): Promise<string | undefined> => {
    const run = chain.current.then(() => writeDraft(f, mem));
    chain.current = run.catch(() => undefined);

    return run;
  };

  /**
   * With no line: kept on the device and sent later — only when the office
   * asks for it (the button beside Preview form, and in the preview).
   *
   * A census is typed in at a desk from a sheet a BHW carried house to
   * house, and it can be a long job. Losing it because the internet dropped
   * halfway would mean re-typing a whole household. So it goes in the queue
   * — the same one certificates use — and reaches the server when the line
   * returns. Back to the list afterwards, where the queued form can be seen
   * waiting. It is not done by itself: a form queued on every keystroke
   * would reach the server as a dozen forms.
   */
  const saveOnDevice = async (): Promise<string | undefined> => {
    try {
      const existing = savedId.current;
      await enqueue(
        existing ? "put" : "post",
        existing ? `/rbim/${existing}` : "/rbim",
        payloadOf(form, members),
        `RBIM census — ${form.household_head_name || form.respondent_name || "household"}`,
      );

      pristine.current = snapshot();
      toast(
        "Census form saved on this device. It will be sent when the "
        + "connection returns — see Pending sync.",
        "info",
      );
      setPreviewOpen(false);
      navigate(RESIDENTS_HOME);

      return existing;
    } catch (err) {
      toast(errorMessage(err), "error");

      return undefined;
    }
  };

  /** Save now — the "save before checking another number?" question uses it. */
  const save = async (event?: FormEvent): Promise<string | undefined> => {
    event?.preventDefault();
    if (isOffline()) return saveOnDevice();

    setSaving(true);
    try {
      return await persist();
    } finally {
      setSaving(false);
    }
  };

  /*
   * LEAVING THE PAGE saves what the last few seconds typed.
   *
   *   another page in the app   the save runs on as the page closes (it
   *                             does not bring the office back here)
   *   refresh / close the tab   sent with keepalive, which the browser
   *                             finishes after the page is gone
   *
   * Read through a ref so the handlers see the form as it is NOW.
   */
  const leaving = useRef<(how: "route" | "unload") => void>(() => undefined);
  leaving.current = (how) => {
    if (discarded.current || status !== "Draft" || isOffline() || !isDirty() || isBlankSheet()) return;

    if (how === "route") {
      void persist();
      return;
    }

    /* A first save still on its way would make a second draft. */
    if (!savedId.current && creating.current) return;

    const token = localStorage.getItem("authToken");
    const existing = savedId.current;
    fetch(`${api.defaults.baseURL ?? ""}${existing ? `/rbim/${existing}` : "/rbim"}`, {
      method: existing ? "PUT" : "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payloadOf(form, members)),
    }).catch(() => undefined);
  };
  useEffect(() => {
    const onHide = () => leaving.current("unload");
    window.addEventListener("pagehide", onHide);

    return () => {
      window.removeEventListener("pagehide", onHide);
      leaving.current("route");
    };
  }, []);

  /** Hold every save while the draft is being deleted (and let go if that failed). */
  const holdSaves = (held: boolean) => {
    discarded.current = held;
  };

  /*
   * A registration can only follow a save that landed: the census it posts
   * to must be the one the preview shows.
   */
  const registering_id = useRef<string | undefined>(undefined);

  /**
   * Preview form — opens AT ONCE, on the first press.
   *
   * It used to save first and preview second, and the first save of a new
   * form moved the page to the draft's address and reopened it — so the
   * first press said "saved as a draft" and showed nothing. Now the preview
   * opens straight away and the draft is saved behind it; Submit inside the
   * preview waits for that save, and says so if it failed.
   *
   * What is still missing is listed in the preview and at the top of the
   * form (and Submit stays shut) rather than stopping the preview from
   * opening: the office can read the sheet back either way.
   */
  const submitForm = async () => {
    setGaps(registrationGaps());
    setPreviewReady(false);
    registering_id.current = undefined;
    setPreviewOpen(true);

    if (isOffline()) {
      setDraftSave("offline");
      return;
    }

    const ready = isDirty() || !savedId.current ? await persist() : savedId.current;
    registering_id.current = ready;
    setPreviewReady(Boolean(ready));
  };

  /** What Submit does once the office has read the preview and agreed. */
  const registerHousehold = async () => {
    /*
     * Registering is the one step that has to wait for the line.
     *
     * Submitting turns census lines into people on the register: it mints
     * their resident numbers, and it checks each one against the WHOLE
     * register for somebody already on it. The device holds a copy of the
     * register, but not one fresh enough to be trusted with that decision —
     * a person registered from another source since the last sync would be
     * registered twice, and that duplication is exactly what this register
     * has already suffered from.
     *
     * The form itself is safe: it is saved, on the device if not yet on the
     * server. Only turning it into people waits.
     */
    if (isOffline()) {
      toast(
        "Registering the household needs a connection. Keep the form on this "
        + "device, and submit it when the connection returns.",
        "warning",
      );

      return;
    }

    if (!registering_id.current || registrationGaps().length > 0) return;

    setRegistering(true);

    try {
      const r = await rbimApi.submitCensus(registering_id.current);
      toast(r.data.message);

      /*
       * The preview stays open, now showing who was registered and what
       * Resident ID each holds — so the office issues the IDs here instead of
       * leaving the form to find each person on the Residents page. "Back to
       * Residents & Households" is one press away.
       */
      try {
        const fresh = (await rbimApi.census(registering_id.current)).data.data;
        const matched: Record<number, Resident | null> = {};
        (fresh.members ?? []).forEach((m: Record<string, unknown>, i: number) => {
          matched[i] = (m.resident as Resident) ?? null;
        });
        setMatches(matched);
        setStatus(fresh.status);
        setJustRegistered(true);
      } catch {
        // The register has them; if the form cannot be read back, the list is where to look.
        setPreviewOpen(false);
        navigate(RESIDENTS_HOME);
      }
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setRegistering(false);
    }
  };

  return {
    registrationGaps, save, persist, saveOnDevice, holdSaves, registering_id, submitForm,
    registerHousehold, justRegistered,
  };
}

export type CensusSubmitState = ReturnType<typeof useCensusSubmit>;
