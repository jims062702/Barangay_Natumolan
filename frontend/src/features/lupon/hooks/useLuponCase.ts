import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/api";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { localNow } from "../lib/caseStages";
import { luponApi } from "../api";
import type { LuponCase } from "../types";

/**
 * The state and handlers of <CaseDetail>, so its sections can share them.
 */
export function useLuponCase() {
  const { id } = useParams();
  const [caseData, setCaseData] = useState<LuponCase | null>(null);

  const [hearingOpen, setHearingOpen] = useState(false);
  const [hearingType, setHearingType] = useState("Mediation");
  const [hearingAt, setHearingAt] = useState("");
  const [summons, setSummons] = useState(true);

  const [mediationOpen, setMediationOpen] = useState(false);
  const [mediationDate, setMediationDate] = useState(localNow);
  const [attendance, setAttendance] = useState("Both Present");
  const [mediationOutcome, setMediationOutcome] = useState("Settlement Reached");
  const [mediationNotes, setMediationNotes] = useState("");

  const [conciliationOpen, setConciliationOpen] = useState(false);
  const [conciliationDate, setConciliationDate] = useState(localNow);
  // Exactly three, per the Local Government Code — one field each, so the
  // panel's composition is explicit rather than a comma-separated guess.
  const [pangkat, setPangkat] = useState(["", "", ""]);
  const [conciliationOutcome, setConciliationOutcome] = useState("Settlement");

  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settlementType, setSettlementType] = useState("Amicable Settlement");
  const [terms, setTerms] = useState("");
  const [dateAgreed, setDateAgreed] = useState(new Date().toISOString().slice(0, 10));
  const [complianceDeadline, setComplianceDeadline] = useState("");

  const load = () => {
    luponApi.caseFile(id).then((r) => setCaseData(r.data.data)).catch(() => undefined);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
    id, caseData, setCaseData, hearingOpen, setHearingOpen, hearingType, setHearingType,
    hearingAt, setHearingAt, summons, setSummons, mediationOpen, setMediationOpen,
    mediationDate, setMediationDate, attendance, setAttendance, mediationOutcome,
    setMediationOutcome, mediationNotes, setMediationNotes, conciliationOpen,
    setConciliationOpen, conciliationDate, setConciliationDate, pangkat, setPangkat,
    conciliationOutcome, setConciliationOutcome, settlementOpen, setSettlementOpen,
    settlementType, setSettlementType, terms, setTerms, dateAgreed, setDateAgreed,
    complianceDeadline, setComplianceDeadline, load, post,
  };
}

export type LuponCaseState = ReturnType<typeof useLuponCase>;
