import { useState, useEffect } from "react";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import FormField from "../../../../shared/ui/FormField";
import { api } from "../../../../shared/lib/api";
import { asDate, input, blankAttendee, ATTENDANCE } from "../../lib/sessions";
import type { SessionRecordsState } from "../../hooks/useSessionRecords";
import type { Attendee, Official } from "../../types";

/**
 * Writing the record of a session: when, who attended, and what was taken up.
 */
export function SessionEditor({ ctx }: { ctx: SessionRecordsState }) {
  const {
    open, setOpen, editing, save, error, sessionType, setSessionType, sessionDate,
    setSessionDate, calledAt, setCalledAt, adjournedAt, setAdjournedAt, venue, setVenue,
    status, setStatus, agenda, setAgenda, minutes, setMinutes, setAttendees, attendees,
    setAttendee, saving, draft,
  } = ctx;

  const [officialsList, setOfficialsList] = useState<Official[]>([]);

  useEffect(() => {
    api.get<{ data: { barangay: Official[]; sk: Official[] } }>("/officials")
      .then((res) => {
        const bg = res.data?.data?.barangay ?? [];
        setOfficialsList(bg);
      })
      .catch(() => {});
  }, []);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={editing ? `Session ${editing.session_number}` : "Record a session"}
      size="wide"
    >
      <form onSubmit={save} className="space-y-5 p-5">
        {editing?.status === "Adopted" && (
          <div className="rounded-xl border border-gray bg-secondary px-4 py-3 text-sm text-gray-600">
            These minutes were adopted{editing.adopted_at ? ` on ${asDate(editing.adopted_at)}` : ""}.
            They are the barangay&apos;s record now and can no longer be edited.
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Kind of session" required>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value as "Regular" | "Special")}
              className={input}
            >
              <option value="Regular">Regular</option>
              <option value="Special">Special</option>
            </select>
          </FormField>

          <FormField label="Date held" required>
            <input
              type="date"
              required
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              /* Minutes record something that happened. */
              max={new Date().toISOString().slice(0, 10)}
              className={input}
            />
          </FormField>

          <FormField label="Called to order" hint="The time the presiding officer opened it">
            <input
              type="time"
              value={calledAt}
              onChange={(e) => setCalledAt(e.target.value)}
              className={input}
            />
          </FormField>

          <FormField label="Adjourned">
            <input
              type="time"
              value={adjournedAt}
              onChange={(e) => setAdjournedAt(e.target.value)}
              className={input}
            />
          </FormField>

          <FormField label="Venue">
            <input value={venue} onChange={(e) => setVenue(e.target.value)} className={input} />
          </FormField>

          <FormField label="Status" hint="Adoption is the council's, not the secretary's">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "Draft" | "For Approval")}
              className={input}
            >
              <option value="Draft">Draft — still being written</option>
              <option value="For Approval">For approval — ready for the council</option>
            </select>
          </FormField>
        </div>

        <FormField label="Agenda">
          <textarea
            rows={3}
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            className={input}
            placeholder="What the session was called to take up"
          />
        </FormField>

        <FormField label="Minutes">
          <textarea
            rows={10}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className={input}
            placeholder="What was said, moved, seconded and carried"
          />
        </FormField>

        {/*
          Attendance per official, not a paragraph.
          The question asked of this record is "was this kagawad present",
          and a name buried in a sentence cannot answer it.
        */}
        <div className="space-y-3">
          <FormField
            label="Attendance (officials)"
            hint="Choose barangay officials from the dropdown to record their attendance, or add all council members"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value=""
                onChange={(e) => {
                  const id = Number(e.target.value);
                  if (!id) return;
                  const off = officialsList.find((o) => o.id === id);
                  if (!off) return;
                  if (!attendees.some((a) => a.name.toLowerCase() === off.name.toLowerCase())) {
                    setAttendees((prev) => [
                      ...prev,
                      { name: off.name, position: off.position, attendance: "Present", remarks: null },
                    ]);
                  }
                }}
                className={input}
              >
                <option value="">Select an official to add…</option>
                {officialsList.map((o) => {
                  const alreadyAdded = attendees.some(
                    (a) => a.name.toLowerCase() === o.name.toLowerCase()
                  );
                  return (
                    <option key={o.id} value={o.id} disabled={alreadyAdded}>
                      {o.name} ({o.position}){alreadyAdded ? " — already added" : ""}
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                onClick={() => {
                  setAttendees((prev) => {
                    const existingNames = new Set(prev.map((a) => a.name.toLowerCase()));
                    const toAdd = officialsList
                      .filter((o) => !existingNames.has(o.name.toLowerCase()))
                      .map((o) => ({
                        name: o.name,
                        position: o.position,
                        attendance: "Present" as const,
                        remarks: null,
                      }));
                    return [...prev, ...toAdd];
                  });
                }}
                className="whitespace-nowrap rounded-xl border border-gray bg-white px-3 py-2 text-xs font-semibold text-primary transition hover:border-primary cursor-pointer"
              >
                + Add all council officials
              </button>
            </div>
          </FormField>

          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-dark">
              Recorded Attendance ({attendees.length})
            </span>
            <button
              type="button"
              onClick={() => setAttendees((l) => [...l, blankAttendee()])}
              className="cursor-pointer text-xs font-semibold text-primary hover:underline"
            >
              + Add custom attendee
            </button>
          </div>

          <div className="space-y-2">
            {attendees.map((a, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1.4fr_1fr_auto_auto]">
                <input
                  value={a.name}
                  onChange={(e) => setAttendee(i, { name: e.target.value })}
                  placeholder="Name"
                  className={input}
                />
                <input
                  value={a.position ?? ""}
                  onChange={(e) => setAttendee(i, { position: e.target.value })}
                  placeholder="Position"
                  className={input}
                />
                <select
                  value={a.attendance}
                  onChange={(e) =>
                    setAttendee(i, { attendance: e.target.value as Attendee["attendance"] })
                  }
                  className={input}
                >
                  {ATTENDANCE.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setAttendees((l) => l.filter((_, n) => n !== i))}
                  aria-label={`Remove ${a.name || "this row"}`}
                  className="cursor-pointer rounded-xl border border-gray px-3 text-sm text-gray-500 transition hover:border-danger/50 hover:text-danger"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <DraftNotice draft={draft} />

        <div className="flex justify-end gap-3 border-t border-gray pt-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cursor-pointer rounded-full border border-gray px-5 py-2.5 text-sm font-semibold text-dark transition hover:border-primary/50"
          >
            Close
          </button>
          {editing?.status !== "Adopted" && (
            <button
              type="submit"
              disabled={saving}
              className="cursor-pointer rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {saving ? "Saving…" : editing ? "Save the minutes" : "Record the session"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
