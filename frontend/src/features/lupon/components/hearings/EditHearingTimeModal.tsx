import { useState, useEffect } from "react";
import { FiClock, FiCalendar, FiCheck, FiAlertCircle } from "react-icons/fi";
import Modal from "../../../../shared/ui/Modal";
import { formatWallClock, parseWallClock } from "../../../../shared/lib/datetime";
import { errorMessage } from "../../../../shared/lib/api";
import { toast } from "../../../../shared/lib/toast";
import { luponApi } from "../../api";
import type { LuponHearing } from "../../types";

const STANDARD_SLOTS = [
  { start: "08:00", end: "10:00", label: "8:00 AM – 10:00 AM", name: "Slot 1 (Morning)" },
  { start: "10:15", end: "12:15", label: "10:15 AM – 12:15 PM", name: "Slot 2 (Mid-Day)" },
  { start: "12:30", end: "14:30", label: "12:30 PM – 2:30 PM", name: "Slot 3 (Early Afternoon)" },
  { start: "14:45", end: "16:45", label: "2:45 PM – 4:45 PM", name: "Slot 4 (Late Afternoon)" },
  { start: "17:00", end: "19:00", label: "5:00 PM – 7:00 PM", name: "Slot 5 (Early Evening)" },
  { start: "19:15", end: "21:15", label: "7:15 PM – 9:15 PM", name: "Slot 6 (Evening)" },
  { start: "21:30", end: "23:30", label: "9:30 PM – 11:30 PM", name: "Slot 7 (Night)" },
];

interface EditHearingTimeModalProps {
  hearing: LuponHearing | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditHearingTimeModal({
  hearing,
  isOpen,
  onClose,
  onSaved,
}: EditHearingTimeModalProps) {
  const [selectedSlot, setSelectedSlot] = useState<string>("08:00");
  const [isCustom, setIsCustom] = useState(false);
  const [customTime, setCustomTime] = useState("");
  const [applyToSubsequent, setApplyToSubsequent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (hearing && isOpen) {
      setErrorMsg(null);
      const currentTime = hearing.scheduled_at ? hearing.scheduled_at.slice(11, 16) : "08:00";
      const matchingSlot = STANDARD_SLOTS.find((s) => s.start === currentTime);
      if (matchingSlot) {
        setSelectedSlot(matchingSlot.start);
        setIsCustom(false);
        setCustomTime(currentTime);
      } else {
        setSelectedSlot("");
        setIsCustom(true);
        setCustomTime(currentTime);
      }
      setApplyToSubsequent(true);
    }
  }, [hearing, isOpen]);

  if (!isOpen || !hearing) return null;

  const hearingDate = parseWallClock(hearing.scheduled_at);
  const dateFormatted = hearingDate && !isNaN(hearingDate.getTime())
    ? hearingDate.toLocaleDateString("en-PH", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const currentTimeRange = hearing.schedule_time_range || formatWallClock(hearing.scheduled_at);
  const hearingTitle = hearing.hearing_title || (
    hearing.hearing_type === "Mediation"
      ? `Punong Barangay Hearing #${hearing.hearing_sequence ?? 1}`
      : `Lupon Hearing #${hearing.hearing_sequence ?? 1}`
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const timeToSubmit = isCustom ? customTime.trim() : selectedSlot;
    if (!timeToSubmit) {
      setErrorMsg("Please select or enter a start time.");
      return;
    }

    setSaving(true);
    try {
      const response = await luponApi.setStartTime(hearing.id, {
        start_time: timeToSubmit,
        apply_to_subsequent: applyToSubsequent,
      });

      toast(response.data?.message || "Hearing schedule hour updated successfully.", "success");
      onSaved();
      onClose();
    } catch (err) {
      const msg = errorMessage(err);
      setErrorMsg(msg);
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Set Sitting Hour"
    >
      <form onSubmit={handleSave} className="space-y-4 text-xs">
        <p className="-mt-1 text-xs text-gray-500">
          Adjust the hour this hearing begins without moving the scheduled date.
        </p>
        {/* CASE & SITTING DETAILS BANNER */}
        <div className="rounded-xl border border-primary/20 bg-secondary/70 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Case #{hearing.lupon_case?.case_number || "—"}
              </span>
              <h4 className="text-sm font-bold text-dark">{hearingTitle}</h4>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
              {hearing.hearing_type === "Mediation" ? "Mediation (PB)" : "Conciliation (Lupon)"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray/40 text-[11px] text-gray-600">
            <div className="flex items-center gap-1.5">
              <FiCalendar className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                <strong className="text-dark">Date:</strong> {dateFormatted || hearing.scheduled_at?.slice(0, 10)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <FiClock className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                <strong className="text-dark">Current Time:</strong> {currentTimeRange}
              </span>
            </div>
          </div>
        </div>

        {/* ERROR DISPLAY */}
        {errorMsg && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div className="leading-snug">{errorMsg}</div>
          </div>
        )}

        {/* PRESET TIME SLOTS */}
        <div>
          <label className="block text-xs font-bold text-dark mb-1.5">
            Select Daily Hearing Slot (2 Hours + 15m Buffer)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STANDARD_SLOTS.map((slot) => {
              const active = !isCustom && selectedSlot === slot.start;
              return (
                <button
                  key={slot.start}
                  type="button"
                  onClick={() => {
                    setSelectedSlot(slot.start);
                    setIsCustom(false);
                    setErrorMsg(null);
                  }}
                  className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    active
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-sm ring-1 ring-primary"
                      : "border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-bold">{slot.label}</span>
                    {active && <FiCheck className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <span className="text-[10px] text-gray-500 font-normal">{slot.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CUSTOM TIME OPTION */}
        <div className="border-t border-gray/40 pt-3">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-dark">
              <input
                type="checkbox"
                checked={isCustom}
                onChange={(e) => {
                  setIsCustom(e.target.checked);
                  if (e.target.checked && !customTime) {
                    setCustomTime(selectedSlot || "08:00");
                  }
                  setErrorMsg(null);
                }}
                className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span>Specify Custom Start Hour</span>
            </label>
          </div>

          {isCustom && (
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={customTime}
                onChange={(e) => {
                  setCustomTime(e.target.value);
                  setErrorMsg(null);
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-dark focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
              <span className="text-[11px] text-gray-500">
                Duration will automatically be 2 hours (120 minutes) with a 15-minute hall buffer.
              </span>
            </div>
          )}
        </div>

        {/* APPLY TO SUBSEQUENT HEARINGS */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
          <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-700">
            <input
              type="checkbox"
              checked={applyToSubsequent}
              onChange={(e) => setApplyToSubsequent(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div>
              <span className="font-semibold text-dark">
                Apply this hour to subsequent scheduled hearings of this case
              </span>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Automatically synchronizes Hearing #2 and #3 to this same time slot if there are no collisions.
              </p>
            </div>
          </label>
        </div>

        {/* MODAL ACTIONS */}
        <div className="flex items-center justify-end gap-2 border-t border-gray/40 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <FiClock className="h-3.5 w-3.5" />
                <span>Save Schedule Hour</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
