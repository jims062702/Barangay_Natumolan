import { useState, useEffect } from "react";
import {
  FiCalendar,
  FiClock,
  FiEye,
  FiFileText,
  FiPlay,
  FiPlus,
  FiPrinter,
  FiUser,
  FiCheck,
} from "react-icons/fi";
import Modal from "../../../../shared/ui/Modal";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import { formatWallClock, parseWallClock } from "../../../../shared/lib/datetime";
import { worksSitting } from "../../lib/hearings";
import { getHearingDisplayStatus } from "../case/HearingsCard";
import { luponApi } from "../../api";
import { useAuth } from "../../../../shared/auth/AuthContext";
import type { LuponCase, LuponHearing } from "../../types";
import { EditHearingTimeModal } from "./EditHearingTimeModal";

interface CaseSchedulesModalProps {
  caseFor: Partial<LuponCase> | null;
  onClose: () => void;
  onViewCaseFile?: (caseId: number) => void;
  onPrintSummons?: (hearing: LuponHearing) => void;
  onSetStartTime?: (hearing: LuponHearing) => void;
  onStartSession?: (hearing: LuponHearing) => void;
  onOpenMinutes?: (hearing: LuponHearing, mode: "view" | "edit") => void;
}

export function CaseSchedulesModal({
  caseFor,
  onClose,
  onViewCaseFile,
  onPrintSummons,
  onSetStartTime,
  onStartSession,
  onOpenMinutes,
}: CaseSchedulesModalProps) {
  const { user } = useAuth();
  const [caseDetails, setCaseDetails] = useState<Partial<LuponCase> | null>(caseFor);
  const [loading, setLoading] = useState(false);
  const [timeEditHearing, setTimeEditHearing] = useState<LuponHearing | null>(null);

  const refreshCase = () => {
    if (caseFor?.id) {
      setLoading(true);
      luponApi
        .hearingCase(caseFor.id)
        .then((res) => {
          if (res.data.data) {
            setCaseDetails(res.data.data);
          }
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    setCaseDetails(caseFor);
    refreshCase();
  }, [caseFor]);

  if (!caseFor) return null;

  const c = caseDetails || caseFor;
  const rawHearings = [...(c.hearings ?? [])];
  // Sort hearings chronologically
  const hearings = rawHearings.sort(
    (a, b) => (parseWallClock(a.scheduled_at)?.getTime() ?? 0) - (parseWallClock(b.scheduled_at)?.getTime() ?? 0)
  );

  const stageLabel =
    c.current_stage === "Mediation" || c.current_stage === "For Summons"
      ? "Punong Barangay (Mediation)"
      : c.current_stage === "Conciliation" || c.current_stage === "For Lupon Summons"
      ? "Lupon (Conciliation)"
      : c.current_stage;

  return (
    <Modal
      open={true}
      onClose={onClose}
      wide
      title={`Case #${c.case_number} — Hearing Schedules`}
    >
      <div className="space-y-4">
        {/* CASE SUMMARY BANNER */}
        <div className="rounded-xl border border-primary/20 bg-secondary/80 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Case Classification
              </span>
              <h3 className="text-base font-bold text-dark">
                {c.case_classification} {c.case_title ? `· ${c.case_title}` : ""}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                {stageLabel}
              </span>
              {c.current_stage && <StatusBadge status={c.current_stage} />}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 pt-2 border-t border-gray/40 text-xs">
            <div className="flex items-start gap-1.5 text-gray-600">
              <FiUser className="mt-0.5 h-3.5 w-3.5 text-gray-400 shrink-0" />
              <div>
                <strong className="text-dark">Complainant:</strong>{" "}
                {c.complainant_display_name || "—"}
                {c.complainant_is_resident === false && (
                  <span className="ml-1 rounded-full bg-gray px-1.5 py-0.2 text-[10px] font-semibold text-gray-500">
                    non-resident
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-start gap-1.5 text-gray-600">
              <FiUser className="mt-0.5 h-3.5 w-3.5 text-gray-400 shrink-0" />
              <div>
                <strong className="text-dark">Respondent:</strong>{" "}
                {c.respondent_display_names || "—"}
              </div>
            </div>
          </div>
        </div>

        {/* SCHEDULES SECTION */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiCalendar className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-bold text-dark">All Scheduled Hearings</h4>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 border border-gray-200">
                {hearings.length} {hearings.length === 1 ? "Sitting" : "Sittings"}
              </span>
            </div>
            {loading && (
              <span className="text-xs text-gray-400 italic">Syncing latest...</span>
            )}
          </div>

          {hearings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-xs text-gray-400">
              No hearing schedules on record for this case.
            </div>
          ) : (
            <ul className="space-y-2.5">
              {hearings.map((h, idx) => {
                const displayStatus = getHearingDisplayStatus(h);
                const hearingNumber = h.hearing_sequence ?? idx + 1;
                const title =
                  h.hearing_title ??
                  (h.hearing_type === "Mediation"
                    ? `Punong Barangay Hearing #${hearingNumber}`
                    : `Lupon Hearing #${hearingNumber}`);

                const hearingDate = parseWallClock(h.scheduled_at);
                const dateFormatted = hearingDate && !isNaN(hearingDate.getTime())
                  ? hearingDate.toLocaleDateString("en-PH", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "";

                const timeRange = h.schedule_time_range || formatWallClock(h.scheduled_at);
                const scheduleTime = dateFormatted
                  ? `${dateFormatted} · ${timeRange}`
                  : (h.formatted_schedule || timeRange);

                const hasMin = !!(
                  (h.minutes && h.minutes.trim()) ||
                  (h.proceedings_notes && h.proceedings_notes.trim())
                );
                const mine = worksSitting(user, h);

                return (
                  <li
                    key={h.id}
                    className="rounded-xl border border-gray/50 bg-secondary/40 p-3.5 transition hover:border-primary/40 hover:bg-white text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          #{hearingNumber}
                        </span>
                        <p className="font-bold text-sm text-dark">{title}</p>
                      </div>

                      {/* DYNAMIC STATUS BADGE */}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${displayStatus.tone}`}
                      >
                        {displayStatus.label === "On-going" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                        )}
                        {displayStatus.label}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                      <div className="flex items-center gap-1.5 font-medium">
                        <FiClock className="h-3.5 w-3.5 text-primary" />
                        <span>{scheduleTime}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                            h.summons_issued
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {h.summons_status_summary ??
                            (h.summons_issued ? "Summons issued" : "Summons prepared")}
                        </span>
                      </div>
                    </div>

                    {/* SUMMONS PARTY STATUS */}
                    <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-white/80 px-2.5 py-1.5 border border-gray/40 text-[11px] text-gray-600">
                      <span>
                        <strong className="text-dark">Complainant Notice:</strong>{" "}
                        <span
                          className={
                            h.summons_issued
                              ? "font-semibold text-emerald-600"
                              : "font-semibold text-amber-600"
                          }
                        >
                          {h.complainant_summons_status ?? (h.summons_issued ? "Issued" : "Prepared")}
                        </span>
                      </span>
                      <span className="text-gray-300">|</span>
                      <span>
                        <strong className="text-dark">Respondent Summons:</strong>{" "}
                        <span
                          className={
                            h.summons_issued
                              ? "font-semibold text-emerald-600"
                              : "font-semibold text-amber-600"
                          }
                        >
                          {h.respondent_summons_status ?? (h.summons_issued ? "Issued" : "Prepared")}
                        </span>
                      </span>
                    </div>

                    {/* MINUTES & OUTCOME */}
                    {(hasMin || h.outcome) && (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray/30 pt-1.5 text-[11px]">
                        {hasMin && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <FiCheck className="h-3 w-3" />
                            Minutes recorded
                          </span>
                        )}
                        {h.outcome && (
                          <span className="font-semibold text-primary">
                            Outcome: {h.outcome}
                          </span>
                        )}
                      </div>
                    )}

                    {/* ACTIONS ROW FOR THIS SITTING */}
                    <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2 border-t border-gray/40 pt-2">
                      {onPrintSummons && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onPrintSummons({
                              ...h,
                              lupon_case: h.lupon_case ?? caseFor,
                              lupon_case_id: h.lupon_case_id ?? caseFor.id,
                            });
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-dark"
                        >
                          <FiPrinter className="h-3 w-3 text-primary" />
                          {h.summons_issued ? "Print summons again" : "Print summons"}
                        </button>
                      )}

                      {h.status === "Scheduled" && (
                        <button
                          type="button"
                          onClick={() => {
                            setTimeEditHearing(h);
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-dark"
                        >
                          <FiClock className="h-3 w-3 text-gray-500" />
                          Set sitting hour
                        </button>
                      )}

                      {onOpenMinutes && (hasMin || mine) && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenMinutes(h, hasMin ? "view" : "edit");
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-dark"
                        >
                          {hasMin ? <FiEye className="h-3 w-3" /> : <FiPlus className="h-3 w-3" />}
                          {hasMin ? "View Minutes" : "Add Minutes"}
                        </button>
                      )}

                      {onStartSession && displayStatus.label === "Today" && h.status === "Scheduled" && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onStartSession(h);
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-primary-dark"
                        >
                          <FiPlay className="h-3 w-3" />
                          Start sitting
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray pt-3">
          {onViewCaseFile && c.id ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewCaseFile(c.id!);
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <FiFileText className="h-3.5 w-3.5" />
              View full case file & complaint narrative
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full bg-gray-100 px-4 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>

      <EditHearingTimeModal
        hearing={timeEditHearing}
        isOpen={timeEditHearing !== null}
        onClose={() => setTimeEditHearing(null)}
        onSaved={() => {
          refreshCase();
          if (timeEditHearing && onSetStartTime) {
            onSetStartTime(timeEditHearing);
          }
        }}
      />
    </Modal>
  );
}
