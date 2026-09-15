import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { type Period, ALL_TIME, periodParams } from "../../../shared/ui/PeriodFilter";
import { errorMessage } from "../../../shared/lib/api";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import type { Resident } from "../../../shared/types";
import { CLASSIFICATIONS } from "../lib/docket";
import { luponApi } from "../api";
import type { LuponCase } from "../types";

/**
 * The state and handlers of <CaseList>, so its sections can share them.
 */
export function useLuponDocket() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<LuponCase[]>([]);

  /* Which stretch of time the docket is showing. */
  const [period, setPeriod] = useState<Period>(ALL_TIME);
  const [windowLabel, setWindowLabel] = useState<string | null>(null);
  const [years, setYears] = useState<number[]>([]);
  /* How many records each period holds, for the picker itself. */
  const [periodCounts, setPeriodCounts] = useState<Record<string, number>>();
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  // So the footer can say WHICH rows are on screen, not only the page.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState("");

  const [intakeOpen, setIntakeOpen] = useState(false);
  const [complainant, setComplainant] = useState<Resident | null>(null);
  // KP venue follows the respondent, so the complainant may live elsewhere.
  const [outsideComplainant, setOutsideComplainant] = useState(false);
  const [outsideName, setOutsideName] = useState("");
  const [outsideAddress, setOutsideAddress] = useState("");
  const [outsideContact, setOutsideContact] = useState("");
  // A dispute can name more than one respondent.
  const [respondents, setRespondents] = useState<Resident[]>([]);
  const [title, setTitle] = useState("");
  const [classification, setClassification] = useState(CLASSIFICATIONS[0]);
  const [narrative, setNarrative] = useState("");
  const [occurrenceDate, setOccurrenceDate] = useState("");
  const [place, setPlace] = useState("");
  // Starts unset so the clerk makes a deliberate choice, not an accepted default.
  const [relationship, setRelationship] = useState("");

  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is
   * reading; a first load or a filter change should still say it is
   * working. Same fetch, and only the announcement differs.
   */
  const load = (silent = false) => {
    if (!silent) setLoading(true);
    luponApi.cases({ params: { page, ...periodParams(period) } })
      .then((r) => {
        setRows(r.data.data.data ?? []);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
        setWindowLabel(r.data.data.window?.label ?? null);
        setYears(r.data.data.years ?? []);
        setPeriodCounts(r.data.data.period_counts);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, period]);

  /* A narrower window almost never has as many pages, and page 4 of a
     one-page result is an empty docket that looks like no cases at all. */
  const changePeriod = (next: Period) => {
    setPeriod(next);
    setPage(1);
  };

  // Live updates without a manual refresh.
  useAutoRefresh(() => load(true), REFRESH.staff);

  /*
   * Somebody else's change, about a second after they make it.
   *
   * The timer above stays as a backstop: if the pulse cannot be
   * reached the page is a few seconds stale rather than frozen.
   */
  usePulse("lupon_cases", () => load(true));

  /** Clears the intake draft. Used on cancel and after a successful file. */
  const resetIntake = () => {
    setTitle("");
    setNarrative("");
    setClassification(CLASSIFICATIONS[0]);
    setComplainant(null);
    setOutsideComplainant(false);
    setOutsideName("");
    setOutsideAddress("");
    setOutsideContact("");
    setRespondents([]);
    setOccurrenceDate("");
    setPlace("");
    setRelationship("");
  };

  const closeIntake = () => {
    setIntakeOpen(false);
    resetIntake();
  };

  const intake = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(await confirmAction({ title: "File this Lupon case?", confirmText: "Yes, file case" }))) return;
    setBlocked("");
    try {
      const response = await luponApi.fileComplaint({
        case_title: title,
        case_classification: classification,
        ...(outsideComplainant
          ? {
              complainant_name: outsideName,
              complainant_address: outsideAddress || undefined,
              complainant_contact: outsideContact || undefined,
            }
          : { complainant_id: complainant?.id }),
        respondent_ids: respondents.map((r) => r.id),
        complaint_narrative: narrative,
        date_of_occurrence: occurrenceDate,
        place_of_occurrence: place,
        relationship_nature: relationship,
      });
      setIntakeOpen(false);
      resetIntake();
      // Land the clerk on the case itself — jurisdiction screening, hearings,
      // mediation and settlement all happen there, and a case left sitting in
      // the docket is a case nobody is working.
      navigate(`/lupon/cases/${response.data.data.id}`);
    } catch (err) {
      const message = errorMessage(err);
      if (message.toLowerCase().includes("vawc")) {
        setIntakeOpen(false);
        setBlocked(message);
      } else {
        toast(message);
      }
    }
  };

  return {
    navigate, rows, setRows, period, setPeriod, windowLabel, setWindowLabel, years, setYears,
    periodCounts, setPeriodCounts, page, setPage, lastPage, setLastPage, total, setTotal,
    loading, setLoading, blocked, setBlocked, intakeOpen, setIntakeOpen, complainant,
    setComplainant, outsideComplainant, setOutsideComplainant, outsideName, setOutsideName,
    outsideAddress, setOutsideAddress, outsideContact, setOutsideContact, respondents,
    setRespondents, title, setTitle, classification, setClassification, narrative,
    setNarrative, occurrenceDate, setOccurrenceDate, place, setPlace, relationship,
    setRelationship, load, changePeriod, resetIntake, closeIntake, intake,
  };
}

export type LuponDocketState = ReturnType<typeof useLuponDocket>;
