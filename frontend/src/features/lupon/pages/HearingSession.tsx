import { useEffect, useState, type FormEvent } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import PageHeader from "../../../shared/ui/PageHeader";
import StatusBadge from "../../../shared/ui/StatusBadge";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import { formatWallClock } from "../../../shared/lib/datetime";
import { errorMessage } from "../../../shared/lib/api";
import { announceWrite } from "../../../shared/lib/announceWrite";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { SESSION_OUTCOMES, worksSitting } from "../lib/hearings";
import { luponApi } from "../api";
import type { LuponHearing } from "../types";
import RouteSkeleton from "../../../shared/ui/RouteSkeleton";
import { useAuth } from "../../../shared/auth/AuthContext";
import { useModalDraft } from "../../../shared/lib/useModalDraft";

/**
 * The sitting itself — its own screen, not a dialog over the calendar.
 *
 * The minutes are taken here WHILE the parties are talking: a box in a modal
 * over a table the Secretary keeps wanting to look at is the wrong shape for
 * work that takes half an hour. The complaint is on the left, the minutes on
 * the right, and the ending is chosen from a list rather than typed.
 */
export default function HearingSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [hearing, setHearing] = useState<LuponHearing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [complainantPresent, setComplainantPresent] = useState(true);
  const [respondentPresent, setRespondentPresent] = useState(true);
  const [minutes, setMinutes] = useState("");
  const [outcome, setOutcome] = useState("");
  const [agreement, setAgreement] = useState("");
  /*
   * WHEN IT ACTUALLY RAN, beside when it was set to.
   *
   * The appointment is an hour on a summons; this is a record of the
   * hearing. A sitting booked for nine may begin at twenty past because a
   * party was late and run to eleven because the dispute needed it — the
   * ninety minutes are how the office lays out a Tuesday, never a limit on
   * a mediation, and nothing here stops a sitting when they expire.
   *
   * Both optional. An office writing up a long morning should not be held
   * up for want of a clock reading.
   */
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");

  const canEdit = hearing ? worksSitting(user, hearing) : false;

  useEffect(() => {
    luponApi
      .hearing(id)
      .then((r) => {
        const h = r.data.data;
        setHearing(h);
        if (h) {
          setComplainantPresent(h.complainant_present ?? true);
          setRespondentPresent(h.respondent_present ?? true);
          setMinutes(h.proceedings_notes || h.minutes || "");
          setOutcome(h.outcome || "Unsettled");
          setStartedAt(clock24(h.started_at));
          setEndedAt(clock24(h.ended_at));
          if (h.lupon_case?.settlement?.terms) {
            setAgreement(h.lupon_case.settlement.terms);
          }
        }
      })
      .catch((err) => {
        toast(errorMessage(err), "error");
        navigate("/lupon/hearings");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const draftKey = hearing ? `lupon-session-minutes:${hearing.id}` : null;
  const draft = useModalDraft(
    draftKey,
    canEdit,
    { complainantPresent, respondentPresent, minutes, outcome, agreement, startedAt, endedAt },
    (restored) => {
      if (restored) {
        if (restored.complainantPresent !== undefined) setComplainantPresent(restored.complainantPresent);
        if (restored.respondentPresent !== undefined) setRespondentPresent(restored.respondentPresent);
        if (restored.minutes !== undefined) setMinutes(restored.minutes);
        if (restored.outcome !== undefined) setOutcome(restored.outcome);
        if (restored.agreement !== undefined) setAgreement(restored.agreement);
        if (restored.startedAt !== undefined) setStartedAt(restored.startedAt);
        if (restored.endedAt !== undefined) setEndedAt(restored.endedAt);
      }
    }
  );

  /* The sitting's own skeleton until it is in; a sitting that cannot be
     opened goes back to the calendar with the reason (above). */
  if (loading) return <RouteSkeleton />;

  if (!hearing) return null;

  const luponCase = hearing.lupon_case;
  const chosen = SESSION_OUTCOMES.find((o) => o.value === outcome);
  const agreed = outcome === "Agreement";
  /* Held already, or stood down: past status. */
  const closed = hearing.status !== "Scheduled";
  /* The third of the three — recording it moves the case on by itself. */
  const last = hearing.last_of_stage === true;

  const now = new Date();
  const todayManila = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const isUpcoming = hearing.scheduled_at ? hearing.scheduled_at.slice(0, 10) > todayManila : false;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isUpcoming) {
      toast("Cannot record minutes for an upcoming hearing. Sittings must be held before minutes can be recorded.", "error");
      return;
    }
    const isUpdateOnly = hearing.status !== "Scheduled";
    if (!chosen && !isUpdateOnly) return;

    if (!(await confirmAction({
      title: isUpdateOnly ? "Update hearing minutes?" : "Record this sitting?",
      text: isUpdateOnly
        ? "The minutes and attendance record will be saved for this hearing."
        : agreed
          ? "The agreement becomes the settlement, the case closes, and the remaining sittings are stood down."
          /* The office should know before pressing whether this is the one
             that ends the stage — "the case stays where it is" would be a
             lie on the third sitting. */
          : last
            ? hearing.hearing_type === "Conciliation"
              ? "This is the last of the three sittings with the Lupon. Nothing further is booked, and the Lupon may certify the case to file action."
              : "This is the last of the three sittings with the Punong Barangay, so the case goes to the Lupon — they print the summons, and that books three Thursdays."
            : "The sitting is recorded as held. The next sitting stands.",
      confirmText: isUpdateOnly ? "Yes, update minutes" : "Yes, record it",
    }))) return;

    setSaving(true);
    try {
      if (isUpdateOnly) {
        const saved = await luponApi.saveMinutes(hearing.id, {
          minutes,
          outcome: outcome || hearing.outcome,
          agreement: agreed ? agreement : null,
          complainant_present: complainantPresent,
          respondent_present: respondentPresent,
          started_at: startedAt || null,
          ended_at: endedAt || null,
        });
        draft.clear();
        announceWrite(saved, "Hearing minutes updated.");
        toast("Hearing minutes updated successfully.", "success");
      } else {
        const saved = await luponApi.recordSession(hearing.id, {
          minutes,
          outcome,
          agreement: agreed ? agreement : null,
          complainant_present: complainantPresent,
          respondent_present: respondentPresent,
          started_at: startedAt || null,
          ended_at: endedAt || null,
        });
        draft.clear();
        announceWrite(saved, "The sitting was recorded.");
        toast("The sitting was recorded.", "success");
      }
      navigate("/lupon/hearings");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Link
        to="/lupon/hearings"
        className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <FiArrowLeft aria-hidden="true" /> Back to the hearing calendar
      </Link>

      <PageHeader
        title={`${hearing.hearing_type} hearing — ${luponCase?.case_number ?? ""}`}
        subtitle={`${luponCase?.case_title ?? ""} · ${formatWallClock(hearing.scheduled_at)}`}
        actions={<StatusBadge status={hearing.status} />}
      />

      {closed && (
        <div className="mb-4 rounded-xl border border-gray bg-secondary px-4 py-3 text-sm text-gray-600">
          {canEdit ? (
            <span>
              This sitting is already {hearing.status.toLowerCase()}. You may review or update the official minutes and proceedings below.
            </span>
          ) : (
            <span>
              This sitting is already {hearing.status.toLowerCase()}. Its record is below and cannot be changed here.
            </span>
          )}
        </div>
      )}

      {/* `items-start`: the complaint is as tall as the complaint. Stretched
          to match the minutes box it was a card of empty grey. */}
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.4fr]">
        {/* What the sitting is about, so nobody has to open the docket. */}
        <Card title="The complaint">
          <dl className="space-y-3 text-sm">
            <Fact label="Complainant">{luponCase?.complainant_display_name ?? "—"}</Fact>
            <Fact label="Respondent">{luponCase?.respondent_display_names || "—"}</Fact>
            <Fact label="Nature of the Case">{luponCase?.case_classification ?? "—"}</Fact>
            {luponCase?.complaint && (
              <>
                <Fact label="When & where">
                  {new Date(luponCase.complaint.date_of_occurrence).toLocaleDateString("en-PH", {
                    dateStyle: "long",
                  })}{" "}
                  · {luponCase.complaint.place_of_occurrence}
                </Fact>
                <Fact label="Relationship">{luponCase.complaint.relationship_nature || "—"}</Fact>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    What was complained of
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-dark">
                    {luponCase.complaint.complaint_narrative}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </Card>

        <Card title="Minutes of this sitting">
          <form onSubmit={save} className="space-y-4">
            <fieldset disabled={(!canEdit && closed) || saving} className="space-y-4">
              <div className="grid gap-2 rounded-xl bg-secondary px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Who appeared</p>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-dark">
                  <input
                    type="checkbox"
                    checked={complainantPresent}
                    onChange={(e) => setComplainantPresent(e.target.checked)}
                    disabled={!canEdit}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                  Complainant appeared
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-dark">
                  <input
                    type="checkbox"
                    checked={respondentPresent}
                    onChange={(e) => setRespondentPresent(e.target.checked)}
                    disabled={!canEdit}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                  Respondent appeared
                </label>
              </div>

              {/*
                THE CLOCK, AS THE ROOM READ IT.

                Left blank the record simply does not claim an hour, which
                is better than a made-up one. Filled in, they are what tells
                the office a Tuesday ran long — and the sitting after this
                one is marked as starting late WITHOUT its appointment being
                moved, because the summons in that party's hand names an
                hour and the hall must not disagree with it.
              */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Actually began"
                  hint={hearing.scheduled_at ? `Set for ${clockOf(hearing.scheduled_at)}` : undefined}
                >
                  <input
                    type="time"
                    value={startedAt}
                    onChange={(e) => setStartedAt(e.target.value)}
                    disabled={!canEdit}
                    className={inputClasses}
                  />
                </FormField>
                <FormField
                  label="Actually ended"
                  hint={hearing.scheduled_end_at ? `Slot runs to ${clockOf(hearing.scheduled_end_at)}` : undefined}
                >
                  <input
                    type="time"
                    value={endedAt}
                    onChange={(e) => setEndedAt(e.target.value)}
                    disabled={!canEdit}
                    className={inputClasses}
                  />
                </FormField>
              </div>

              {/*
                Every sitting has minutes — an agreement recorded with no
                account of how it was reached is the one a party later
                disputes, and the Secretary is here to write them.
              */}
              <FormField
                label="What happened / Minutes"
                required
                hint="What was said, what was offered, what was agreed."
              >
                <textarea
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  disabled={!canEdit}
                  required
                  rows={10}
                  className={`${inputClasses} resize-y`}
                  placeholder="Both parties appeared. The complainant asked for…"
                />
              </FormField>

              <FormField label="How the sitting ended" required>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  disabled={!canEdit}
                  required
                  className={inputClasses}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {SESSION_OUTCOMES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FormField>

              {/* What that ending does to the case, before it is done. */}
              {chosen && (
                <p className="rounded-xl bg-secondary px-4 py-3 text-xs leading-relaxed text-gray-600">
                  {chosen.hint}
                </p>
              )}

              {agreed && (
                <FormField
                  label="What the parties agreed to"
                  required
                  hint="In their own words. This becomes the amicable settlement, and either party may repudiate it within ten days."
                >
                  <textarea
                    value={agreement}
                    onChange={(e) => setAgreement(e.target.value)}
                    disabled={!canEdit}
                    required
                    rows={6}
                    className={`${inputClasses} resize-y`}
                    placeholder="The respondent will pay ₱2,000 on or before…"
                  />
                </FormField>
              )}
            </fieldset>

            {isUpcoming && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                <span className="font-bold">Upcoming sitting:</span> This hearing is scheduled for{" "}
                {formatWallClock(hearing.scheduled_at, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}. Minutes can only be recorded on or after the scheduled date.
              </div>
            )}

            {canEdit && !isUpcoming && (
              <button
                type="submit"
                disabled={saving}
                className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving…"
                  : closed
                    ? "Update hearing minutes"
                    : "Record the sitting"}
              </button>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-dark">{children}</dd>
    </div>
  );
}

/*
 * READ OFF THE STRING, NEVER PARSED.
 *
 * The column holds Manila wall-clock and the server sends it with a "Z" it
 * has not earned, so `new Date(...)` shifts a nine o'clock sitting by eight
 * hours.
 */
const clockOf = (iso?: string | null) => {
  if (!iso) return undefined;
  const h = Number(iso.slice(11, 13));
  if (Number.isNaN(h)) return undefined;
  return `${h % 12 === 0 ? 12 : h % 12}:${iso.slice(14, 16)} ${h < 12 ? "AM" : "PM"}`;
};

/** "HH:MM", which is what an <input type="time"> wants. */
const clock24 = (iso?: string | null) => (iso ? iso.slice(11, 16) : "");
