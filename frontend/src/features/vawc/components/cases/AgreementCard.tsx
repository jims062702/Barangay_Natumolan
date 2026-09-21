import { useEffect, useState } from "react";
import { errorMessage } from "../../../../shared/lib/api";
import { toast } from "../../../../shared/lib/toast";
import Card from "../../../../shared/ui/Card";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { vawcApi } from "../../api";

interface Agreement {
  id: number;
  session_date: string;
  attendees: string | null;
  discussion: string | null;
  agreement: string | null;
  survivor_acknowledged: boolean;
  respondent_acknowledged: boolean;
  recorder?: { id: number; name: string } | null;
}

/** "YYYY-MM-DD" in Manila's own day, for a date input's max. */
const today = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  return now.toISOString().slice(0, 10);
};

/**
 * The one session this case gets, and what was agreed at it.
 *
 * ONE. The desk sits the parties down once to hear what happened and write
 * down what was agreed — saving again corrects that record rather than
 * opening a second sitting. A series of sittings is mediation, and mediating
 * a VAWC matter is prohibited; the table enforces it with a unique key, and
 * this form says so plainly rather than leaving somebody to discover it.
 *
 * Encrypted at rest and never leaves this desk: not cached on the device,
 * not queued offline, and never in a consolidated report.
 */
export function AgreementCard({ caseId }: { caseId: number }) {
  const [existing, setExisting] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [sessionDate, setSessionDate] = useState(today());
  const [attendees, setAttendees] = useState("");
  const [discussion, setDiscussion] = useState("");
  const [agreement, setAgreement] = useState("");
  const [survivorOk, setSurvivorOk] = useState(false);
  const [respondentOk, setRespondentOk] = useState(false);

  useEffect(() => {
    vawcApi.agreement(caseId)
      .then((r) => {
        const row = r.data.data as Agreement | null;
        setExisting(row);

        if (row) {
          setSessionDate(row.session_date?.slice(0, 10) ?? today());
          setAttendees(row.attendees ?? "");
          setDiscussion(row.discussion ?? "");
          setAgreement(row.agreement ?? "");
          setSurvivorOk(row.survivor_acknowledged);
          setRespondentOk(row.respondent_acknowledged);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [caseId]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const r = await vawcApi.recordAgreement(caseId, {
        session_date: sessionDate,
        attendees: attendees.trim() || null,
        discussion,
        agreement: agreement.trim() || null,
        survivor_acknowledged: survivorOk,
        respondent_acknowledged: respondentOk,
      });
      toast(r.data.message);
      setExisting(r.data.data as Agreement);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Session & agreement">
      <p className="-mt-2 mb-4 text-xs leading-relaxed text-gray-500">
        {existing
          ? `Recorded by ${existing.recorder?.name ?? "the desk"}. Saving again corrects this record — a case has one session.`
          : "The desk hears both parties once. What was said and what was agreed are written here; there is no second sitting."}
      </p>

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-400">Loading…</p>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Session date" required>
              <input
                type="date"
                value={sessionDate}
                max={today()}
                onChange={(e) => setSessionDate(e.target.value)}
                required
                className={inputClasses}
              />
            </FormField>
            <FormField label="Who attended" hint="Stored encrypted">
              <input
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                maxLength={500}
                className={inputClasses}
                placeholder="Both parties, a support person, the VAWC officer…"
              />
            </FormField>
          </div>

          <FormField
            label="What was discussed"
            required
            hint="The record of the session itself. Stored encrypted."
          >
            <textarea
              value={discussion}
              onChange={(e) => setDiscussion(e.target.value)}
              required
              rows={5}
              className={`${inputClasses} resize-none`}
              placeholder="What each party said happened, and what was asked for…"
            />
          </FormField>

          <FormField
            label="What was agreed"
            hint="In the parties' own terms. Leave blank if nothing was agreed."
          >
            <textarea
              value={agreement}
              onChange={(e) => setAgreement(e.target.value)}
              rows={4}
              className={`${inputClasses} resize-none`}
            />
          </FormField>

          {/*
            "Acknowledged", not "signed".

            The paper carries the signatures. This records that the desk saw
            each party acknowledge the agreement — claiming to hold a
            signature the system does not hold would be worse than holding
            nothing at all.
          */}
          <div className="grid gap-2 rounded-xl bg-secondary px-4 py-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-dark">
              <input
                type="checkbox"
                checked={survivorOk}
                onChange={(e) => setSurvivorOk(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              Applicant acknowledged
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-dark">
              <input
                type="checkbox"
                checked={respondentOk}
                onChange={(e) => setRespondentOk(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              Respondent acknowledged
            </label>
            <p className="text-xs text-gray-500 sm:col-span-2">
              The signed paper stays on file. These tick boxes record that the desk saw each party
              acknowledge it.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving || discussion.trim() === ""}
            className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? "Saving…" : existing ? "Save corrections" : "Record session & agreement"}
          </button>
        </form>
      )}
    </Card>
  );
}
