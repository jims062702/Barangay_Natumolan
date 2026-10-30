import { useEffect, useState } from "react";
import {
  FiClock,
  FiCheckCircle,
  FiPlus,
  FiInfo,
  FiAlertCircle,
} from "react-icons/fi";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import PageHeader from "../../../shared/ui/PageHeader";
import Modal from "../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import StatusBadge from "../../../shared/ui/StatusBadge";
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

  useAutoRefresh(() => load(true), REFRESH.staff);
  usePulse("sessions", () => load(true));

  const handleOpenBook = () => {
    setAppointmentDate("");
    setAppointmentTime("");
    setPurpose("");
    setPhoneNumber(user?.resident?.contact_number ?? "");
    setEmail((user?.email ?? "").slice(0, 50));
    setBookModalOpen(true);
  };

  const handleBookSubmit = async () => {
    if (!appointmentDate) {
      toast("Please pick a desired appointment date.", "error");
      return;
    }
    if (!appointmentTime.trim()) {
      toast("Please select a preferred time.", "error");
      return;
    }
    if (!purpose.trim()) {
      toast("Please specify the purpose of your appointment.", "error");
      return;
    }
    if (purpose.trim().length > 255) {
      toast("Purpose must not exceed 255 characters.", "error");
      return;
    }
    const phoneDigits = localMobile(phoneNumber);
    if (!phoneDigits) {
      toast("Please provide an active contact phone number.", "error");
      return;
    }
    if (phoneDigits.length !== 10) {
      toast("Contact phone number must be exactly 10 digits after +63.", "error");
      return;
    }
    if (email.trim().length > 50) {
      toast("Email address must not exceed 50 characters.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await residentAppointmentApi.book({
        appointment_date: appointmentDate,
        appointment_time: appointmentTime.trim(),
        purpose: purpose.trim().slice(0, 255),
        phone_number: e164Mobile(phoneNumber),
        email: email.trim().slice(0, 50) || undefined,
      });
      toast(res.data?.message || "Appointment request submitted successfully!");
      setBookModalOpen(false);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSubmitting(false);
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
            <p className="font-semibold text-primary">Paano gumagana ang Barangay Appointment?</p>
            <p className="mt-0.5 text-gray-600">
              Maaari kayong mag-request ng appointment para sa inyong mga pakay sa Punong Barangay o tanggapan ng barangay. Susuriin ito ng Barangay Secretary at makakatanggap kayo ng notification sa dashboard at email confirmation kung kailan at anong oras ang inyong schedule.
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
                a.minutes ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                    <FiCheckCircle className="h-3 w-3" /> Recorded
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">None</span>
                ),
            },
            {
              header: "Details",
              render: (a: Appointment) => (
                <button
                  type="button"
                  onClick={() => setViewing(a)}
                  className="cursor-pointer text-xs font-semibold text-primary hover:underline"
                >
                  View Details
                </button>
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
        >
          <div className="space-y-4 text-sm">
            <p className="text-xs text-gray-600">
              Pumili ng inyong nais na petsa at oras para sa inyong pakay. Makakatanggap kayo ng kumpirmasyon sa inyong email kapag na-aprubahan ito ng Barangay Secretary.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Preferred Date">
                <input
                  type="date"
                  value={appointmentDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Preferred Time">
                <select
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  className={inputClasses}
                >
                  <option value="">-- Select Preferred Time --</option>
                  <option value="08:30 AM">08:30 AM</option>
                  <option value="09:00 AM">09:00 AM</option>
                  <option value="09:30 AM">09:30 AM</option>
                  <option value="10:00 AM">10:00 AM</option>
                  <option value="10:30 AM">10:30 AM</option>
                  <option value="11:00 AM">11:00 AM</option>
                  <option value="01:30 PM">01:30 PM</option>
                  <option value="02:00 PM">02:00 PM</option>
                  <option value="02:30 PM">02:30 PM</option>
                  <option value="03:00 PM">03:00 PM</option>
                  <option value="03:30 PM">03:30 PM</option>
                  <option value="04:00 PM">04:00 PM</option>
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Contact Phone Number">
                <PhoneInput
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  placeholder="9XX XXX XXXX"
                />
              </FormField>
              <FormField
                label="Email Address (for Confirmation & Reminders)"
                hint={`${50 - email.length} characters left (max 50)`}
              >
                <input
                  type="email"
                  value={email}
                  maxLength={50}
                  onChange={(e) => setEmail(e.target.value.slice(0, 50))}
                  placeholder="name@example.com"
                  className={inputClasses}
                />
              </FormField>
            </div>

            <FormField
              label="Purpose of Appointment (Pakay o Sadya)"
              hint={`${255 - purpose.length} characters left (max 255)`}
            >
              <textarea
                value={purpose}
                maxLength={255}
                onChange={(e) => setPurpose(e.target.value.slice(0, 255))}
                placeholder="Ilarawan ang inyong pakay sa pakikipag-appointment…"
                rows={4}
                className={inputClasses}
              />
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

            {viewing.minutes && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-900 mb-1">
                  <FiCheckCircle className="h-3.5 w-3.5 text-indigo-700" />
                  <span>Minutes of Meeting & Resolutions:</span>
                </div>
                <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">{viewing.minutes}</p>
              </div>
            )}

            {viewing.rejection_reason && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-800">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <FiAlertCircle className="h-3.5 w-3.5 text-rose-600" />
                  <span>Rejection Notice:</span>
                </div>
                <p>{viewing.rejection_reason}</p>
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
