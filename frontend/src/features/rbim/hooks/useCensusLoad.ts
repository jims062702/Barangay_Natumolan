import { useEffect, useState } from "react";
import { usePageLoad } from "../../../shared/ui/PageLoad";
import type { Resident } from "../../../shared/types";
import { rbimApi } from "../api";
import { HOME, BLANK_MEMBER } from "../lib/constants";
import type { CensusAnswersState } from "./useCensusAnswers";

/**
 * Loading the code lists and, when a census is opened, the census itself.
 */
export function useCensusLoad(ctx: CensusAnswersState) {
  const {
    adoptedId, editing, id, pristine, setCensusNo, setCodes, setForm, setLoading, setMatches, setMembers,
    setNotOnSheet, setStatus, snapshot,
  } = ctx;

  /*
   * The form's first load is BOTH answers: the code lists every select is
   * drawn from, and — when a census is opened — the census. The page's
   * skeleton stays until the two are in, so the form appears once, whole,
   * rather than as empty selects that fill in.
   */
  const pageLoad = usePageLoad();
  const [attempt, setAttempt] = useState(0);
  /*
   * A brand-new sheet starts clean.
   *
   * The snapshot began life as an empty string, so an untouched form
   * compared unequal to it and counted as unsaved work — pressing Verify on
   * a blank sheet asked whether to save nothing. An existing form takes its
   * own snapshot when it loads.
   */
  useEffect(() => {
    if (!editing) pristine.current = snapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    /*
     * A new form that has just saved its first draft moved to the draft's
     * address in place. What is on screen IS that draft (and may be ahead of
     * it); reading it back now would put the saved copy over the office's
     * last few keystrokes.
     */
    if (id && adoptedId.current === id) return;

    const codes = rbimApi.codeLists().then((r) => setCodes(r.data.data));
    const census = !editing ? Promise.resolve() : rbimApi.census(id)
      .then((r) => {
        const data = r.data.data;
        // A form saved through the API may carry none of these; the boxes
        // cannot be typed in, so they are filled here or not at all.
        setForm({
          ...data,
          province: data.province || HOME.province,
          city_municipality: data.city_municipality || HOME.city_municipality,
          barangay: data.barangay || HOME.barangay,
        });
        setStatus(data.status);
        setCensusNo(data.census_no);
        setMembers(data.members?.length ? data.members : [{ ...BLANK_MEMBER }]);

        // Who each line already is on the register, so the card can say so.
        const matched: Record<number, Resident | null> = {};
        (data.members ?? []).forEach((m: Record<string, unknown>, i: number) => {
          matched[i] = (m.resident as Resident) ?? null;
        });
        setMatches(matched);
        // Loaded from the server, so nothing is unsaved yet.
        pristine.current = snapshot(data, data.members ?? [{ ...BLANK_MEMBER }]);

        /*
         * And who the register says lives here.
         *
         * This is the question "Continue editing — add the rest there" is
         * asking on the office's behalf, so it is answered on arrival rather
         * than left for them to work out by opening the household in another
         * tab and comparing names by eye.
         *
         * A failure here is silence: the form is perfectly usable without
         * the offer, and an error banner about a convenience would only be
         * in the way.
         */
        if (data.census_no) {
          rbimApi.verifyHousehold({
              params: { household_number: data.census_no, census_id: id },
            })
            .then((h) => setNotOnSheet(h.data.data))
            .catch(() => setNotOnSheet(null));
        }
      });

    Promise.all([codes, census])
      .then(() => pageLoad.done(), (error) => pageLoad.fail(error))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, id, attempt]);

  return { pageLoad, retryLoad: () => setAttempt((n) => n + 1) };
}
