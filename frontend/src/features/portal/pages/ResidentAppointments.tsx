import { useEffect, useRef, useState } from "react";
import {
  FiClock,
  FiCheckCircle,
  FiPlus,
  FiInfo,
  FiAlertCircle,
  FiSlash,
} from "react-icons/fi";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import PageHeader from "../../../shared/ui/PageHeader";
import Modal from "../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import StatusBadge from "../../../shared/ui/StatusBadge";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { errorMessage } from "../../../shared/lib/api";
import { useAuth } from "../../../shared/auth/AuthContext";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";
import PhoneInput from "../../../shared/ui/PhoneInput";
import { localMobile, e164Mobile } from "../../../shared/lib/phone";
import { residentAppointmentApi } from "../../council/appointmentApi";
import type { Appointment } from "../../council/appointmentTypes";

const TIME_SLOTS = [
  "08:30 AM",
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "01:30 PM",
  "02:00 PM",
  "02:30 PM",
  "03:00 PM",
  "03:30 PM",
  "04:00 PM",
];

const normalizeTime = (t?: string | null) => (t ?? "").trim().toUpperCase().replace(/\s+/g, " ");

const parseSlotToMinutes = (slot: string): number | null => {
  const match = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour * 60 + min;
};

const isSlotInPastOrWithin30Mins = (slot: string, dateStr: string): boolean => {
  if (!dateStr || !slot) return false;
  const now = new Date();
  const todayYMD = now.toLocaleDateString("en-CA");
  if (dateStr < todayYMD) return true;
  if (dateStr > todayYMD) return false;

  const slotMinutes = parseSlotToMinutes(slot);
  if (slotMinutes === null) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return slotMinutes < currentMinutes + 30;
};

