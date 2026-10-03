import { useState } from "react";
import {
  FiCheck,
  FiEdit2,
  FiEye,
  FiPlus,
  FiClock,
  FiFileText,
  FiLock,
  FiAlertCircle,
  FiAlertTriangle,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import { formatWallClock, parseWallClock } from "../../../../shared/lib/datetime";
import type { LuponCaseState } from "../../hooks/useLuponCase";
import type { LuponCase, LuponHearing } from "../../types";
import { useAuth } from "../../../../shared/auth/AuthContext";
import { worksSitting, today } from "../../lib/hearings";
import { MinutesModal } from "../hearings/MinutesModal";
import { EditHearingTimeModal } from "../hearings/EditHearingTimeModal";
import { confirmWithReason } from "../../../../shared/lib/confirm";
import { errorMessage } from "../../../../shared/lib/api";
import { toast } from "../../../../shared/lib/toast";
import { luponApi } from "../../api";

/**
 * Computes dynamic hearing status according to real-time wall-clock schedule:
 * - Future date: "Upcoming"
 * - Today before start time: "Today"
 * - Today during hearing duration (2 hours): "On-going"
 * - Today after hearing duration or past date: "Completed"
 */
export function getHearingDisplayStatus(hearing: LuponHearing): {
  label: "Upcoming" | "Today" | "On-going" | "Completed" | "Cancelled";
  tone: string;
} {
  if (hearing.status === "Cancelled") {
    return { label: "Cancelled", tone: "bg-gray-100 text-gray-500 border border-gray-200" };
  }
  if (hearing.status === "Completed") {
    return { label: "Completed", tone: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
  }

  if (hearing.dynamic_status) {
    const toneMap: Record<string, string> = {
      Upcoming: "bg-purple-100 text-purple-700 border border-purple-200",
      Today: "bg-amber-100 text-amber-800 border border-amber-300 font-bold",
      "On-going": "bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold",
      Completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      Cancelled: "bg-gray-100 text-gray-500 border border-gray-200",
    };
    return {
      label: hearing.dynamic_status,
      tone: toneMap[hearing.dynamic_status] || "bg-primary/10 text-primary border border-primary/20",
    };
  }

  if (!hearing.scheduled_at) {
    return { label: "Upcoming", tone: "bg-purple-100 text-purple-700 border border-purple-200" };
  }

  const now = new Date();
  const todayManila = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const hearingDate = hearing.scheduled_at.slice(0, 10);

  if (hearingDate > todayManila) {
    return { label: "Upcoming", tone: "bg-purple-100 text-purple-700 border border-purple-200" };
  }
  if (hearingDate < todayManila) {
    return { label: "Completed", tone: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
  }

  const [curH, curM] = now
    .toLocaleTimeString("en-GB", { timeZone: "Asia/Manila", hour12: false })
    .split(":")
    .map(Number);
  const curMins = curH * 60 + curM;

  const startH = Number(hearing.scheduled_at.slice(11, 13));
  const startM = Number(hearing.scheduled_at.slice(14, 16));
  const startMins = isNaN(startH) ? 8 * 60 : startH * 60 + (isNaN(startM) ? 0 : startM);
  const endMins = startMins + 120; // 2-hour duration

  if (curMins < startMins) {
    return { label: "Today", tone: "bg-amber-100 text-amber-800 border border-amber-300 font-bold" };
  }
  if (curMins >= startMins && curMins <= endMins) {
    return { label: "On-going", tone: "bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold" };
  }
  return { label: "Completed", tone: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
}

/**
 * Hearings schedule card:
 * - Dynamic Statuses: Upcoming, Today, On-going, Completed
 * - Show more / Show less toggle to keep card height compact & proportional
 * - Always shows Punong Barangay (Tuesdays) and Lupon (Thursdays, locked when in PB stage)
 */
export function HearingsCard({ ctx, caseData }: { ctx: LuponCaseState; caseData: LuponCase }) {
  const { setMediationOpen, setConciliationOpen, load } = ctx;
  const { user } = useAuth();
  const isPb = user?.role === "Punong Barangay";
  const isLuponStaff = user?.office === "Lupon" || user?.office === "Admin";

  const [selectedHearing, setSelectedHearing] = useState<LuponHearing | null>(null);
  const [minutesMode, setMinutesMode] = useState<"view" | "edit">("view");
  const [timeEditHearing, setTimeEditHearing] = useState<LuponHearing | null>(null);

  // Show more / Show less state for compact height
  const [showAllPb, setShowAllPb] = useState(false);
  const [showAllLupon, setShowAllLupon] = useState(false);

  const openMinutes = (hearing: LuponHearing, mode: "view" | "edit") => {
    setSelectedHearing(hearing);
    setMinutesMode(mode);
  };

  const allHearings = [...(caseData.hearings ?? [])].sort(
    (a, b) => (parseWallClock(a.scheduled_at)?.getTime() ?? 0) - (parseWallClock(b.scheduled_at)?.getTime() ?? 0),
  );

  const pbHearings = allHearings.filter((h) => h.hearing_type === "Mediation");
  const luponHearings = allHearings.filter((h) => h.hearing_type === "Conciliation");

  const completedPbCount = pbHearings.filter(
    (h) => h.status === "Completed" || getHearingDisplayStatus(h).label === "Completed",
  ).length;
  const completedLuponCount = luponHearings.filter(
    (h) => h.status === "Completed" || getHearingDisplayStatus(h).label === "Completed",
  ).length;
  const unsettledLuponCount = luponHearings.filter(
    (h) => (h.status === "Completed" || getHearingDisplayStatus(h).label === "Completed") && h.outcome && h.outcome !== "Agreement",
  ).length;

  const isLuponStage = ["For Lupon Summons", "Conciliation", "CFA"].includes(caseData.current_stage);
  const isSettled = caseData.current_stage === "Settled";
  const isCfa = caseData.current_stage === "CFA";
  const isEligibleForLupon = completedPbCount >= 3 || isLuponStage;
  const isCfaEligible = isCfa || (isLuponStage && unsettledLuponCount >= 3);

  const certify = async () => {
    const reason = await confirmWithReason({
      title: "Certify this case to file action?",
      text: "The case closes at the Lupon and the complainant may take it to court.",
      placeholder: "e.g. The parties failed to reach an agreement after three conciliation sittings.",
      required: "Say what the certification rests on.",
      confirmText: "Yes, certify",
      danger: true,
    });
    if (reason === null) return;

    try {
      const response = await luponApi.certifyToFileAction(caseData.id, { reason });
      toast(response.data.message ?? "Certified to file action.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  // Find active hearing index for PB
  const activePbIndex = Math.max(
    0,
    pbHearings.findIndex((h) => getHearingDisplayStatus(h).label !== "Completed"),
  );

  // Find active hearing index for Lupon
  const activeLuponIndex = Math.max(
    0,
    luponHearings.findIndex((h) => getHearingDisplayStatus(h).label !== "Completed"),
  );

  const renderHearingItem = (hearing: LuponHearing, index: number) => {
    const hasMin = !!(
      (hearing.minutes && hearing.minutes.trim()) ||
      (hearing.proceedings_notes && hearing.proceedings_notes.trim())
    );
    const canEdit = worksSitting(user, hearing);
    const isUpcoming =
      hearing.status === "Scheduled" &&
      hearing.scheduled_at &&
      hearing.scheduled_at.slice(0, 10) > today();

    const hearingNumber = hearing.hearing_sequence ?? index + 1;
    const title =
      hearing.hearing_title ??
      (hearing.hearing_type === "Mediation"
        ? `Punong Barangay Hearing #${hearingNumber}`
        : `Lupon Hearing #${hearingNumber}`);

    const hearingDate = parseWallClock(hearing.scheduled_at);
    const dateFormatted = hearingDate && !isNaN(hearingDate.getTime())
      ? hearingDate.toLocaleDateString("en-PH", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";

    const timeRange = hearing.schedule_time_range || formatWallClock(hearing.scheduled_at);
    const scheduleTime = dateFormatted
      ? `${dateFormatted} · ${timeRange}`
      : (hearing.formatted_schedule || timeRange);

    const displayStatus = getHearingDisplayStatus(hearing);

    return (
      <li key={hearing.id} className="rounded-xl bg-secondary p-3 text-xs border border-gray/40">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-bold text-dark">{title}</p>
            {hearing.schedule_time_range && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                {hearing.schedule_time_range}
              </span>
            )}
          </div>
          {/* Dynamic Status Badge: Upcoming, Today, On-going, Completed */}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${displayStatus.tone}`}
          >
            {displayStatus.label === "On-going" && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
            )}
            {displayStatus.label}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600">
          <p className="flex items-center gap-1 font-medium">
            <FiClock className="h-3 w-3 text-gray-400" />
            {scheduleTime}
          </p>

          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
              hearing.summons_issued
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {hearing.summons_status_summary ?? (hearing.summons_issued ? "Summons issued" : "Summons prepared")}
          </span>
        </div>

        {/* Summons party-level breakdown */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-gray-500 bg-white/70 rounded-md px-2 py-1 border border-gray/30">
          <span>
            <strong className="text-dark">Complainant:</strong>{" "}
            <span className={hearing.summons_issued ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
              {hearing.complainant_summons_status ?? (hearing.summons_issued ? "Issued" : "Prepared")}
            </span>
          </span>
          <span className="text-gray-300">|</span>
          <span>
            <strong className="text-dark">Respondent:</strong>{" "}
            <span className={hearing.summons_issued ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
              {hearing.respondent_summons_status ?? (hearing.summons_issued ? "Issued" : "Prepared")}
            </span>
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
          {!isUpcoming && (
            hasMin ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                <FiCheck className="h-2.5 w-2.5" />
                Minutes recorded
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                Minutes not yet recorded
              </span>
            )
          )}

          {hearing.outcome && (
            <p className="text-[11px] font-semibold text-primary">Outcome: {hearing.outcome}</p>
          )}
        </div>

        {(hearing.status === "Scheduled" || (!isUpcoming && (hasMin || canEdit))) && (
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-gray-200/60 pt-1.5">
            <div className="flex items-center gap-3">
              {hasMin && (
                <button
                  type="button"
                  onClick={() => openMinutes(hearing, "view")}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-dark"
                >
                  <FiEye className="h-3 w-3" />
                  View Minutes
                </button>
              )}
              {canEdit && !isUpcoming && (
                <button
                  type="button"
                  onClick={() => openMinutes(hearing, "edit")}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  {hasMin ? <FiEdit2 className="h-3 w-3" /> : <FiPlus className="h-3 w-3" />}
                  {hasMin ? "Edit Minutes" : "Add Minutes"}
                </button>
              )}
            </div>

            {hearing.status === "Scheduled" && (
              <button
                type="button"
                onClick={() => setTimeEditHearing(hearing)}
                className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-dark hover:underline"
              >
                <FiClock className="h-3 w-3" />
                Edit Hour
              </button>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <Card title="Hearings schedule">
      {/* 1. CURRENT STAGE BANNER */}
      <div
        className={`mb-3.5 rounded-xl border p-3 ${
          isLuponStage
            ? "border-purple-200 bg-purple-50/70"
            : isSettled
            ? "border-emerald-200 bg-emerald-50/70"
            : isCfa
            ? "border-rose-200 bg-rose-50/70"
            : "border-blue-200 bg-blue-50/70"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Current Stage
            </span>
            <h3 className="text-sm font-bold text-dark">
              {isLuponStage
                ? "Lupon (Conciliation)"
                : isSettled
                ? "Settled (Amicable Settlement)"
                : isCfa
                ? "Certificate to File Action (CFA)"
                : "Punong Barangay (Mediation)"}
            </h3>
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
              isLuponStage
                ? "border-purple-300 bg-purple-100 text-purple-800"
                : isSettled
                ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                : isCfa
                ? "border-rose-300 bg-rose-100 text-rose-800"
                : "border-blue-300 bg-blue-100 text-blue-800"
            }`}
          >
            {isLuponStage ? "Lupon" : isSettled ? "Settled" : isCfa ? "CFA" : "Punong Barangay"}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-gray-600">
          {isLuponStage
            ? "Forwarded to Lupon for 3 Thursday conciliation hearings before the Pangkat."
            : isSettled
            ? "Amicable settlement reached. Remaining scheduled hearings stood down."
            : isCfa
            ? "Concluded without settlement. Certificate to File Action can be issued."
            : "Up to 3 mediation hearings on Tuesdays before the Punong Barangay."}
        </p>
      </div>

      {/* 2. CFA CALLOUT (IF ELIGIBLE / 3 UNSETTLED LUPON HEARINGS) */}
      {isCfaEligible && isLuponStaff && (
        <div className="mb-3.5 rounded-xl border border-rose-300 bg-rose-50/80 p-3 text-xs text-rose-950">
          <div className="flex items-start gap-2">
            <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
            <div className="flex-1">
              <p className="font-bold text-xs text-rose-900">
                {isCfa ? "Certificate to File Action Issued" : "Eligible for Certificate to File Action (CFA)"}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-700">
                {isCfa
                  ? `Case certified to court. Reason: ${caseData.closure_reason || "Concluded without settlement"}`
                  : "All 3 Lupon conciliation hearings have completed without agreement. Complainant may request CFA."}
              </p>
              {!isCfa && (
                <button
                  type="button"
                  onClick={() => void certify()}
                  className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
                >
                  <FiFileText className="h-3 w-3" />
                  Certify to file action (CFA)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. BOTH SECTIONS: PUNONG BARANGAY AND LUPON */}
      <div className="space-y-4">
        {/* SECTION 1: PUNONG BARANGAY */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-dark">Punong Barangay</h4>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                Mediation · Tuesdays
              </span>
            </div>
            <span className="text-[11px] font-medium text-gray-500">
              {Math.max(pbHearings.length, 3)}/3 hearings {completedPbCount > 0 && `(${completedPbCount} completed)`}
            </span>
          </div>

          {pbHearings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-3 text-center text-xs text-gray-400">
              No Punong Barangay hearings scheduled yet. Once filing fee is confirmed, printing the summons books 3 Tuesday hearings.
            </div>
          ) : (
            <div>
              {/* Show only active hearing if compact, or all 3 if showAllPb */}
              <ul className="space-y-2">
                {showAllPb ? (
                  pbHearings.map((h, idx) => renderHearingItem(h, idx))
                ) : (
                  renderHearingItem(pbHearings[activePbIndex] || pbHearings[0], activePbIndex)
                )}
              </ul>

              {/* Show more / Show less toggle */}
              {pbHearings.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAllPb((prev) => !prev)}
                  className="mt-2 flex w-full cursor-pointer items-center justify-between rounded-xl border border-gray-200/80 bg-gray-50/80 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                >
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <FiClock className="h-3 w-3 text-primary" />
                    {showAllPb ? "Showing all 3 hearings" : `Active: Hearing #${(pbHearings[activePbIndex]?.hearing_sequence ?? activePbIndex + 1)} (+${pbHearings.length - 1} other hearings)`}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-primary">
                    {showAllPb ? "Show less" : "Show all (3)"}
                    {showAllPb ? <FiChevronUp className="h-3 w-3" /> : <FiChevronDown className="h-3 w-3" />}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: LUPON */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-dark">Lupon</h4>
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200">
                Conciliation · Thursdays
              </span>
            </div>
            <span className="text-[11px] font-medium text-gray-500">
              {isEligibleForLupon ? `${Math.max(luponHearings.length, 3)}/3 hearings` : "0/3 hearings"} {completedLuponCount > 0 && `(${completedLuponCount} completed)`}
            </span>
          </div>

          {!isEligibleForLupon && luponHearings.length === 0 ? (
            /* Slim, compact locked card */
            <div className="rounded-xl bg-gray-50 border border-gray-200/80 px-3 py-2 text-xs text-gray-500 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FiLock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <div>
                  <span className="font-semibold text-gray-700">Lupon Stage Locked</span>
                  <span className="text-[11px] text-gray-500 block sm:inline sm:ml-1.5">
                    (Requires 3 PB mediation attempts first)
                  </span>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                Locked
              </span>
            </div>
          ) : luponHearings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-2.5 text-xs text-amber-800 flex items-start gap-2">
              <FiAlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs">Eligible for Lupon Conciliation</p>
                <p className="mt-0.5 text-[11px]">
                  Summons must be issued to Complainant and Respondent to book the 3 Thursday conciliation hearings.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <ul className="space-y-2">
                {showAllLupon ? (
                  luponHearings.map((h, idx) => renderHearingItem(h, idx))
                ) : (
                  renderHearingItem(luponHearings[activeLuponIndex] || luponHearings[0], activeLuponIndex)
                )}
              </ul>

              {luponHearings.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAllLupon((prev) => !prev)}
                  className="mt-2 flex w-full cursor-pointer items-center justify-between rounded-xl border border-gray-200/80 bg-gray-50/80 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                >
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <FiClock className="h-3 w-3 text-primary" />
                    {showAllLupon ? "Showing all 3 hearings" : `Active: Hearing #${(luponHearings[activeLuponIndex]?.hearing_sequence ?? activeLuponIndex + 1)} (+${luponHearings.length - 1} other hearings)`}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-primary">
                    {showAllLupon ? "Show less" : "Show all (3)"}
                    {showAllLupon ? <FiChevronUp className="h-3 w-3" /> : <FiChevronDown className="h-3 w-3" />}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. FOOTER ACTIONS */}
      {isPb && !isSettled && !isCfa && (
        <div className="mt-4 border-t border-gray/50 pt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMediationOpen(true)}
            className="w-full cursor-pointer rounded-full border border-primary/30 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            Record mediation
          </button>
          <button
            type="button"
            onClick={() => setConciliationOpen(true)}
            disabled={!isEligibleForLupon}
            className={`w-full rounded-full border py-1.5 text-xs font-semibold transition-colors ${
              isEligibleForLupon
                ? "cursor-pointer border-primary/30 text-primary hover:bg-primary hover:text-white"
                : "cursor-not-allowed border-gray-200 text-gray-400 bg-gray-50"
            }`}
          >
            Record conciliation
          </button>
        </div>
      )}

      {!isPb && (
        <p className="mt-4 rounded-xl border border-gray/40 bg-secondary px-3 py-2 text-[11px] leading-relaxed text-gray-500">
          The Punong Barangay records mediation outcomes on Tuesdays. The Lupon Secretary and authorized staff prepare summons and record conciliation minutes on Thursdays.
        </p>
      )}

      {selectedHearing && (
        <MinutesModal
          hearing={selectedHearing}
          isOpen={true}
          initialMode={minutesMode}
          onClose={() => setSelectedHearing(null)}
          onSaved={() => {
            setSelectedHearing(null);
            ctx.load();
          }}
        />
      )}

      <EditHearingTimeModal
        hearing={timeEditHearing}
        isOpen={timeEditHearing !== null}
        onClose={() => setTimeEditHearing(null)}
        onSaved={() => {
          setTimeEditHearing(null);
          ctx.load();
        }}
      />
    </Card>
  );
}

