import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { type Period, ALL_TIME, periodParams } from "../../../shared/ui/PeriodFilter";
import { errorMessage } from "../../../shared/lib/api";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { isOffline } from "../../../shared/offline/connectivity";
import { enqueue, pendingFor } from "../../../shared/offline/writeQueue";
import type { Resident } from "../../../shared/types";
import { CLASSIFICATIONS } from "../lib/docket";
import { screenComplaint } from "../lib/jurisdictionScreen";
import { luponApi } from "../api";
import type { LuponCase } from "../types";

/** A name for a record only this device knows about yet. */
function newLocalName(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The complaints this device filed that the server has not seen.
 *
 * Shaped like a case so the docket can render them beside the real ones.
 * The id is NEGATIVE and the number says "Not yet sent": both are there so
 * nothing downstream can mistake one of these for a docketed case — there is
 * no KP number until the server issues one, and inventing one here would put
 * a number on a case that two desks could both claim.
 */
async function queuedCases(): Promise<LuponCase[]> {
  const jobs = await pendingFor("/lupon/cases");

  return jobs.map((job, index) => {
    const body = job.body as Record<string, unknown>;

    return {
      id: -(index + 1),
      case_number: "Not yet sent",
      case_title: String(body.case_title ?? "Untitled complaint"),
      case_classification: String(body.case_classification ?? ""),
      complainant_display_name: String(body.complainant_name ?? "—"),
      jurisdiction_status: "Waiting to be sent",
      current_stage: "Waiting to be sent",
      date_filed: new Date(job.createdAt).toISOString(),
      respondent_display_names: String(body.respondent_display_names ?? ""),
    } satisfies LuponCase;
  });
}

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
      .then(async (r) => {
        const served = (r.data.data.data ?? []) as LuponCase[];
        /*
         * Cases filed here that the server has not been told about yet, in
         * front of the ones it has.
         *
         * Without this a clerk files a complaint with no line, is told it
         * was recorded, opens the docket it belongs in — and finds it empty.
         * Nothing has gone wrong and every signal on the screen says it has.
         */
        setRows([...(await queuedCases()), ...served]);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
        setWindowLabel(r.data.data.window?.label ?? null);
        setYears(r.data.data.years ?? []);
        setPeriodCounts(r.data.data.period_counts);
      })
      .catch(async () => {
        /* No line and nothing held for this page: the docket is still what
           this device has filed, which is not nothing. */
        setRows(await queuedCases());
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

    const body = {
        /* One field on the form, two columns on the record: the docket,
           the KP forms and every report already read case_title, so it
           follows the classification rather than being asked twice. */
        case_title: classification,
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
    };

    /*
     * With no line, the same gates run here.
     *
     * The server screens every one of these again when the job is sent, so
     * this is not the barangay's guarantee — it is what stops the clerk
     * telling two people their case is filed when it is one the Lupon may
     * not hear. A VAWC matter in particular must never sit in a queue
     * waiting to be refused.
     */
    if (isOffline()) {
      const screened = screenComplaint(
        classification,
        narrative,
        respondents,
        outsideComplainant ? null : complainant?.id ?? null,
      );

      if (screened.refusal) {
        if (screened.vawc) {
          setIntakeOpen(false);
          setBlocked(screened.refusal);
        } else {
          toast(screened.refusal, "error");
        }

        return;
      }

      await enqueue(
        "post",
        "/lupon/cases",
        {
          ...body,
          /* Only for the docket row while it waits — the server ignores it. */
          complainant_name: outsideComplainant
            ? outsideName
            : [complainant?.first_name, complainant?.last_name].filter(Boolean).join(" "),
          respondent_display_names: respondents
            .map((r) => [r.first_name, r.last_name].filter(Boolean).join(" "))
            .join(", "),
        },
        `Lupon complaint — ${classification}`,
        /* Named, so a hearing or a settlement recorded on this case before
           the line returns can say which case it belongs to. */
        { produces: `lupon-case:${newLocalName()}` },
      );

      setIntakeOpen(false);
      resetIntake();
      toast(
        "Filed on this device. It gets its KP case number when the connection "
        + "returns and it reaches the office record — see Pending sync.",
        "info",
      );
      load();

      return;
    }

    try {
      const response = await luponApi.fileComplaint(body);
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
    setRespondents, classification, setClassification, narrative,
    setNarrative, occurrenceDate, setOccurrenceDate, place, setPlace, relationship,
    setRelationship, load, changePeriod, resetIntake, closeIntake, intake,
  };
}

export type LuponDocketState = ReturnType<typeof useLuponDocket>;