export default function ResidentAppointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [, setLoading] = useState(true);
  const pageLoad = usePageLoad();

  // Booking modal
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [purpose, setPurpose] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(() => user?.resident?.contact_number ?? "");
  const [email, setEmail] = useState(() => (user?.email ?? "").slice(0, 50));
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const submittingRef = useRef(false);

  // Time slot availability for date
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [, setLoadingSlots] = useState(false);

  // Cancel modal
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancellingLoading, setCancellingLoading] = useState(false);
  const cancellingRef = useRef(false);

  // Viewing modal
  const [viewing, setViewing] = useState<Appointment | null>(null);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    residentAppointmentApi
      .list()
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
  }, []);

  useEffect(() => {
    if (!phoneNumber && user?.resident?.contact_number) {
      setPhoneNumber(user.resident.contact_number);
    }
    if (!email && user?.email) {
      setEmail((user.email ?? "").slice(0, 50));
    }
  }, [user]);

  // Load booked slots when booking modal date changes
  useEffect(() => {
    if (!bookModalOpen || !appointmentDate) {
      setBookedSlots([]);
      return;
    }
    setLoadingSlots(true);
    residentAppointmentApi
      .bookedSlots(appointmentDate)
      .then((res) => {
        const slots = res.data.data.booked_slots ?? res.data.data.booked_times ?? [];
        setBookedSlots(slots);
      })
      .catch(() => {
        setBookedSlots([]);
      })
      .finally(() => setLoadingSlots(false));
  }, [bookModalOpen, appointmentDate]);

  useAutoRefresh(() => load(true), REFRESH.staff);
  usePulse("sessions", () => load(true));

  const handleOpenBook = () => {
    setAppointmentDate("");
    setAppointmentTime("");
    setPurpose("");
    setPhoneNumber(user?.resident?.contact_number ?? "");
    setEmail((user?.email ?? "").slice(0, 50));
    setFormErrors({});
    setBookedSlots([]);
    setBookModalOpen(true);
  };

  const handleBookSubmit = async () => {
    if (submittingRef.current) return;

    const errors: Record<string, string> = {};

    if (!appointmentDate) {
      errors.appointmentDate = "Appointment date is required.";
    }
    if (!appointmentTime.trim()) {
      errors.appointmentTime = "Preferred time slot is required.";
    } else if (bookedSlots.some((s) => normalizeTime(s) === normalizeTime(appointmentTime))) {
      errors.appointmentTime = "This time slot is already booked and unavailable. Please select another time.";
    } else if (isSlotInPastOrWithin30Mins(appointmentTime, appointmentDate)) {
      errors.appointmentTime = "Appointments scheduled for today must be booked at least 30 minutes in advance. The chosen slot is no longer available.";
    }
    const phoneDigits = localMobile(phoneNumber);
    if (!phoneDigits) {
      errors.phoneNumber = "Contact phone number is required.";
    } else if (phoneDigits.length !== 10) {
      errors.phoneNumber = "Contact phone number must be exactly 10 digits after +63.";
    }
    if (!email.trim()) {
      errors.email = "Email address is required for confirmation and reminders.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address (e.g. name@example.com).";
    } else if (email.trim().length > 50) {
      errors.email = "Email address must not exceed 50 characters.";
    }
    if (!purpose.trim()) {
      errors.purpose = "Purpose of appointment is required.";
    } else if (purpose.trim().length > 255) {
      errors.purpose = "Purpose must not exceed 255 characters.";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast("Please complete all required fields marked in red.", "error");
      return;
    }
    setFormErrors({});

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await residentAppointmentApi.book({
        appointment_date: appointmentDate,
        appointment_time: appointmentTime.trim(),
        purpose: purpose.trim().slice(0, 255),
        phone_number: e164Mobile(phoneNumber),
        email: email.trim().slice(0, 50),
      });
      toast(res.data?.message || "Appointment request submitted successfully!");
      setBookModalOpen(false);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleOpenCancel = (apt: Appointment) => {
    setCancelling(apt);
    setCancelReason("");
  };

  const handleSaveCancel = async () => {
    if (!cancelling || cancellingRef.current) return;
    if (!cancelReason.trim()) {
      toast("Please specify the reason for cancelling your appointment.", "error");
      return;
    }

    const confirmed = await confirmAction({
      title: "Cancel your appointment?",
      text: `Are you sure you want to cancel appointment ${cancelling.appointment_number}?`,
      confirmText: "Yes, cancel appointment",
      cancelText: "Keep appointment",
      danger: true,
    });
    if (!confirmed) return;

    cancellingRef.current = true;
    setCancellingLoading(true);
    try {
      const res = await residentAppointmentApi.cancel(cancelling.id, {
        reason: cancelReason.trim(),
      });
      toast(res.data?.message || "Appointment successfully cancelled.");
      setCancelling(null);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      cancellingRef.current = false;
      setCancellingLoading(false);
    }
  };

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Appointments"
        subtitle="Schedule appointments with the Punong Barangay and Barangay Hall, receive email reminders, and view meeting minutes"
        actions={
          <button
            type="button"
            onClick={handleOpenBook}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-dark"
          >
            <FiPlus className="h-4 w-4" /> Book an Appointment
          </button>
        }
      />

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-dark leading-relaxed">
        <div className="flex items-start gap-2.5">
          <FiInfo className="mt-0.5 h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="font-semibold text-primary">How Barangay Appointments Work</p>
            <p className="mt-0.5 text-gray-600">
              You can request an appointment for your concerns with the Punong Barangay or Barangay Hall. The Punong Barangay or Secretary will review your request, and you will receive notifications and an email confirmation once your schedule is confirmed.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <DataTable
          columns={[
            {
              header: "Reference",
              render: (a: Appointment) => (
                <span className="font-mono font-semibold text-dark">{a.appointment_number}</span>
              ),
            },
            {
              header: "Schedule",
              render: (a: Appointment) => (
                <div>
                  <div className="font-medium text-dark">
                    {new Date(a.appointment_date).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-primary font-semibold">
                    <FiClock className="h-3 w-3" /> {a.appointment_time || "Pending Time"}
                  </div>
                </div>
              ),
            },
            {
              header: "Purpose",
              render: (a: Appointment) => (
                <div className="max-w-md truncate text-xs text-gray-700" title={a.purpose}>
                  {a.purpose}
                </div>
              ),
            },
            {
              header: "Status",
              render: (a: Appointment) => <StatusBadge status={a.status} />,
            },
            {
              header: "Minutes",
              render: (a: Appointment) =>
                a.status === "Rejected" || a.status === "Cancelled" ? (
                  <span className="text-xs text-gray-400 italic">Not applicable</span>
                ) : a.minutes ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                    <FiCheckCircle className="h-3 w-3" /> Recorded
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">None yet</span>
                ),
            },
            {
              header: "Actions",
              render: (a: Appointment) => (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setViewing(a)}
                    className="cursor-pointer text-xs font-semibold text-primary hover:underline"
                  >
                    View Details
                  </button>
                  {(a.status === "Pending" || a.status === "Approved") && (
                    <button
                      type="button"
                      onClick={() => handleOpenCancel(a)}
                      className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline"
                    >
                      <FiSlash className="h-3 w-3" /> Cancel
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          rows={appointments}
          rowKey={(a) => a.id}
          numbered
          emptyMessage="You have no appointment bookings yet."
        />
      </Card>

      {/* Book Appointment Modal */}
      {bookModalOpen && (
        <Modal
          open={bookModalOpen}
          onClose={() => setBookModalOpen(false)}
          title="Book an Appointment"
          size="2xl"
        >
          <div className="space-y-4 text-sm">
            {/* Validation errors summary banner */}
            {Object.keys(formErrors).length > 0 && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <FiAlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>Please fill in all required fields marked in red:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-700">
                  {Object.values(formErrors).map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-gray-600">
              Please choose your desired appointment date and time slot. You will receive an email confirmation once reviewed and approved by the Barangay.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Preferred Date *">
                <input
                  type="date"
                  value={appointmentDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    setAppointmentDate(e.target.value);
                    setAppointmentTime("");
                    if (e.target.value) {
                      setFormErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.appointmentDate;
                        return copy;
                      });
                    }
                  }}
                  className={`${inputClasses} ${formErrors.appointmentDate ? "border-rose-500 focus:border-rose-600 focus:ring-rose-200" : ""}`}
                />
                {formErrors.appointmentDate && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.appointmentDate}</p>
                )}
              </FormField>
              <FormField
                label="Preferred Time *"
                hint={!appointmentDate ? "Please choose a date first to see available time slots" : undefined}
              >
                <select
                  value={appointmentTime}
                  disabled={!appointmentDate}
                  onChange={(e) => {
                    setAppointmentTime(e.target.value);
                    if (e.target.value) {
                      setFormErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.appointmentTime;
                        return copy;
                      });
                    }
                  }}
                  className={`${inputClasses} ${formErrors.appointmentTime ? "border-rose-500 focus:border-rose-600 focus:ring-rose-200" : ""}`}
                >
                  <option value="">-- Select Preferred Time --</option>
                  {TIME_SLOTS.map((slot) => {
                    const isBooked = bookedSlots.some(
                      (s) => normalizeTime(s) === normalizeTime(slot)
                    );
                    const isPastOrSoon = isSlotInPastOrWithin30Mins(slot, appointmentDate);
                    return (
                      <option key={slot} value={slot} disabled={isBooked || isPastOrSoon}>
                        {slot}{" "}
                        {isBooked
                          ? "— (Unavailable - Booked)"
                          : isPastOrSoon
                          ? "— (Unavailable - Past / Cutoff)"
                          : ""}
                      </option>
                    );
                  })}
                </select>
                {formErrors.appointmentTime && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.appointmentTime}</p>
                )}
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Contact Phone Number *">
                <div className={formErrors.phoneNumber ? "rounded-xl ring-2 ring-rose-500 p-0.5" : ""}>
                  <PhoneInput
                    value={phoneNumber}
                    onChange={(val) => {
                      setPhoneNumber(val);
                      if (val.trim()) {
                        setFormErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.phoneNumber;
                          return copy;
                        });
                      }
                    }}
                    placeholder="9XX XXX XXXX"
                  />
                </div>
                {formErrors.phoneNumber && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.phoneNumber}</p>
                )}
              </FormField>
              <FormField
                label="Email Address *"
                hint={`${50 - email.length} characters left (for confirmation & reminders)`}
              >
                <input
                  type="email"
                  value={email}
                  maxLength={50}
                  onChange={(e) => {
                    setEmail(e.target.value.slice(0, 50));
                    if (e.target.value.trim()) {
                      setFormErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.email;
                        return copy;
                      });
                    }
                  }}
                  placeholder="name@example.com"
                  className={`${inputClasses} ${formErrors.email ? "border-rose-500 focus:border-rose-600 focus:ring-rose-200" : ""}`}
                />
                {formErrors.email && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.email}</p>
                )}
              </FormField>
            </div>

            <FormField
              label="Purpose of Appointment *"
              hint={`${255 - purpose.length} characters left (max 255)`}
            >
              <textarea
                value={purpose}
                maxLength={255}
                onChange={(e) => {
                  setPurpose(e.target.value.slice(0, 255));
                  if (e.target.value.trim()) {
                    setFormErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.purpose;
                      return copy;
                    });
                  }
                }}
                placeholder="State the purpose of your appointment…"
                rows={4}
                className={`${inputClasses} ${formErrors.purpose ? "border-rose-500 focus:border-rose-600 focus:ring-rose-200" : ""}`}
              />
              {formErrors.purpose && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.purpose}</p>
              )}
            </FormField>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray/40">
              <button
                type="button"
                onClick={() => setBookModalOpen(false)}
                disabled={submitting}
                className="cursor-pointer rounded-full border border-gray px-5 py-2 text-xs font-semibold text-dark hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBookSubmit}
                disabled={submitting}
                className="cursor-pointer rounded-full bg-primary px-6 py-2 text-xs font-semibold text-white shadow hover:bg-primary-dark disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Appointment Modal for Resident */}
      {cancelling && (
        <Modal
          open={!!cancelling}
          onClose={() => setCancelling(null)}
          title={`Cancel Appointment ${cancelling.appointment_number}`}
        >
          <div className="space-y-4 text-sm">
            <p className="text-xs text-gray-600">
              Are you sure you want to cancel your appointment scheduled for{" "}
              <strong>
                {new Date(cancelling.appointment_date).toLocaleDateString("en-PH", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </strong>{" "}
              ({cancelling.appointment_time || "Pending Time"})?
            </p>

            <FormField
              label="Reason for Cancellation *"
              hint="Please state why you are cancelling your appointment"
            >
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Personal emergency, need to reschedule to a later date..."
                rows={3}
                className={inputClasses}
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray/40">
              <button
                type="button"
                onClick={() => setCancelling(null)}
                disabled={cancellingLoading}
                className="cursor-pointer rounded-full border border-gray px-5 py-2 text-xs font-semibold text-dark hover:bg-gray-100"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                onClick={handleSaveCancel}
                disabled={cancellingLoading}
                className="cursor-pointer rounded-full bg-rose-600 px-6 py-2 text-xs font-semibold text-white shadow hover:bg-rose-700 disabled:opacity-50"
              >
                {cancellingLoading ? "Cancelling…" : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* View Appointment Details Modal */}
      {viewing && (
        <Modal
          open={!!viewing}
          onClose={() => setViewing(null)}
          title={`Appointment ${viewing.appointment_number}`}
        >
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between border-b border-gray/40 pb-3">
              <span className="font-semibold text-dark text-base">{viewing.appointment_number}</span>
              <StatusBadge status={viewing.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-bold text-dark block">Scheduled Date</span>
                <span className="text-gray-700">
                  {new Date(viewing.appointment_date).toLocaleDateString("en-PH", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div>
                <span className="font-bold text-dark block">Scheduled Time</span>
                <span className="font-semibold text-primary">
                  {viewing.appointment_time || "Pending Time Confirmation"}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-gray/50 bg-gray-50/70 p-3">
              <span className="font-bold text-xs text-dark block mb-1">Purpose / Details:</span>
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{viewing.purpose}</p>
            </div>

            {viewing.status === "Rejected" || viewing.status === "Cancelled" ? (
              <div className="rounded-xl border border-gray/50 bg-gray-50/70 p-3">
                <span className="font-bold text-xs text-dark block mb-1">Meeting Minutes:</span>
                <p className="text-xs text-gray-400 italic">Not applicable</p>
              </div>
            ) : viewing.minutes ? (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-900 mb-1">
                  <FiCheckCircle className="h-3.5 w-3.5 text-indigo-700" />
                  <span>Minutes of Meeting & Resolutions:</span>
                </div>
                <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">{viewing.minutes}</p>
              </div>
            ) : null}

            {viewing.rejection_reason && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-800">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <FiAlertCircle className="h-3.5 w-3.5 text-rose-600" />
                  <span>Rejection Notice:</span>
                </div>
                <p>{viewing.rejection_reason}</p>
              </div>
            )}

            {viewing.cancel_reason && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                <span className="font-bold block mb-1">Cancellation Notice:</span>
                <p>{viewing.cancel_reason}</p>
                {viewing.cancelled_at && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Cancelled on {new Date(viewing.cancelled_at).toLocaleString("en-PH")}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="cursor-pointer rounded-full border border-gray px-5 py-2 text-xs font-semibold text-dark hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
