import { useState, useEffect, type FormEvent } from "react";
import { FiCheck, FiEdit2, FiX } from "react-icons/fi";
import Modal from "../../../../shared/ui/Modal";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { formatWallClock } from "../../../../shared/lib/datetime";
import { errorMessage } from "../../../../shared/lib/api";
import { toast } from "../../../../shared/lib/toast";
import { useModalDraft } from "../../../../shared/lib/useModalDraft";
import { useAuth } from "../../../../shared/auth/AuthContext";
import { worksSitting, SESSION_OUTCOMES } from "../../lib/hearings";
import { luponApi } from "../../api";
import type { LuponHearing } from "../../types";

import type { LuponCase } from "../../types";

interface MinutesModalProps {
  hearing: LuponHearing | null;
  caseFile?: LuponCase | null;
  isOpen: boolean;
  initialMode?: "view" | "edit";
  onClose: () => void;
  onSaved: () => void;
}

export function MinutesModal({
  hearing,
  caseFile,
  isOpen,
  initialMode = "edit",
  onClose,
  onSaved,
}: MinutesModalProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const [saving, setSaving] = useState(false);
  const [fetchedCase, setFetchedCase] = useState<LuponCase | null>(null);

  const [complainantPresent, setComplainantPresent] = useState(true);
  const [respondentPresent, setRespondentPresent] = useState(true);
  const [attendanceNotes, setAttendanceNotes] = useState("");
  const [minutes, setMinutes] = useState("");
  const [outcome, setOutcome] = useState("Unsettled");
  const [agreement, setAgreement] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");

  const canEdit = hearing ? worksSitting(user, hearing) : false;

  const resetForm = (h?: LuponHearing | null) => {
    if (!h) return;
    setComplainantPresent(h.complainant_present ?? true);
    setRespondentPresent(h.respondent_present ?? true);
    setAttendanceNotes(h.attendance_notes ?? "");
    setMinutes(h.proceedings_notes ?? "");
    setOutcome(h.outcome ?? "Unsettled");
    setAgreement(h.lupon_case?.settlement?.terms ?? "");
    setStartedAt(h.started_at ? h.started_at.slice(11, 16) : "");
    setEndedAt(h.ended_at ? h.ended_at.slice(11, 16) : "");
  };

  useEffect(() => {
    if (hearing && isOpen) {
      setMode(initialMode);
      resetForm(hearing);

      const directCase = (hearing.lupon_case || caseFile) as LuponCase | undefined;
      if (directCase && (directCase.complainant_display_name || directCase.complainant_name || directCase.complainant)) {
        setFetchedCase(directCase);
      } else {
        const cid = hearing.lupon_case_id || directCase?.id;
        if (cid) {
          luponApi.hearingCase(cid)
            .then((r: any) => setFetchedCase(r.data.data))
            .catch(() => undefined);
        } else if (hearing.id) {
          luponApi.hearing(hearing.id)
            .then((r: any) => {
              if (r.data.data?.lupon_case) {
                setFetchedCase(r.data.data.lupon_case);
              }
            })
            .catch(() => undefined);
        }
      }
    }
  }, [hearing, isOpen, initialMode, caseFile]);

  const formValues = {
    complainantPresent,
    respondentPresent,
    attendanceNotes,
    minutes,
    outcome,
    agreement,
    startedAt,
    endedAt,
  };

  const draft = useModalDraft(
    hearing ? `lupon-minutes:${hearing.id}` : null,
    isOpen && mode === "edit",
    formValues,
    (kept) => {
      if (kept.complainantPresent !== undefined) setComplainantPresent(kept.complainantPresent);
      if (kept.respondentPresent !== undefined) setRespondentPresent(kept.respondentPresent);
      if (kept.attendanceNotes !== undefined) setAttendanceNotes(kept.attendanceNotes);
      if (kept.minutes !== undefined) setMinutes(kept.minutes);
      if (kept.outcome !== undefined) setOutcome(kept.outcome);
      if (kept.agreement !== undefined) setAgreement(kept.agreement);
      if (kept.startedAt !== undefined) setStartedAt(kept.startedAt);
      if (kept.endedAt !== undefined) setEndedAt(kept.endedAt);
    },
    { reset: () => resetForm(hearing) }
  );

  if (!hearing) return null;

  const agreed = outcome === "Agreement";
  const chosenOutcome = SESSION_OUTCOMES.find((o) => o.value === outcome);

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!minutes.trim()) {
      toast("Please enter the minutes of this hearing.", "error");
      return;
    }
    if (agreed && !agreement.trim()) {
      toast("Please enter what the parties agreed to.", "error");
      return;
    }

    setSaving(true);
    try {
      await luponApi.saveMinutes(hearing.id, {
        minutes: minutes.trim(),
        outcome,
        agreement: agreed ? agreement.trim() : null,
        complainant_present: complainantPresent,
        respondent_present: respondentPresent,
        attendance_notes: attendanceNotes.trim() || null,
        started_at: startedAt || null,
        ended_at: endedAt || null,
      });

      draft.clear();
      toast("Hearing minutes saved successfully.", "success");
      onSaved();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const activeCase = fetchedCase || (hearing.lupon_case as LuponCase | undefined) || caseFile;
  const caseNumber = activeCase?.case_number || (activeCase?.id ? `Case #${activeCase.id}` : "");
  const caseTitle = activeCase?.case_title || activeCase?.case_classification || "—";
  const complainantName =
    activeCase?.complainant_display_name ||
    (activeCase?.complainant
      ? `${activeCase.complainant.first_name} ${activeCase.complainant.last_name}`
      : activeCase?.complainant_name) ||
    "—";
  const respondentNames =
    activeCase?.respondent_display_names ||
    (activeCase?.respondents && activeCase.respondents.length > 0
      ? activeCase.respondents.map((r: any) => `${r.first_name} ${r.last_name}`).join(", ")
      : "—");

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`Hearing Minutes${caseNumber ? ` — ${caseNumber}` : ""}`}
      size="wide"
    >
      <div className="space-y-4">
        {/* Hearing context summary */}
        <div className="grid gap-3 rounded-xl bg-secondary px-4 py-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Case</p>
            <p className="font-semibold text-dark">{caseTitle}</p>
            <div className="mt-1 text-xs text-gray-600 space-y-0.5">
              <p>
                <span className="font-semibold text-dark">Complainant:</span>{" "}
                <span className="text-primary font-medium">{complainantName}</span>
              </p>
              <p>
                <span className="font-semibold text-dark">Respondent:</span>{" "}
                <span className="text-dark">{respondentNames}</span>
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Schedule &amp; Status</p>
            <p className="font-semibold text-dark">
              {formatWallClock(hearing.scheduled_at, {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <div className="mt-1">
              <StatusBadge status={hearing.status} />
            </div>
          </div>
        </div>

        {mode === "view" ? (
          /* View mode */
          <div className="space-y-4">
            <section className="rounded-xl border border-gray p-3.5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Attendance
              </h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  {hearing.complainant_present ? (
                    <FiCheck className="h-4 w-4 text-success" />
                  ) : (
                    <FiX className="h-4 w-4 text-danger" />
                  )}
                  <span>Complainant — {hearing.complainant_present ? "Present" : "Did not appear"}</span>
                </div>
                <div className="flex items-center gap-2">
                  {hearing.respondent_present ? (
                    <FiCheck className="h-4 w-4 text-success" />
                  ) : (
                    <FiX className="h-4 w-4 text-danger" />
                  )}
                  <span>Respondent — {hearing.respondent_present ? "Present" : "Did not appear"}</span>
                </div>
                {hearing.attendance_notes && (
                  <p className="pt-1 text-xs text-gray-600">{hearing.attendance_notes}</p>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-gray p-3.5">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Minutes of Proceedings
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-dark">
                {hearing.proceedings_notes || "No minutes were recorded yet."}
              </p>
            </section>

            <section className="rounded-xl border border-gray p-3.5">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Outcome
              </h3>
              <p className="text-sm font-semibold text-dark">{hearing.outcome || "—"}</p>
              {hearing.lupon_case?.settlement?.terms && (
                <div className="mt-2 rounded-lg bg-secondary p-2.5 text-xs text-dark">
                  <p className="font-semibold text-gray-500">Settlement Terms:</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{hearing.lupon_case.settlement.terms}</p>
                </div>
              )}
            </section>

            {hearing.recorder?.name && (
              <p className="text-xs text-gray-400">Recorded by {hearing.recorder.name}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setMode("edit")}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  <FiEdit2 className="h-3.5 w-3.5" /> Edit Minutes
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-full border border-gray px-5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray/20"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* Edit / Add mode */
          <form onSubmit={handleSave} className="space-y-4">
            <div className="rounded-xl bg-secondary px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Who appeared</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-dark">
                  <input
                    type="checkbox"
                    checked={complainantPresent}
                    onChange={(e) => setComplainantPresent(e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                  Complainant appeared
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-dark">
                  <input
                    type="checkbox"
                    checked={respondentPresent}
                    onChange={(e) => setRespondentPresent(e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                  Respondent appeared
                </label>
              </div>

              <div className="mt-3">
                <FormField label="Attendance notes (optional)">
                  <input
                    type="text"
                    value={attendanceNotes}
                    onChange={(e) => setAttendanceNotes(e.target.value)}
                    placeholder="e.g. Complainant was accompanied by sister."
                    className={inputClasses}
                  />
                </FormField>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Actually began (optional)">
                <input
                  type="time"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Actually ended (optional)">
                <input
                  type="time"
                  value={endedAt}
                  onChange={(e) => setEndedAt(e.target.value)}
                  className={inputClasses}
                />
              </FormField>
            </div>

            <FormField
              label="Minutes / Proceedings"
              required
              hint="Record what happened, what was discussed, offers made, and points agreed upon."
            >
              <textarea
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                required
                rows={6}
                className={`${inputClasses} resize-y`}
                placeholder="The hearing opened at... Both parties presented their sides regarding..."
              />
            </FormField>

            <FormField label="Outcome" required>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                required
                className={inputClasses}
              >
                {SESSION_OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FormField>

            {chosenOutcome && (
              <p className="rounded-xl bg-secondary px-4 py-2.5 text-xs leading-relaxed text-gray-600">
                {chosenOutcome.hint}
              </p>
            )}

            {agreed && (
              <FormField
                label="Terms of Amicable Settlement"
                required
                hint="In the parties' own words. This becomes the settlement agreement."
              >
                <textarea
                  value={agreement}
                  onChange={(e) => setAgreement(e.target.value)}
                  required
                  rows={4}
                  className={`${inputClasses} resize-y`}
                  placeholder="The respondent agrees to pay ₱..."
                />
              </FormField>
            )}

            <div className="flex items-center justify-between pt-2">
              {draft.savedAt ? (
                <span className="text-[11px] text-gray-400">
                  Unsaved draft auto-saved at {new Date(draft.savedAt).toLocaleTimeString()}
                </span>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer rounded-full border border-gray px-5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="cursor-pointer rounded-full bg-primary px-6 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Minutes"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
