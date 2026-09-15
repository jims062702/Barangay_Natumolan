import { type FormEvent, useRef } from "react";
import { isOffline } from "../../../shared/offline/connectivity";
import { enqueue } from "../../../shared/offline/writeQueue";
import { toast } from "../../../shared/lib/toast";
import { errorMessage } from "../../../shared/lib/api";
import { confirmAction } from "../../../shared/lib/confirm";
import { ageOf } from "../lib/rules";
import { rbimApi } from "../api";
import type { CensusAnswersState } from "./useCensusAnswers";

/**
 * Saving the form, and registering the household from it once nothing is missing.
 */
export function useCensusSubmit(ctx: CensusAnswersState) {
  const {
    clean, editing, filledLines, form, id, isDirty, matches, members, navigate, pristine,
    setGaps, setPreviewOpen, setRegistering, setSaving, snapshot,
  } = ctx;

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

      // Somebody already on the register is not re-checked; they are done.
      if (matches[index]) return;

      const missing: string[] = [];

      if (!String(mem.first_name ?? "").trim()) missing.push("a first name (Q1)");
      if (!String(mem.last_name ?? "").trim()) missing.push("a surname (Q1)");
      if (![1, 2].includes(Number(mem.q3_sex))) missing.push("sex (Q3)");
      if (!Number(mem.q5_birth_month)) missing.push("a birth month (Q5)");
      if (!Number(mem.q5_birth_year)) missing.push("a birth year (Q5)");

      if (missing.length) {
        const who = `${mem.first_name ?? ""} ${mem.last_name ?? ""}`.trim();
        gaps.push(`Line ${index + 1}${who ? ` (${who})` : ""} needs ${missing.join(", ")}.`);
      }
    });

    return gaps;
  };
  /**
   * `thenLeave` is false only when saving is a step inside submitting: the
   * office pressed Submit, the form had unsaved edits, and leaving for the
   * list halfway through would abandon the thing they actually asked for.
   */
  /**
   * Returns the record's id, which the caller may need next.
   *
   * A new form has no id until this runs — and Submit is the one caller that
   * has to know it, because registering posts to /rbim/{id}/submit. Reading
   * it back off the route afterwards is a race with the navigation.
   */
  const save = async (event?: FormEvent, thenLeave = true): Promise<string | undefined> => {
    event?.preventDefault();
    setSaving(true);

    const payload = {
      ...clean(form),
      // The counted value, not whatever the field last held — the box is
      // read-only now and the grid is the answer.
      total_members: filledLines,
      members: members
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
    };

    /*
     * With no line, the form is kept on the device and sent later.
     *
     * A census is typed in at a desk from a sheet a BHW carried house to
     * house, and it can be a long job. Losing it because the internet
     * dropped halfway would mean re-typing a whole household. So it goes in
     * the queue — the same one certificates use — and reaches the server
     * when the line returns.
     *
     * Back to the list afterwards, where the queued form can be seen waiting.
     * There is no server id to open it by yet.
     */
    if (isOffline()) {
      try {
        await enqueue(
          editing ? "put" : "post",
          editing ? `/rbim/${id}` : "/rbim",
          payload,
          `RBIM census — ${form.household_head_name || form.respondent_name || "household"}`,
        );

        pristine.current = snapshot();
        toast(
          "Census form saved on this device. It will be sent when the "
          + "connection returns — see Pending sync.",
          "info",
        );

        if (thenLeave || !editing) navigate("/population/rbim");

        return editing ? id : undefined;
      } catch (err) {
        toast(errorMessage(err), "error");

        return undefined;
      }
    }

    try {
      if (editing) {
        await rbimApi.updateCensus(id, payload);
        pristine.current = snapshot();
        toast("Census form saved.");

        /*
         * Back to the list, because that is where a saved form can be SEEN
         * to be saved. Staying on the page leaves the office looking at the
         * same boxes they were looking at before, trusting a toast that is
         * about to disappear.
         */
        if (thenLeave) navigate("/population/rbim");

        return id;
      } else {
        const r = await rbimApi.createCensus(payload);
        pristine.current = snapshot();
        toast(r.data.message);

        /*
         * A new draft goes to the list too, for the same reason a saved one
         * does: the row appearing there is what the office can SEE. Landing
         * back on the form they were already looking at asks them to trust a
         * toast that is about to disappear.
         */
        navigate(thenLeave ? "/population/rbim" : `/population/rbim/${r.data.data.id}`, {
          replace: true,
        });

        return String(r.data.data.id);
      }
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };
  /**
   * Registers the household.
   *
   * Everything on the form becomes a resident record and each line is joined
   * to the person it made, so the census and the register cannot drift into
   * being two accounts of one household. Pressing it again after an edit adds
   * only whoever is new — which is what makes a form that gains a baby six
   * months later still the right form.
   *
   * Confirmed by name first, because it is the one press in this module that
   * writes to the register.
   */
  /*
   * The record Submit is about to register.
   *
   * Held here rather than read off the route: on a brand-new form the id does
   * not exist until the save inside submitForm creates it, and the navigation
   * that puts it in the URL has not necessarily landed by the time the office
   * presses Register in the preview.
   */
  const registering_id = useRef<string | undefined>(undefined);
  const submitForm = async () => {
    /*
     * Check first, save second.
     *
     * A new form used to have no Submit button at all: it was hidden until a
     * draft existed, so the only way to reach it was to save a draft, leave,
     * and open the form again. Registering in one sitting is the ordinary
     * case, and it was the one path the screen did not offer.
     *
     * The gaps are read before anything is written so an incomplete sheet
     * does not leave a half-filled draft behind on a button press that was
     * never going to succeed.
     */
    const gapsFirst = registrationGaps();

    if (gapsFirst.length) {
      setGaps(gapsFirst);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast(`${gapsFirst.length} thing(s) still missing — listed at the top of the form.`, "warning");

      return;
    }

    // What is on screen has to be what gets registered.
    if (isDirty()) {
      const keep = await confirmAction({
        title: "Save this form first?",
        text: "The saved answers are what would be registered, not the ones on screen.",
        confirmText: "Save and continue",
        cancelText: "Stay here",
      });

      if (!keep) return;
      // Stay here: the submit is the next thing that happens.
      registering_id.current = await save(undefined, false);
    } else {
      registering_id.current = id;
    }

    if (!registering_id.current) {
      /* The save failed and said so; adding a second toast would only bury
         the first. */
      return;
    }

    setGaps([]);

    // Everything checked; now let them read it before it becomes people.
    setPreviewOpen(true);
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
        "Registering the household needs a connection. The form is saved "
        + "— submit it when the connection returns.",
        "warning",
      );
      setPreviewOpen(false);

      return;
    }

    setRegistering(true);

    try {
      const r = await rbimApi.submitCensus(registering_id.current ?? id);
      setPreviewOpen(false);
      toast(r.data.message);

      // Back to the list, where the row now reads Submitted. Seeing it there
      // is the proof; a toast on the form they were already on is not.
      navigate("/population/rbim");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setRegistering(false);
    }
  };

  return {
    registrationGaps, save, registering_id, submitForm, registerHousehold,
  };
}

export type CensusSubmitState = ReturnType<typeof useCensusSubmit>;
