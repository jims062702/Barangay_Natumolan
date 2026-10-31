import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiEye,
  FiPlus,
  FiTrash2,
  FiXCircle,
  FiUser,
  FiMapPin,
  FiPhone,
  FiMail,
  FiSlash,
  FiAlertTriangle,
} from "react-icons/fi";
import { useAuth } from "../../../shared/auth/AuthContext";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import PageHeader from "../../../shared/ui/PageHeader";
import Modal from "../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import StatusBadge from "../../../shared/ui/StatusBadge";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { errorMessage } from "../../../shared/lib/api";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";
import { appointmentApi } from "../appointmentApi";
import type { Appointment } from "../appointmentTypes";
import ResidentPicker from "../../resident/components/ResidentPicker";
import PhoneInput from "../../../shared/ui/PhoneInput";
import { localMobile, e164Mobile } from "../../../shared/lib/phone";
import type { Resident } from "../../../shared/types";

const TABS = ["All", "Pending", "Approved", "Completed", "Cancelled", "Rejected"] as const;

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

export const parseSlotToMinutes = (slot: string): number | null => {
  const match = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour * 60 + min;
};

export const isSlotInPastOrWithin30Mins = (slot: string, dateStr: string): boolean => {
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

export default function AppointmentsList() {
  const { user } = useAuth();
  const isSecretary = user?.role === "Secretary" || user?.role === "Admin";

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [, setLoading] = useState(true);
  const pageLoad = usePageLoad();

  // Viewing detail modal
  const [viewing, setViewing] = useState<Appointment | null>(null);

  // Walk-in creation modal (Secretary)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [applicantType, setApplicantType] = useState<"Resident" | "Non-resident">("Resident");
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [purpose, setPurpose] = useState("");
  const [savingWalkIn, setSavingWalkIn] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const savingWalkInRef = useRef(false);

  // Slot availability for Walk-in
  const [walkInBookedSlots, setWalkInBookedSlots] = useState<string[]>([]);
  const [walkInPendingCounts, setWalkInPendingCounts] = useState<Record<string, number>>({});

  // Approve modal (PB or Secretary)
  const [approving, setApproving] = useState<Appointment | null>(null);
  const [approveTime, setApproveTime] = useState("");
  const [approveDate, setApproveDate] = useState("");
  const [approveBookedSlots, setApproveBookedSlots] = useState<string[]>([]);
  const [approvePendingCounts, setApprovePendingCounts] = useState<Record<string, number>>({});
  const [approvingLoading, setApprovingLoading] = useState(false);
  const approvingRef = useRef(false);

  // Reject modal (PB or Secretary)
  const [rejecting, setRejecting] = useState<Appointment | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectingLoading, setRejectingLoading] = useState(false);
  const rejectingRef = useRef(false);

  // Cancel modal (PB or Secretary)
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancellingLoading, setCancellingLoading] = useState(false);
  const cancellingRef = useRef(false);

  // Minutes modal (Secretary only)
  const [editingMinutes, setEditingMinutes] = useState<Appointment | null>(null);
  const [minutesText, setMinutesText] = useState("");
  const [minutesLoading, setMinutesLoading] = useState(false);
  const minutesRef = useRef(false);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    appointmentApi
      .list({
        params: {
          page,
          status: activeTab,
          search: search.trim() || undefined,
        },
      })
      .then((r) => {
        const respData = r.data.data;
        const list = respData.appointments?.data ?? respData.data ?? [];
        const last = respData.appointments?.last_page ?? respData.last_page ?? 1;
        const tot = respData.appointments?.total ?? respData.total ?? 0;
        setAppointments(list);
        setLastPage(last);
        setTotal(tot);
        if (respData.counts) {
          setCounts(respData.counts);
        }
      })
      .then(
        () => pageLoad.done(),
        (err) => {
          pageLoad.fail(err);
          throw err;
        }
      )
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activeTab, search]);

  useAutoRefresh(() => load(true), REFRESH.staff);
  usePulse("sessions", () => load(true));

  // Load booked slots when walk-in date changes
  useEffect(() => {
    if (!createModalOpen || !appointmentDate) {
      setWalkInBookedSlots([]);
      setWalkInPendingCounts({});
      return;
    }
    appointmentApi
      .bookedSlots(appointmentDate)
      .then((res) => {
        const slots = res.data.data.booked_slots ?? res.data.data.booked_times ?? [];
        const pending = res.data.data.pending_slot_counts ?? res.data.data.pending_counts ?? {};
        setWalkInBookedSlots(slots);
        setWalkInPendingCounts(pending);
      })
      .catch(() => {
        setWalkInBookedSlots([]);
        setWalkInPendingCounts({});
      });
  }, [createModalOpen, appointmentDate]);

  // Load booked slots when approve date changes
  useEffect(() => {
    if (!approving || !approveDate) {
      setApproveBookedSlots([]);
      setApprovePendingCounts({});
      return;
    }
    appointmentApi
      .bookedSlots(approveDate, approving.id)
      .then((res) => {
        const slots = res.data.data.booked_slots ?? res.data.data.booked_times ?? [];
        const pending = res.data.data.pending_slot_counts ?? res.data.data.pending_counts ?? {};
        setApproveBookedSlots(slots);
        setApprovePendingCounts(pending);
      })
      .catch(() => {
        setApproveBookedSlots([]);
        setApprovePendingCounts({});
      });
  }, [approving, approveDate]);

  const handleOpenWalkIn = () => {
    setApplicantType("Resident");
    setSelectedResident(null);
    setFullName("");
    setAddress("");
    setPhoneNumber("");
    setEmail("");
    setAppointmentDate("");
    setAppointmentTime("");
    setPurpose("");
    setFormErrors({});
    setWalkInBookedSlots([]);
    setWalkInPendingCounts({});
    setCreateModalOpen(true);
  };

  const handleResidentSelect = (res: Resident | null) => {
    setSelectedResident(res);
    if (res) {
      setFullName(
        `${res.first_name} ${res.middle_name ? res.middle_name + " " : ""}${res.last_name}${
          res.suffix ? " " + res.suffix : ""
        }`
      );
      setAddress(
        res.address ? `${res.address}, ${res.zone_purok ?? ""}` : res.zone_purok ?? "Barangay Natumolan"
      );
      setPhoneNumber(res.contact_number ?? "");
      const resEmail = res.email || res.account?.email || "";
      setEmail(resEmail.slice(0, 50));
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy.resident;
        delete copy.fullName;
        delete copy.address;
        if (res.contact_number) delete copy.phoneNumber;
        if (resEmail) delete copy.email;
        return copy;
      });
    } else {
      setFullName("");
      setAddress("");
      setPhoneNumber("");
      setEmail("");
    }
  };

  const handleSaveWalkIn = async () => {
    if (savingWalkInRef.current) return;

    const errors: Record<string, string> = {};

    if (applicantType === "Resident" && !selectedResident) {
      errors.resident = "Please select a registered resident.";
    }
    if (!fullName.trim()) {
      errors.fullName = "Full name is required.";
    }
    if (!address.trim()) {
      errors.address = "Complete address is required.";
    }
    const phoneDigits = localMobile(phoneNumber);
    if (!phoneDigits) {
      errors.phoneNumber = "Contact phone number is required.";
    } else if (phoneDigits.length !== 10) {
      errors.phoneNumber = "Phone number must be exactly 10 digits after +63.";
    }
    if (!email.trim()) {
      errors.email = "Email address is required for confirmation and notifications.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address (e.g. resident@example.com).";
    } else if (email.trim().length > 50) {
      errors.email = "Email address must not exceed 50 characters.";
    }
    if (!appointmentDate) {
      errors.appointmentDate = "Appointment date is required.";
    }
    if (!appointmentTime.trim()) {
      errors.appointmentTime = "Appointment time slot is required.";
    } else if (walkInBookedSlots.some((s) => normalizeTime(s) === normalizeTime(appointmentTime))) {
      errors.appointmentTime = "This time slot is already booked and unavailable. Please choose another time.";
    } else if (isSlotInPastOrWithin30Mins(appointmentTime, appointmentDate)) {
      errors.appointmentTime = "Appointments scheduled for today must be filed at least 30 minutes in advance. The chosen slot is no longer available.";
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

    savingWalkInRef.current = true;
    setSavingWalkIn(true);
    try {
      const res = await appointmentApi.createWalkIn({
        applicant_type: applicantType,
        resident_id: selectedResident?.id ?? null,
        full_name: fullName.trim(),
        address: address.trim(),
        phone_number: e164Mobile(phoneNumber),
        email: email.trim().slice(0, 50),
        appointment_date: appointmentDate,
        appointment_time: appointmentTime.trim(),
        purpose: purpose.trim().slice(0, 255),
      });
      toast(res.data?.message || "Walk-in appointment recorded successfully.");
      setCreateModalOpen(false);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      savingWalkInRef.current = false;
      setSavingWalkIn(false);
    }
  };

  const handleOpenApprove = (apt: Appointment) => {
    setApproving(apt);
    setApproveDate(apt.appointment_date);
    setApproveTime(apt.appointment_time || "09:00 AM");
  };

  const handleSaveApprove = async () => {
    if (!approving || approvingRef.current) return;
    if (!approveDate) {
      toast("Please specify the confirmed appointment date.", "error");
      return;
    }
    if (!approveTime.trim()) {
      toast("Please specify the confirmed appointment time.", "error");
      return;
    }
    if (approveBookedSlots.includes(approveTime.trim())) {
      toast("This time slot is already booked for another approved appointment. Please choose a different time or date.", "error");
      return;
    }
    if (isSlotInPastOrWithin30Mins(approveTime, approveDate)) {
      toast("Appointments scheduled for today must be confirmed at least 30 minutes in advance. The chosen slot is no longer available.", "error");
      return;
    }

    if (!window.confirm(`Are you sure you want to approve this appointment for ${approving.full_name} on ${approveDate} at ${approveTime}?`)) {
      return;
    }

    approvingRef.current = true;
    setApprovingLoading(true);
    try {
      const res = await appointmentApi.approve(approving.id, {
        appointment_date: approveDate,
        appointment_time: approveTime.trim(),
      });
      toast(res.data?.message || "Appointment approved.");
      setApproving(null);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      approvingRef.current = false;
      setApprovingLoading(false);
    }
  };

  const handleSaveReject = async () => {
    if (!rejecting || rejectingRef.current) return;
    if (!rejectionReason.trim()) {
      toast("Please state the reason for rejecting.", "error");
      return;
    }

    if (!window.confirm(`Are you sure you want to reject appointment ${rejecting.appointment_number}? A notification email will be sent to the applicant.`)) {
      return;
    }

    rejectingRef.current = true;
    setRejectingLoading(true);
    try {
      const res = await appointmentApi.reject(rejecting.id, {
        rejection_reason: rejectionReason.trim(),
      });
      toast(res.data?.message || "Appointment rejected.");
      setRejecting(null);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      rejectingRef.current = false;
      setRejectingLoading(false);
    }
  };

  const handleOpenCancel = (apt: Appointment) => {
    setCancelling(apt);
    setCancelReason("");
  };

  const handleSaveCancel = async () => {
    if (!cancelling || cancellingRef.current) return;
    if (!cancelReason.trim()) {
      toast("Please provide the reason for cancellation.", "error");
      return;
    }

    if (!window.confirm(`Are you sure you want to cancel appointment ${cancelling.appointment_number}? This action will reopen the booked slot.`)) {
      return;
    }

    cancellingRef.current = true;
    setCancellingLoading(true);
    try {
      const res = await appointmentApi.cancel(cancelling.id, {
        cancel_reason: cancelReason.trim(),
        reason: cancelReason.trim(),
      });
      toast(res.data?.message || "Appointment cancelled.");
      setCancelling(null);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      cancellingRef.current = false;
      setCancellingLoading(false);
    }
  };

  const handleOpenMinutes = (apt: Appointment) => {
    setEditingMinutes(apt);
    setMinutesText(apt.minutes || "");
  };

  const handleSaveMinutes = async () => {
    if (!editingMinutes || minutesRef.current) return;
    if (!minutesText.trim()) {
      toast("Please enter the minutes of the appointment.", "error");
      return;
    }
    const todayYMD = new Date().toLocaleDateString("en-CA");
    if (editingMinutes.appointment_date > todayYMD) {
      toast("Minutes can only be recorded on or after the scheduled appointment date.", "error");
      return;
    }
    minutesRef.current = true;
    setMinutesLoading(true);
    try {
      const res = await appointmentApi.updateMinutes(editingMinutes.id, {
        minutes: minutesText.trim(),
      });
      toast(res.data?.message || "Appointment minutes saved and marked as completed.");
      setEditingMinutes(null);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      minutesRef.current = false;
      setMinutesLoading(false);
    }
  };

  const handleDelete = async (apt: Appointment) => {
    const confirmed = await confirmAction({
      title: `Delete appointment ${apt.appointment_number}?`,
      text: `Are you sure you want to delete this appointment for ${apt.full_name}? This cannot be undone.`,
      confirmText: "Yes, delete",
      danger: true,
    });
    if (!confirmed) return;

    try {
      const res = await appointmentApi.delete(apt.id);
      toast(res.data?.message || "Appointment deleted.");
      if (viewing?.id === apt.id) setViewing(null);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => load()} />;

  const isApproveConflict = approveBookedSlots.includes(approveTime.trim());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        subtitle="Manage and monitor online and walk-in appointments for residents and non-residents"
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/appointments/calendar"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
            >
              <FiCalendar className="h-4 w-4" /> Appointments Calendar
            </Link>
            {isSecretary && (
              <button
                type="button"
                onClick={handleOpenWalkIn}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-dark"
              >
                <FiPlus className="h-4 w-4" /> New Walk-in Appointment
              </button>
            )}
          </div>
        }
      />

      <Card>
        {/* Filter Tabs with numeric counts */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray/60 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => {
              const count = counts[tab] ?? (tab === "All" ? total : 0);
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab);
                    setPage(1);
                  }}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    activeTab === tab
                      ? "bg-primary text-white shadow-2xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <span>{tab}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      activeTab === tab ? "bg-white/25 text-white" : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <DataTable
          columns={[
            {
              header: "Reference",
              render: (a: Appointment) => (
                <div>
                  <span className="font-mono font-semibold text-dark">{a.appointment_number}</span>
                  {a.is_walk_in ? (
                    <span className="ml-1.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
                      Walk-in
                    </span>
                  ) : (
                    <span className="ml-1.5 rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200">
                      Online
                    </span>
                  )}
                </div>
              ),
            },
            {
              header: "Applicant",
              render: (a: Appointment) => (
                <div>
                  <div className="font-semibold text-dark">{a.full_name}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span
                      className={
                        a.applicant_type === "Resident"
                          ? "text-primary font-medium"
                          : "text-amber-700 font-medium"
                      }
                    >
                      {a.applicant_type}
                    </span>
                    <span>·</span>
                    <span>{a.phone_number}</span>
                  </div>
                </div>
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
                    <FiClock className="h-3 w-3" /> {a.appointment_time || "Pending time"}
                  </div>
                </div>
              ),
            },
            {
              header: "Purpose",
              render: (a: Appointment) => (
                <div className="max-w-xs truncate text-xs text-gray-700" title={a.purpose}>
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
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setViewing(a)}
                    title="View details"
                    aria-label="View appointment details"
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray text-gray-500 transition hover:border-primary hover:text-primary"
                  >
                    <FiEye className="h-4 w-4" />
                  </button>

                  {/* PB and Secretary can Approve or Reject Pending appointments */}
                  {a.status === "Pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenApprove(a)}
                        title="Approve appointment"
                        aria-label="Approve appointment"
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-600 hover:text-white"
                      >
                        <FiCheckCircle className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejecting(a);
                          setRejectionReason("");
                        }}
                        title="Reject appointment"
                        aria-label="Reject appointment"
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-rose-300 bg-rose-50 text-rose-700 transition hover:bg-rose-600 hover:text-white"
                      >
                        <FiXCircle className="h-4 w-4" />
                      </button>
                    </>
                  )}

                  {/* Cancel button for Pending or Approved appointments */}
                  {(a.status === "Pending" || a.status === "Approved") && (
                    <button
                      type="button"
                      onClick={() => handleOpenCancel(a)}
                      title="Cancel appointment"
                      aria-label="Cancel appointment"
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-700 transition hover:bg-amber-600 hover:text-white"
                    >
                      <FiSlash className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Minutes can ONLY be added/edited by Secretary if Approved or Completed, and on/after scheduled date */}
                  {isSecretary && (a.status === "Approved" || a.status === "Completed") && (
                    <button
                      type="button"
                      disabled={a.appointment_date > new Date().toLocaleDateString("en-CA")}
                      onClick={() => handleOpenMinutes(a)}
                      title={
                        a.appointment_date > new Date().toLocaleDateString("en-CA")
                          ? "Minutes can only be recorded on or after the scheduled appointment date"
                          : "Record or update meeting minutes"
                      }
                      aria-label="Record minutes"
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                        a.appointment_date > new Date().toLocaleDateString("en-CA")
                          ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                          : "cursor-pointer border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white"
                      }`}
                    >
                      <FiEdit3 className="h-4 w-4" />
                    </button>
                  )}

                  {/* Delete button (Secretary or PB) */}
                  <button
                    type="button"
                    onClick={() => handleDelete(a)}
                    title="Delete appointment"
                    aria-label="Delete appointment"
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray text-gray-400 transition hover:border-danger hover:bg-danger/10 hover:text-danger"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
              ),
            },
          ]}
          rows={appointments}
          rowKey={(a) => a.id}
          numbered
          total={total}
          searchable
          searchValue={search}
          onSearch={(val) => {
            setSearch(val);
            setPage(1);
          }}
          searchPlaceholder="Search by reference, applicant name, phone, or purpose…"
          emptyMessage="No appointments found."
          page={page}
          lastPage={lastPage}
          onPageChange={setPage}
        />
      </Card>

      {/* Viewing Details Modal */}
      {viewing && (
        <Modal
          open={!!viewing}
          onClose={() => setViewing(null)}
          title={`Appointment ${viewing.appointment_number}`}
        >
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between border-b border-gray/40 pb-3">
              <span className="font-semibold text-dark text-base">{viewing.full_name}</span>
              <StatusBadge status={viewing.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2 text-gray-600">
                <FiUser className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="font-bold text-dark block">Applicant Type</span>
                  <span>
                    {viewing.applicant_type} {viewing.is_walk_in && "(Walk-in Booking)"}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-gray-600">
                <FiPhone className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="font-bold text-dark block">Contact Phone</span>
                  <span>{viewing.phone_number}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-gray-600">
                <FiMail className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="font-bold text-dark block">Email Address</span>
                  <span>{viewing.email || "No email on record"}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-gray-600">
                <FiMapPin className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="font-bold text-dark block">Address</span>
                  <span>{viewing.address || "Barangay Natumolan"}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-gray-600 sm:col-span-2">
                <FiCalendar className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="font-bold text-dark block">Scheduled Date & Time</span>
                  <span className="font-semibold text-primary">
                    {new Date(viewing.appointment_date).toLocaleDateString("en-PH", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    · {viewing.appointment_time || "Pending Time Confirmation"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray/50 bg-gray-50/70 p-3">
              <span className="font-bold text-xs text-dark block mb-1">Purpose / Details:</span>
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                {viewing.purpose}
              </p>
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
                  <span>Minutes of Appointment / Discussion:</span>
                </div>
                <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {viewing.minutes}
                </p>
              </div>
            ) : null}

            {viewing.rejection_reason && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-800">
                <span className="font-bold block mb-1">Rejection Reason:</span>
                <p>{viewing.rejection_reason}</p>
              </div>
            )}

            {viewing.cancel_reason && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
                <span className="font-bold block mb-1">Cancellation Reason:</span>
                <p>{viewing.cancel_reason}</p>
                {viewing.cancelled_at && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Cancelled on {new Date(viewing.cancelled_at).toLocaleString("en-PH")}
                    {viewing.canceller && ` by ${viewing.canceller.name}`}
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

      {/* New Walk-in Appointment Modal (Secretary) */}
      {createModalOpen && (
        <Modal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Record Walk-in Appointment"
          size="2xl"
        >
          <div className="space-y-3.5 text-sm">
            {/* Validation errors summary banner */}
            {Object.keys(formErrors).length > 0 && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <FiAlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>Please fill in all required fields marked in red:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-700">
                  {Object.values(formErrors).map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-4 border-b border-gray/40 pb-3">
              <span className="text-xs font-bold text-dark">
                Applicant Type <span className="text-rose-500">*</span>:
              </span>
              <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                <input
                  type="radio"
                  name="applicantType"
                  value="Resident"
                  checked={applicantType === "Resident"}
                  onChange={() => {
                    setApplicantType("Resident");
                    setSelectedResident(null);
                    setFullName("");
                    setAddress("");
                    setPhoneNumber("");
                    setEmail("");
                    setFormErrors({});
                  }}
                />
                Resident
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                <input
                  type="radio"
                  name="applicantType"
                  value="Non-resident"
                  checked={applicantType === "Non-resident"}
                  onChange={() => {
                    setApplicantType("Non-resident");
                    setSelectedResident(null);
                    setFullName("");
                    setAddress("");
                    setPhoneNumber("");
                    setEmail("");
                    setFormErrors({});
                  }}
                />
                Non-resident
              </label>
            </div>

            {applicantType === "Resident" && (
              <FormField
                label="Search & Select Resident *"
                hint="Select a registered resident to auto-fill details"
              >
                <div className={formErrors.resident ? "rounded-xl ring-2 ring-rose-500 p-0.5" : ""}>
                  <ResidentPicker
                    value={selectedResident}
                    onChange={handleResidentSelect}
                    placeholder="Type name to find resident…"
                  />
                </div>
                {formErrors.resident && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.resident}</p>
                )}
              </FormField>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Full Name *">
                <input
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (e.target.value.trim()) {
                      setFormErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.fullName;
                        return copy;
                      });
                    }
                  }}
                  placeholder="Juan Dela Cruz"
                  className={`${inputClasses} ${formErrors.fullName ? "border-rose-500 focus:border-rose-600 focus:ring-rose-200" : ""}`}
                  disabled={applicantType === "Resident" && !!selectedResident}
                />
                {formErrors.fullName && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.fullName}</p>
                )}
              </FormField>
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                label="Email Address *"
                hint={
                  applicantType === "Non-resident"
                    ? `${50 - email.length} chars left (receives approval email)`
                    : `${50 - email.length} chars left (max 50)`
                }
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
                  placeholder="resident@example.com"
                  className={`${inputClasses} ${formErrors.email ? "border-rose-500 focus:border-rose-600 focus:ring-rose-200" : ""}`}
                />
                {formErrors.email && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.email}</p>
                )}
              </FormField>
              <FormField label="Address *">
                <input
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (e.target.value.trim()) {
                      setFormErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.address;
                        return copy;
                      });
                    }
                  }}
                  placeholder="Zone / Street / Municipality"
                  className={`${inputClasses} ${formErrors.address ? "border-rose-500 focus:border-rose-600 focus:ring-rose-200" : ""}`}
                />
                {formErrors.address && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.address}</p>
                )}
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Appointment Date *">
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
                label="Appointment Time *"
                hint={
                  !appointmentDate
                    ? "Please choose an appointment date first to see available time slots"
                    : undefined
                }
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
                  <option value="">-- Select Time Slot --</option>
                  {TIME_SLOTS.map((slot) => {
                    const isBooked = walkInBookedSlots.some(
                      (s) => normalizeTime(s) === normalizeTime(slot)
                    );
                    const isPastOrSoon = isSlotInPastOrWithin30Mins(slot, appointmentDate);
                    const pendingCnt = walkInPendingCounts[slot] ?? 0;
                    return (
                      <option key={slot} value={slot} disabled={isBooked || isPastOrSoon}>
                        {slot}{" "}
                        {isBooked
                          ? "— (Unavailable - Booked)"
                          : isPastOrSoon
                          ? "— (Unavailable - Past / Cutoff)"
                          : pendingCnt > 0
                          ? `— (${pendingCnt} pending)`
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
                placeholder="State the purpose of this appointment or meeting…"
                rows={2}
                className={`${inputClasses} ${formErrors.purpose ? "border-rose-500 focus:border-rose-600 focus:ring-rose-200" : ""}`}
              />
              {formErrors.purpose && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.purpose}</p>
              )}
            </FormField>

            <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs text-blue-800">
              <p>
                <strong>Notice:</strong> Walk-in appointments are recorded as <strong>Pending</strong> and approved by the Punong Barangay or Secretary. Meeting minutes can be added once approved.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray/40">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                disabled={savingWalkIn}
                className="cursor-pointer rounded-full border border-gray px-5 py-2 text-xs font-semibold text-dark hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveWalkIn}
                disabled={savingWalkIn}
                className="cursor-pointer rounded-full bg-primary px-6 py-2 text-xs font-semibold text-white shadow hover:bg-primary-dark disabled:opacity-50"
              >
                {savingWalkIn ? "Saving…" : "Save Appointment"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Approve Modal (PB & Secretary) */}
      {approving && (
        <Modal
          open={!!approving}
          onClose={() => setApproving(null)}
          title={`Approve Appointment ${approving.appointment_number}`}
        >
          <div className="space-y-4 text-sm">
            <p className="text-xs text-gray-600">
              Set and confirm the scheduled date and time for <strong>{approving.full_name}</strong>.
              An email confirmation will be automatically dispatched if an email is registered.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Confirmed Date *">
                <input
                  type="date"
                  value={approveDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setApproveDate(e.target.value)}
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Confirmed Time *">
                <select
                  value={approveTime}
                  onChange={(e) => setApproveTime(e.target.value)}
                  className={inputClasses}
                >
                  <option value="">-- Select Time Slot --</option>
                  {TIME_SLOTS.map((slot) => {
                    const isBooked = approveBookedSlots.some(
                      (s) => normalizeTime(s) === normalizeTime(slot)
                    );
                    const isPastOrSoon = isSlotInPastOrWithin30Mins(slot, approveDate);
                    const pendingCnt = approvePendingCounts[slot] ?? 0;
                    return (
                      <option key={slot} value={slot} disabled={isBooked || isPastOrSoon}>
                        {slot}{" "}
                        {isBooked
                          ? "— (Unavailable - Booked)"
                          : isPastOrSoon
                          ? "— (Unavailable - Past / Cutoff)"
                          : pendingCnt > 0
                          ? `— (${pendingCnt} pending)`
                          : ""}
                      </option>
                    );
                  })}
                </select>
              </FormField>
            </div>

            {isApproveConflict && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
                <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <div>
                  <span className="font-bold block">Conflict Detected:</span>
                  The selected time slot ({approveTime}) on this date is already booked and approved for another appointment. Please choose a different time or date to prevent double booking.
                </div>
              </div>
            )}

            {!isApproveConflict && approvePendingCounts[approveTime] && approvePendingCounts[approveTime] > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                There are <strong>{approvePendingCounts[approveTime]}</strong> other pending requests for this time slot.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray/40">
              <button
                type="button"
                onClick={() => setApproving(null)}
                disabled={approvingLoading}
                className="cursor-pointer rounded-full border border-gray px-5 py-2 text-xs font-semibold text-dark hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveApprove}
                disabled={approvingLoading || isApproveConflict}
                className="cursor-pointer rounded-full bg-emerald-600 px-6 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                {approvingLoading ? "Approving…" : "Confirm & Approve"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {rejecting && (
        <Modal
          open={!!rejecting}
          onClose={() => setRejecting(null)}
          title={`Reject Appointment ${rejecting.appointment_number}`}
        >
          <div className="space-y-4 text-sm">
            <FormField label="Reason for Rejection *">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="State why this appointment cannot be accommodated…"
                rows={3}
                className={inputClasses}
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray/40">
              <button
                type="button"
                onClick={() => setRejecting(null)}
                disabled={rejectingLoading}
                className="cursor-pointer rounded-full border border-gray px-5 py-2 text-xs font-semibold text-dark hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReject}
                disabled={rejectingLoading}
                className="cursor-pointer rounded-full bg-rose-600 px-6 py-2 text-xs font-semibold text-white shadow hover:bg-rose-700 disabled:opacity-50"
              >
                {rejectingLoading ? "Rejecting…" : "Reject Appointment"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Modal (PB or Secretary) */}
      {cancelling && (
        <Modal
          open={!!cancelling}
          onClose={() => setCancelling(null)}
          title={`Cancel Appointment ${cancelling.appointment_number}`}
        >
          <div className="space-y-4 text-sm">
            <p className="text-xs text-gray-600">
              This will cancel the appointment for <strong>{cancelling.full_name}</strong>. The time slot will be reopened for other appointments.
            </p>

            <FormField label="Reason for Cancellation *">
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., The applicant requested cancellation, or conflict with official barangay schedule..."
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
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveCancel}
                disabled={cancellingLoading}
                className="cursor-pointer rounded-full bg-amber-600 px-6 py-2 text-xs font-semibold text-white shadow hover:bg-amber-700 disabled:opacity-50"
              >
                {cancellingLoading ? "Cancelling…" : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Minutes Modal (Only for Approved or Completed) */}
      {editingMinutes && (
        <Modal
          open={!!editingMinutes}
          onClose={() => setEditingMinutes(null)}
          title={`Appointment Minutes — ${editingMinutes.appointment_number}`}
        >
          <div className="space-y-4 text-sm">
            <p className="text-xs text-gray-600">
              Record the meeting minutes, actions taken, and discussions for{" "}
              <strong>{editingMinutes.full_name}</strong>. Punong Barangay can read these minutes on
              their calendar.
            </p>

            <FormField label="Minutes of the Meeting">
              <textarea
                value={minutesText}
                onChange={(e) => setMinutesText(e.target.value)}
                placeholder="Detailed notes on what was discussed, agreements reached, or resolutions formed…"
                rows={6}
                className={inputClasses}
              />
            </FormField>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-800">
              Saving minutes will automatically mark this appointment as <strong>Completed</strong>.
            </div>

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
