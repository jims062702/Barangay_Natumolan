import { FiCheck, FiX } from "react-icons/fi";
import Modal from "../../../../shared/ui/Modal";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import { formatWallClock } from "../../../../shared/lib/datetime";
import type { HearingCalendarState } from "../../hooks/useHearingCalendar";

/**
 * What was decided at a sitting, read back.
 *
 * Read-only on purpose. The minutes are written once, in the room, with the
 * parties in front of the Punong Barangay; a screen that lets them be edited
 * a week later is a screen that lets the record be changed after the fact.
 *
 * A SITTING THAT NEVER SAT IS NOT A RESULT. Cancelled hearings came through
 * here too, and the screen read "Complainant — did not appear. Respondent —
 * did not appear. No minutes were recorded." of a day nobody was called to.
 * Non-appearance is grounds for default under the KP rules, so that page was
 * not merely odd — it was the record saying something untrue about two
 * people. A cancelled sitting shows why it did not sit, and nothing else.
 */
export function ResultModal({ ctx }: { ctx: HearingCalendarState }) {
  const { resultFor, setResultFor } = ctx;
  const hearing = resultFor;
  const stoodDown = hearing?.status === "Cancelled";

  const attendance = (label: string, present?: boolean | null) => (
    <div className="flex items-center gap-2 text-sm text-dark">
      {present ? (
        <FiCheck className="h-4 w-4 text-success" aria-hidden="true" />
      ) : (
        <FiX className="h-4 w-4 text-danger" aria-hidden="true" />
      )}
      <span>
        {label} — {present ? "present" : "did not appear"}
      </span>
    </div>
  );

  return (
    <Modal
      open={hearing !== null}
      onClose={() => setResultFor(null)}
      title={`${stoodDown ? "Hearing cancelled" : "Hearing result"} — ${hearing?.lupon_case?.case_number ?? ""}`}
      size="wide"
    >
      {hearing && (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-xl bg-secondary px-4 py-3 sm:grid-cols-2">
            <Fact label="Case">{hearing.lupon_case?.case_title ?? "—"}</Fact>
            <Fact label="Hearing">{hearing.hearing_type}</Fact>
            <Fact label={stoodDown ? "Was set for" : "Held"}>{formatWallClock(hearing.scheduled_at)}</Fact>
            <Fact label="Status">
              <StatusBadge status={hearing.status} />
            </Fact>
          </div>

          {stoodDown ? (
            /* The reason the office gave when it stood the sitting down. */
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Why it did not sit
              </h3>
              <p className="whitespace-pre-wrap rounded-xl border border-gray px-3.5 py-3 text-sm leading-relaxed text-dark">
                {hearing.outcome || "No reason was recorded."}
              </p>
            </section>
          ) : (
          <>
          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Attendance
            </h3>
            <div className="space-y-1">
              {attendance("Complainant", hearing.complainant_present)}
              {attendance("Respondent", hearing.respondent_present)}
              {hearing.attendance_notes && (
                <p className="pt-1 text-xs leading-relaxed text-gray-600">{hearing.attendance_notes}</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Minutes of the sitting
            </h3>
            {/* The Secretary's own words, kept as typed — line breaks and all. */}
            <p className="whitespace-pre-wrap rounded-xl border border-gray px-3.5 py-3 text-sm leading-relaxed text-dark">
              {hearing.proceedings_notes || "No minutes were recorded."}
            </p>
          </section>

          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Outcome
            </h3>
            <p className="text-sm font-semibold text-dark">{hearing.outcome || "—"}</p>
          </section>
          </>
          )}

          {hearing.recorder?.name && (
            <p className="text-xs text-gray-400">Recorded by {hearing.recorder.name}</p>
          )}
        </div>
      )}
    </Modal>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-0.5 text-sm text-dark">{children}</div>
    </div>
  );
}
