import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { type Period, ALL_TIME, periodParams } from "../../../shared/ui/PeriodFilter";
import { errorMessage } from "../../../shared/lib/api";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import { isOffline } from "../../../shared/offline/connectivity";
import { enqueue, pendingFor } from "../../../shared/offline/writeQueue";
import type { Resident } from "../../../shared/types";
import { CLASSIFICATIONS } from "../lib/docket";
import { screenComplaint } from "../lib/jurisdictionScreen";
import { luponApi } from "../api";
import type { LuponCase } from "../types";
import { usePageLoad } from "../../../shared/ui/PageLoad";

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
  /* The page's skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();
  const [blocked, setBlocked] = useState("");
  /*
   * What the clerk typed into the docket's search box.
   *
   * A complainant at the counter holds a slip with "KP-2026-0003" on it;
   * the docket could be filtered by stage and period but not searched, so
   * that number found nothing and the list had to be paged through.
   */
  const [search, setSearch] = useState("");

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
    luponApi.cases({ params: { page, search: search.trim() || undefined, ...periodParams(period) } })
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
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    /* Debounced: typing "KP-2026-0003" is twelve keystrokes, and twelve
       requests racing each other can land out of order and show the
       results for "KP-20" last. */
    const timer = setTimeout(() => load(), search ? 300 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, period, search]);

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

  /*
   * THE INTAKE IS KEPT AS IT IS TYPED.
   *
   * Closing the modal used to throw everything away. A narrative half-written
   * when somebody else walks up to the counter, or a tab refreshed by
   * accident, cost the clerk the whole complaint — and the complainant had
   * to tell it again.
   *
   * Kept per SIGNED-IN ACCOUNT, because this is a shared office computer: a
   * draft left by one Lupon secretary must not open in front of the next
   * person who signs in. Cleared on a successful file, and on Discard.
   *
   * Lupon only. A VAWC intake is never stored on the device — see the offline
   * policy — and nothing here reaches it.
   */
  const blankIntake = {
    complainant: null as Resident | null, outsideComplainant: false, outsideName: "", outsideAddress: "",
    outsideContact: "", respondents: [] as Resident[], classification: CLASSIFICATIONS[0] as string,
    narrative: "", occurrenceDate: "", place: "", relationship: "",
  };

  const resetFields = () => {
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

  /* Per signed-in account (formDraft's owner), and gone at logout. */
  const intakeDraft = useModalDraft(
    "lupon-intake",
    intakeOpen,
    {
      complainant, outsideComplainant, outsideName, outsideAddress, outsideContact,
      respondents, classification, narrative, occurrenceDate, place, relationship,
    },
    (kept) => {
      const d = { ...blankIntake, ...kept };
      setComplainant(d.complainant);
      setOutsideComplainant(Boolean(d.outsideComplainant));
      setOutsideName(d.outsideName);
      setOutsideAddress(d.outsideAddress);
      setOutsideContact(d.outsideContact);
      setRespondents(d.respondents ?? []);
      setClassification(d.classification);
      setNarrative(d.narrative);
      setOccurrenceDate(d.occurrenceDate);
      setPlace(d.place);
      setRelationship(d.relationship);
    },
    { blank: blankIntake, reset: resetFields },
  );

  /** The complaint is filed: the form and its draft start over. */
  const resetIntake = () => {
    intakeDraft.clear();
    resetFields();
  };

  /*
   * A matter the Lupon may not hear because it is VAWC: its details are not
   * kept on this device, even as a draft. It goes to the VAWC desk, whose
   * records never touch the disk.
   */
  const dropVawcMatter = () => {
    intakeDraft.clear();
    resetFields();
  };

  /*
   * Closing KEEPS the draft. That is the point of it: the clerk steps away,
   * closes the form, and comes back to the complaint as they left it.
   * Throwing it away is `discardIntake`, and it asks first.
   */
  const closeIntake = () => setIntakeOpen(false);

  const discardIntake = async () => {
    if (!(await confirmAction({
      title: "Discard this complaint?",
      text: "Everything typed into the form will be cleared.",
      confirmText: "Yes, discard",
      danger: true,
    }))) return;
    intakeDraft.discard();
    setIntakeOpen(false);
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
          dropVawcMatter();
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
      /*
       * The number, said out loud.
       *
       * It jumped straight to the case, and the case number sat in a page
       * header nobody was reading yet. It is the one thing the complainant
       * leaves the counter holding — written on their slip, used to ask
       * about the case later, and typed into the search box above to find
       * it again.
       */
      toast(`Filed as ${response.data.data.case_number}. Give this number to the complainant.`);
      // Land the clerk on the case itself — jurisdiction screening, hearings,
      // mediation and settlement all happen there, and a case left sitting in
      // the docket is a case nobody is working.
      navigate(`/lupon/cases/${response.data.data.id}`);
    } catch (err) {
      const message = errorMessage(err);
      if (message.toLowerCase().includes("vawc")) {
        dropVawcMatter();
        setIntakeOpen(false);
        setBlocked(message);
      } else {
        toast(message);
      }
    }
  };

  return {
    pageLoad,
    navigate, rows, setRows, period, setPeriod, windowLabel, setWindowLabel, years, setYears,
    periodCounts, setPeriodCounts, page, setPage, lastPage, setLastPage, total, setTotal,
    loading, setLoading, blocked, setBlocked, intakeOpen, setIntakeOpen, complainant,
    search, setSearch, discardIntake,
    setComplainant, outsideComplainant, setOutsideComplainant, outsideName, setOutsideName,
    outsideAddress, setOutsideAddress, outsideContact, setOutsideContact, respondents,
    setRespondents, classification, setClassification, narrative,
    setNarrative, occurrenceDate, setOccurrenceDate, place, setPlace, relationship,
    setRelationship, load, changePeriod, resetIntake, closeIntake, intake, intakeDraft,
  };
}

export type LuponDocketState = ReturnType<typeof useLuponDocket>;
