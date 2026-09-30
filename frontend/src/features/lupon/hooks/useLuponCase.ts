import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { usePulse } from "../../../shared/hooks/usePulse";
import { errorMessage } from "../../../shared/lib/api";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import { localNow } from "../lib/caseStages";
import { luponApi } from "../api";
import type { LuponCase } from "../types";
import { usePageLoad } from "../../../shared/ui/PageLoad";

/**
 * The state and handlers of <CaseDetail>, so its sections can share them.
 */
export function useLuponCase() {
  const { id } = useParams();
  const [caseData, setCaseData] = useState<LuponCase | null>(null);
  /* The page's skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();

  /* When the case was opened: the date the hearing forms start from. */
  const [openedAt] = useState(localNow);
  const [openedOn] = useState(() => new Date().toISOString().slice(0, 10));

  const [mediationOpen, setMediationOpen] = useState(false);
  const [mediationDate, setMediationDate] = useState(openedAt);
  const [attendance, setAttendance] = useState("Both Present");
  const [mediationOutcome, setMediationOutcome] = useState("Settlement Reached");
  const [mediationNotes, setMediationNotes] = useState("");

  const [conciliationOpen, setConciliationOpen] = useState(false);
  const [conciliationDate, setConciliationDate] = useState(openedAt);
  // Exactly three, per the Local Government Code — one field each, so the
  // panel's composition is explicit rather than a comma-separated guess.
  const [pangkat, setPangkat] = useState(["", "", ""]);
  const [conciliationOutcome, setConciliationOutcome] = useState("Settlement");

  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settlementType, setSettlementType] = useState("Amicable Settlement");
  const [terms, setTerms] = useState("");
  const [dateAgreed, setDateAgreed] = useState(openedOn);
  const [complianceDeadline, setComplianceDeadline] = useState("");

  /*
   * Each hearing form's typing, kept per case until it is saved or
   * discarded — a stray click outside the dialog does not cost the minutes
   * of a hearing. Saved, the form goes back to blank for the next one.
   */
  const blankMediation = { date: openedAt, attendance: "Both Present", outcome: "Settlement Reached", notes: "" };
  const resetMediation = () => {
    setMediationDate(blankMediation.date);
    setAttendance(blankMediation.attendance);
    setMediationOutcome(blankMediation.outcome);
    setMediationNotes("");
  };
  const mediationDraft = useModalDraft(
    id ? `lupon-mediation:${id}` : null,
    mediationOpen,
    { date: mediationDate, attendance, outcome: mediationOutcome, notes: mediationNotes },
    (kept) => {
      const k = { ...blankMediation, ...kept };
      setMediationDate(k.date);
      setAttendance(k.attendance);
      setMediationOutcome(k.outcome);
      setMediationNotes(k.notes);
    },
    { blank: blankMediation, reset: resetMediation },
  );

  const blankConciliation = { date: openedAt, pangkat: ["", "", ""], outcome: "Settlement" };
  const resetConciliation = () => {
    setConciliationDate(blankConciliation.date);
    setPangkat(["", "", ""]);
    setConciliationOutcome(blankConciliation.outcome);
  };
  const conciliationDraft = useModalDraft(
    id ? `lupon-conciliation:${id}` : null,
    conciliationOpen,
    { date: conciliationDate, pangkat, outcome: conciliationOutcome },
    (kept) => {
      const k = { ...blankConciliation, ...kept };
      setConciliationDate(k.date);
      setPangkat(Array.isArray(k.pangkat) && k.pangkat.length === 3 ? k.pangkat : ["", "", ""]);
      setConciliationOutcome(k.outcome);
    },
    { blank: blankConciliation, reset: resetConciliation },
  );

  const blankSettlement = { type: "Amicable Settlement", terms: "", dateAgreed: openedOn, deadline: "" };
  const resetSettlement = () => {
    setSettlementType(blankSettlement.type);
    setTerms("");
    setDateAgreed(blankSettlement.dateAgreed);
    setComplianceDeadline("");
  };
  const settlementDraft = useModalDraft(
    id ? `lupon-settlement:${id}` : null,
    settlementOpen,
    { type: settlementType, terms, dateAgreed, deadline: complianceDeadline },
    (kept) => {
      const k = { ...blankSettlement, ...kept };
      setSettlementType(k.type);
      setTerms(k.terms);
      setDateAgreed(k.dateAgreed);
      setComplianceDeadline(k.deadline);
    },
    { blank: blankSettlement, reset: resetSettlement },
  );

  /* Saved: forget the draft, blank the form, close it. */
  const finishMediation = () => {
    mediationDraft.clear();
    resetMediation();
    setMediationOpen(false);
  };
  const finishConciliation = () => {
    conciliationDraft.clear();
    resetConciliation();
    setConciliationOpen(false);
  };
  const finishSettlement = () => {
    settlementDraft.clear();
    resetSettlement();
    setSettlementOpen(false);
  };

  const load = () => {
    luponApi.caseFile(id)
      .then((r) => {
        setCaseData(r.data.data);
        pageLoad.done();
      })
      .catch((error) => pageLoad.fail(error));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /*
   * Somebody else's change, about a second after they make it.
   *
   * Two Lupon staff can have the same case open: one presses Paid on
   * seeing the receipt, and the other's summons button should wake up
   * without a reload.
   */
  usePulse("lupon_cases", load);

  /** Confirms, sends the change, closes its form and reloads the case. */
  const post = async (request: () => Promise<{ data: { message?: string } }>, close?: () => void, message = "Saved.") => {
    if (!(await confirmAction({ title: "Save this change to the case?", confirmText: "Yes, save" }))) return;
    try {
      const response = await request();
      close?.();
      toast(response.data.message ?? message);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return {
    pageLoad,
    id, caseData, setCaseData, mediationOpen, setMediationOpen,
    mediationDate, setMediationDate, attendance, setAttendance, mediationOutcome,
    setMediationOutcome, mediationNotes, setMediationNotes, conciliationOpen,
    setConciliationOpen, conciliationDate, setConciliationDate, pangkat, setPangkat,
    conciliationOutcome, setConciliationOutcome, settlementOpen, setSettlementOpen,
    settlementType, setSettlementType, terms, setTerms, dateAgreed, setDateAgreed,
    complianceDeadline, setComplianceDeadline, load, post, mediationDraft, conciliationDraft,
    settlementDraft, finishMediation, finishConciliation, finishSettlement,
  };
}

export type LuponCaseState = ReturnType<typeof useLuponCase>;
