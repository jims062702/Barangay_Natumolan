import { useState } from "react";
import Modal from "../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import { ResidentIdCheck, BLANK_RESIDENT_ID, type ResidentIdValue } from "../../../shared/residentCard/ResidentIdCheck";
import { publicAppointmentApi } from "../../council/appointmentApi";
import { toast } from "../../../shared/lib/toast";
import { errorMessage } from "../../../shared/lib/api";
import { FiCheckCircle } from "react-icons/fi";
import { publicApi } from "../api";
import type { IdCheckSummary } from "../../../shared/residentCard/ResidentIdCheck";

interface BookAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  defaultPurpose?: string;
}

export default function BookAppointmentModal({
  open,
  onClose,
  defaultPurpose = "",
}: BookAppointmentModalProps) {
  const [residentId, setResidentId] = useState<ResidentIdValue>(BLANK_RESIDENT_ID);
  const [appointmentDate, setAppointmentDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [appointmentTime, setAppointmentTime] = useState("09:00 AM");
  const [purpose, setPurpose] = useState(defaultPurpose);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmedNumber, setConfirmedNumber] = useState<string | null>(null);
  const verify = async (c: string) => (await publicApi.verifyResidentId({ code: c })).data.data as IdCheckSummary;

  const handleSubmit = async () => {
    if (residentId.status !== "verified" || !residentId.code) {
      toast("Please scan or verify your Barangay Resident ID first.", "error");
      return;
    }
    if (!appointmentDate) {
      toast("Please select a date.", "error");
      return;
    }
    if (!appointmentTime.trim()) {
      toast("Please select an appointment time.", "error");
      return;
    }
    if (!purpose.trim()) {
      toast("Please state your purpose for the appointment.", "error");
      return;
    }
    if (!phoneNumber.trim()) {
      toast("Please provide an active phone number.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await publicAppointmentApi.book({
        id_card_code: residentId.code,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime.trim(),
        purpose: purpose.trim(),
        phone_number: phoneNumber.trim(),
        email: email.trim() || undefined,
      });

      const apt = res.data?.data?.appointment;
      setConfirmedNumber(apt?.appointment_number || "CONFIRMED");
      toast(res.data?.message || "Appointment request submitted successfully!");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setResidentId(BLANK_RESIDENT_ID);
    setConfirmedNumber(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Book an Official Appointment">
      {confirmedNumber ? (
        <div className="space-y-4 text-center py-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <FiCheckCircle className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-dark">Appointment Request Submitted!</h3>
            <p className="mt-1 text-xs text-gray-600">
              Your appointment reference number is:
            </p>
            <div className="mt-2 inline-block rounded-xl bg-primary/10 px-4 py-2 font-mono text-base font-bold text-primary">
              {confirmedNumber}
            </div>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed max-w-sm mx-auto">
            Susuriin ito ng Barangay Secretary. Kung kayo ay naglagay ng email o may portal account, makakatanggap kayo ng notice at kumpirmasyon sa inyong nakatakdang iskedyul.
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="cursor-pointer rounded-full bg-primary px-8 py-2 text-xs font-semibold text-white hover:bg-primary-dark"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-dark leading-relaxed">
            <p className="font-semibold text-primary">Barangay Resident Verification Required</p>
            <p className="mt-0.5 text-gray-600">
              I-upload ang litrato ng inyong <strong>Barangay Resident ID</strong> o i-type ang 12-character verification code sa ibaba upang makapag-book ng appointment.
            </p>
          </div>

          <ResidentIdCheck
            value={residentId}
            onChange={setResidentId}
            mode="public"
            verify={verify}
          />

          {residentId.status === "verified" && (
            <div className="space-y-3 pt-2 border-t border-gray/40">
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
                  <input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="09123456789"
                    className={inputClasses}
                  />
                </FormField>
                <FormField label="Email (for reminders & confirmation)">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your-email@example.com"
                    className={inputClasses}
                  />
                </FormField>
              </div>

              <FormField label="Purpose of Appointment (Pakay / Sadya)">
                <textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Ilarawan ang layunin ng inyong appointment sa Barangay Hall…"
                  rows={3}
                  className={inputClasses}
                />
              </FormField>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray/40">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="cursor-pointer rounded-full border border-gray px-5 py-2 text-xs font-semibold text-dark hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || residentId.status !== "verified"}
              className="cursor-pointer rounded-full bg-primary px-6 py-2 text-xs font-semibold text-white shadow hover:bg-primary-dark disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Confirm Appointment Booking"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
