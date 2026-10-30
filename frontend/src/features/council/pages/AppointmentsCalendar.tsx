import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiCheckCircle,
  FiList,
  FiUser,
  FiPhone,
  FiMail,
  FiMapPin,
  FiEdit3,
} from "react-icons/fi";
import { useAuth } from "../../../shared/auth/AuthContext";
import Card from "../../../shared/ui/Card";
import PageHeader from "../../../shared/ui/PageHeader";
import StatTile from "../../../shared/ui/StatTile";
import Modal from "../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import StatusBadge from "../../../shared/ui/StatusBadge";
import { toast } from "../../../shared/lib/toast";
import { errorMessage } from "../../../shared/lib/api";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";
import { appointmentApi } from "../appointmentApi";
import type { Appointment } from "../appointmentTypes";

export default function AppointmentsCalendar() {
  const { user } = useAuth();
  const isPb = user?.role === "Punong Barangay";
  const isSecretary = user?.role === "Secretary";

  const [month, setMonth] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 7)
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [, setLoading] = useState(true);
  const pageLoad = usePageLoad();

  // Viewing modal
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Minutes editing modal (Secretary only)
  const [editingMinutes, setEditingMinutes] = useState<Appointment | null>(null);
  const [minutesText, setMinutesText] = useState("");
  const [minutesLoading, setMinutesLoading] = useState(false);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    const [y, m] = month.split("-").map(Number);
    appointmentApi
      .calendar({ params: { month: m, year: y } })
      .then((r) => {
        setAppointments(r.data.data ?? []);
      })
      .then(() => pageLoad.done(), (err) => { pageLoad.fail(err); throw err; })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useAutoRefresh(() => load(true), REFRESH.staff);
  usePulse("sessions", () => load(true));

  const prevMonth = () => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setMonth(d.toLocaleDateString("en-CA").slice(0, 7));
  };

  const nextMonth = () => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m, 1);
    setMonth(d.toLocaleDateString("en-CA").slice(0, 7));
  };

  const currentMonth = () => {
    setMonth(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 7));
  };

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [month]);

  // Group appointments by date (YYYY-MM-DD)
  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const apt of appointments) {
      const d = apt.appointment_date.slice(0, 10);
      const list = map.get(d) ?? [];
      list.push(apt);
      map.set(d, list);
    }
    return map;
  }, [appointments]);

  // Calendar grid calculation
  const weeks = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());

    const w: { date: Date; inMonth: boolean; key: string }[][] = [];
    const cur = new Date(start);

    for (let row = 0; row < 6; row++) {
      const days = [];
      for (let col = 0; col < 7; col++) {
        const inMonth = cur.getMonth() === m - 1;
        const key = cur.toLocaleDateString("en-CA");
        days.push({ date: new Date(cur), inMonth, key });
        cur.setDate(cur.getDate() + 1);
      }
      w.push(days);
      if (cur.getMonth() !== m - 1 && row >= 4) break;
    }
    return w;
  }, [month]);

  const todayStr = useMemo(
    () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
    []
  );

  const todayCount = (byDate.get(todayStr) ?? []).length;
  const residentCount = appointments.filter((a) => a.applicant_type === "Resident").length;
  const nonResidentCount = appointments.filter((a) => a.applicant_type === "Non-resident").length;

  const handleOpenMinutes = (apt: Appointment) => {
    setEditingMinutes(apt);
    setMinutesText(apt.minutes || "");
  };

  const handleSaveMinutes = async () => {
    if (!editingMinutes) return;
    if (!minutesText.trim()) {
      toast("Please enter the minutes of the appointment.", "error");
      return;
    }
    setMinutesLoading(true);
    try {
      const res = await appointmentApi.updateMinutes(editingMinutes.id, {
        minutes: minutesText.trim(),
      });
      toast(res.data?.message || "Appointment minutes saved.");
      setEditingMinutes(null);
      if (selectedAppointment?.id === editingMinutes.id) {
        setSelectedAppointment({ ...selectedAppointment, minutes: minutesText.trim() });
      }
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setMinutesLoading(false);
    }
  };

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments Calendar"
        subtitle={
          isPb
            ? "Executive calendar of approved appointments for Punong Barangay (Read-only)"
            : "Monthly schedule of approved appointments — tracks resident & non-resident bookings"
        }
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/appointments"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
            >
              <FiList className="h-4 w-4" /> All Appointments Table
            </Link>
          </div>
        }
      />

      {/* Quick Summary Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          label="This Month"
          value={appointments.length}
          icon={FiCalendar}
          tone="primary"
          hint="Approved bookings"
        />
        <StatTile
          label="Today's Schedule"
          value={todayCount}
          icon={FiClock}
          tone="warning"
          hint="Appointments today"
        />
        <StatTile
          label="Resident"
          value={residentCount}
          icon={FiUser}
          tone="primary"
          hint="Local community"
        />
        <StatTile
          label="Non-Resident"
          value={nonResidentCount}
          icon={FiUser}
          tone="primary"
          hint="Walk-in clients"
        />
      </div>

      <Card>
        {/* Calendar Navigation Bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray/50 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-dark">{monthLabel}</h2>
            <button
              type="button"
              onClick={currentMonth}
              className="cursor-pointer rounded-full border border-gray px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
            >
              Today
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray text-gray-600 transition hover:border-primary hover:text-primary"
            >
              <FiChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray text-gray-600 transition hover:border-primary hover:text-primary"
            >
              <FiChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-px border-b border-gray/60 pb-2 text-center text-xs font-bold text-gray-500">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 pt-1">
          {weeks.map((week) =>
            week.map(({ date, inMonth, key }) => {
              const dayApts = byDate.get(key) ?? [];
              const isToday = key === todayStr;

              return (
                <div
                  key={key}
                  className={`min-h-[105px] rounded-xl border p-1.5 transition ${
                    isToday
                      ? "border-primary bg-primary/5 shadow-xs"
                      : inMonth
                      ? "border-gray/50 bg-white"
                      : "border-gray/20 bg-gray-50/40 text-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between pb-1">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        isToday
                          ? "bg-primary text-white"
                          : inMonth
                          ? "text-dark"
                          : "text-gray-400"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {dayApts.length > 0 && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                        {dayApts.length}
                      </span>
                    )}
                  </div>

                  {/* Appointments list in day cell */}
                  <div className="space-y-1">
                    {dayApts.slice(0, 3).map((apt) => (
                      <button
                        key={apt.id}
                        type="button"
                        onClick={() => setSelectedAppointment(apt)}
                        className={`w-full text-left truncate rounded-md px-1.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                          apt.applicant_type === "Resident"
                            ? "bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100"
                            : "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
                        }`}
                        title={`${apt.appointment_time || "Time unconfirmed"} — ${apt.full_name}: ${apt.purpose}`}
                      >
                        <span className="font-bold text-[10px] block opacity-80">
                          {apt.appointment_time || "Scheduled"}
                        </span>
                        <span className="truncate block">{apt.full_name}</span>
                      </button>
                    ))}
                    {dayApts.length > 3 && (
                      <div className="text-center text-[10px] font-semibold text-gray-500">
                        +{dayApts.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Appointment Detail Modal (Read-only for PB, with minutes edit for Secretary) */}
      {selectedAppointment && (
        <Modal
          open={!!selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          title={`Appointment ${selectedAppointment.appointment_number}`}
        >
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between border-b border-gray/40 pb-3">
              <div>
                <span className="font-semibold text-dark text-base block">{selectedAppointment.full_name}</span>
                <span className="text-xs text-gray-500">
                  {selectedAppointment.applicant_type} · Ref: {selectedAppointment.appointment_number}
                </span>
              </div>
              <StatusBadge status={selectedAppointment.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2 text-gray-600">
                <FiClock className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="font-bold text-dark block">Date & Time</span>
                  <span className="font-semibold text-primary">
                    {new Date(selectedAppointment.appointment_date).toLocaleDateString("en-PH", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })} · {selectedAppointment.appointment_time || "Pending Time"}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-gray-600">
                <FiPhone className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="font-bold text-dark block">Contact Phone</span>
                  <span>{selectedAppointment.phone_number}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-gray-600">
                <FiMail className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="font-bold text-dark block">Email</span>
                  <span>{selectedAppointment.email || "No email on record"}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-gray-600">
                <FiMapPin className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="font-bold text-dark block">Address</span>
                  <span>{selectedAppointment.address || "Barangay Natumolan"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray/50 bg-gray-50/70 p-3">
              <span className="font-bold text-xs text-dark block mb-1">Purpose of Appointment:</span>
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                {selectedAppointment.purpose}
              </p>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-900">
                  <FiCheckCircle className="h-3.5 w-3.5 text-indigo-700" />
                  <span>Meeting Minutes & Actions Taken:</span>
                </div>
                {!isPb && (
                  <button
                    type="button"
                    onClick={() => handleOpenMinutes(selectedAppointment)}
                    className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    <FiEdit3 className="h-3 w-3" /> {selectedAppointment.minutes ? "Edit Minutes" : "Add Minutes"}
                  </button>
                )}
              </div>
              {selectedAppointment.minutes ? (
                <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {selectedAppointment.minutes}
                </p>
              ) : (
                <p className="text-xs text-gray-500 italic">
                  Walang minutes na nakatala sa kasalukuyan. {isSecretary && "Maaaring maglagay si Secretary matapos ang pagpupulong."}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray/40">
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="cursor-pointer rounded-full border border-gray px-5 py-2 text-xs font-semibold text-dark hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Minutes Editing Modal (Secretary only) */}
      {editingMinutes && (
        <Modal
          open={!!editingMinutes}
          onClose={() => setEditingMinutes(null)}
          title={`Appointment Minutes — ${editingMinutes.appointment_number}`}
        >
          <div className="space-y-4 text-sm">
            <p className="text-xs text-gray-600">
              Record or update the minutes and discussions for <strong>{editingMinutes.full_name}</strong>. Punong Barangay can read these minutes on this calendar.
            </p>

            <FormField label="Meeting Minutes & Notes">
              <textarea
                value={minutesText}
                onChange={(e) => setMinutesText(e.target.value)}
                placeholder="Discussions, agreements, or outcomes of the meeting…"
                rows={6}
                className={inputClasses}
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray/40">
              <button
                type="button"
                onClick={() => setEditingMinutes(null)}
                disabled={minutesLoading}
                className="cursor-pointer rounded-full border border-gray px-5 py-2 text-xs font-semibold text-dark hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMinutes}
                disabled={minutesLoading}
                className="cursor-pointer rounded-full bg-primary px-6 py-2 text-xs font-semibold text-white shadow hover:bg-primary-dark disabled:opacity-50"
              >
                {minutesLoading ? "Saving…" : "Save Minutes"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
