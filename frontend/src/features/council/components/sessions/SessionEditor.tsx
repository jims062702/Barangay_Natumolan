import { useState, useEffect } from "react";
import { FiTrash2 } from "react-icons/fi";
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
              <div
                key={i}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl border border-gray/80 bg-white p-2.5 shadow-xs transition hover:border-primary/50"
              >
                <div className="grid flex-1 grid-cols-1 sm:grid-cols-[1.4fr_1.1fr] gap-2 min-w-0">
                  <div className="relative">
                    <input
                      value={a.name}
                      onChange={(e) => setAttendee(i, { name: e.target.value })}
                      placeholder="Official Name"
                      className="w-full rounded-xl bg-gray-50/80 px-3 py-2 text-sm font-semibold text-dark outline-none transition focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary border border-transparent"
                    />
                  </div>
                  <div className="relative">
                    <input
                      value={a.position ?? ""}
                      onChange={(e) => setAttendee(i, { position: e.target.value })}
                      placeholder="Position (e.g. Barangay Kagawad)"
                      className="w-full rounded-xl bg-gray-50/80 px-3 py-2 text-xs font-medium text-gray-600 outline-none transition focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary border border-transparent"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-gray/40">
                  <select
                    value={a.attendance}
                    onChange={(e) =>
                      setAttendee(i, { attendance: e.target.value as Attendee["attendance"] })
                    }
                    className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold outline-none transition shadow-2xs ${
                      a.attendance === "Present"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : a.attendance === "Absent"
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-amber-300 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {ATTENDANCE.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setAttendees((l) => l.filter((_, n) => n !== i))}
                    aria-label={`Remove ${a.name || "this row"}`}
                    className="cursor-pointer rounded-xl p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
                    title="Remove attendee"
                  >
                    <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
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
