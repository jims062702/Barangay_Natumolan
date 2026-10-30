import { useEffect, useState } from "react";
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
import type { Resident } from "../../../shared/types";

const TABS = ["All", "Pending", "Approved", "Completed", "Rejected"] as const;

export default function AppointmentsList() {
  const { user } = useAuth();
  const isPb = user?.role === "Punong Barangay";
  // Secretary check

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [, setLoading] = useState(true);
  const pageLoad = usePageLoad();

  // Viewing detail modal
  const [viewing, setViewing] = useState<Appointment | null>(null);

  // Walk-in creation modal (Secretary only)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [applicantType, setApplicantType] = useState<"Resident" | "Non-resident">("Resident");
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [appointmentTime, setAppointmentTime] = useState("09:00 AM");
  const [purpose, setPurpose] = useState("");
  const [initialMinutes, setInitialMinutes] = useState("");
  const [savingWalkIn, setSavingWalkIn] = useState(false);

  // Approve modal (Secretary only)
  const [approving, setApproving] = useState<Appointment | null>(null);
  const [approveTime, setApproveTime] = useState("");
  const [approveDate, setApproveDate] = useState("");
  const [approvingLoading, setApprovingLoading] = useState(false);

  // Reject modal (Secretary only)
  const [rejecting, setRejecting] = useState<Appointment | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectingLoading, setRejectingLoading] = useState(false);

  // Minutes modal (Secretary only)
  const [editingMinutes, setEditingMinutes] = useState<Appointment | null>(null);
  const [minutesText, setMinutesText] = useState("");
  const [minutesStatus, setMinutesStatus] = useState<"Approved" | "Completed">("Completed");
  const [minutesLoading, setMinutesLoading] = useState(false);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    appointmentApi.list({
      params: {
        page,
        status: activeTab,
        search: search.trim() || undefined,
      },
    })
      .then((r) => {
        setAppointments(r.data.data.data ?? []);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
      })
      .then(() => pageLoad.done(), (err) => { pageLoad.fail(err); throw err; })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activeTab, search]);

  useAutoRefresh(() => load(true), REFRESH.staff);
  usePulse("sessions", () => load(true));

  const handleOpenWalkIn = () => {
    setApplicantType("Resident");
    setSelectedResident(null);
    setFullName("");
    setAddress("");
    setPhoneNumber("");
    setEmail("");
    setAppointmentDate(new Date().toISOString().slice(0, 10));
    setAppointmentTime("09:00 AM");
    setPurpose("");
    setInitialMinutes("");
    setCreateModalOpen(true);
  };

  const handleResidentSelect = (res: Resident | null) => {
    setSelectedResident(res);
    if (res) {
      setFullName(`${res.first_name} ${res.middle_name ? res.middle_name + " " : ""}${res.last_name}${res.suffix ? " " + res.suffix : ""}`);
      setAddress(res.address ? `${res.address}, ${res.zone_purok ?? ""}` : (res.zone_purok ?? "Barangay Natumolan"));
      setPhoneNumber(res.contact_number ?? "");
      setEmail(res.email ?? "");
    }
  };

  const handleSaveWalkIn = async () => {
    if (applicantType === "Resident" && !selectedResident) {
      toast("Please select a registered resident.", "error");
      return;
    }
    if (!fullName.trim()) {
      toast("Please enter the applicant's full name.", "error");
      return;
    }
    if (!address.trim()) {
      toast("Please enter the address.", "error");
      return;
    }
    if (!phoneNumber.trim()) {
      toast("Please enter a phone number.", "error");
      return;
    }
    if (!appointmentDate) {
      toast("Please select an appointment date.", "error");
      return;
    }
    if (!appointmentTime.trim()) {
      toast("Please specify the appointment time.", "error");
      return;
    }
    if (!purpose.trim()) {
      toast("Please state the purpose of the appointment.", "error");
      return;
    }

    setSavingWalkIn(true);
    try {
      const res = await appointmentApi.createWalkIn({
        applicant_type: applicantType,
        resident_id: selectedResident?.id ?? null,
        full_name: fullName.trim(),
        address: address.trim(),
        phone_number: phoneNumber.trim(),
        email: email.trim() || null,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime.trim(),
        purpose: purpose.trim(),
        status: "Approved",
        minutes: initialMinutes.trim() || null,
      });
      toast(res.data?.message || "Walk-in appointment recorded successfully.");
      setCreateModalOpen(false);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSavingWalkIn(false);
    }
  };

  const handleOpenApprove = (apt: Appointment) => {
    setApproving(apt);
    setApproveDate(apt.appointment_date);
    setApproveTime(apt.appointment_time || "09:00 AM");
  };

  const handleSaveApprove = async () => {
    if (!approving) return;
    if (!approveTime.trim()) {
      toast("Please specify the confirmed appointment time.", "error");
      return;
    }
    setApprovingLoading(true);
    try {
      const res = await appointmentApi.approve(approving.id, {
        appointment_time: approveTime.trim(),
        appointment_date: approveDate,
      });
      toast(res.data?.message || "Appointment approved.");
      setApproving(null);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setApprovingLoading(false);
    }
  };

  const handleSaveReject = async () => {
    if (!rejecting) return;
    if (!rejectionReason.trim()) {
      toast("Please state the reason for rejecting.", "error");
      return;
    }
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
      setRejectingLoading(false);
    }
  };

  const handleOpenMinutes = (apt: Appointment) => {
    setEditingMinutes(apt);
    setMinutesText(apt.minutes || "");
    setMinutesStatus(apt.status === "Completed" ? "Completed" : "Completed");
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
        status: minutesStatus,
      });
      toast(res.data?.message || "Appointment minutes saved.");
      setEditingMinutes(null);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        subtitle={
          isPb
            ? "Punong Barangay executive appointment log & calendar view (Read-only)"
            : "Manage online and walk-in appointments for residents and non-residents"
        }
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/appointments/calendar"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
            >
              <FiCalendar className="h-4 w-4" /> Appointments Calendar
            </Link>
            {!isPb && (
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
        {/* Filter Tabs */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray/60 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setPage(1);
                }}
                className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === tab
                    ? "bg-primary text-white shadow-2xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          columns={[
            {
              header: "Reference",
              render: (a: Appointment) => (
                <div>
                  <span className="font-mono font-semibold text-dark">{a.appointment_number}</span>
                  {a.is_walk_in && (
                    <span className="ml-1.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                      Walk-in
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
                    <span className={a.applicant_type === "Resident" ? "text-primary font-medium" : "text-amber-700 font-medium"}>
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
                a.minutes ? (
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

                  {!isPb && a.status === "Pending" && (
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

                  {!isPb && (a.status === "Approved" || a.status === "Completed") && (
                    <button
                      type="button"
                      onClick={() => handleOpenMinutes(a)}
                      title="Record or update meeting minutes"
                      aria-label="Record minutes"
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-600 hover:text-white"
                    >
                      <FiEdit3 className="h-4 w-4" />
                    </button>
                  )}

                  {!isPb && (
                    <button
                      type="button"
                      onClick={() => handleDelete(a)}
                      title="Delete appointment"
                      aria-label="Delete appointment"
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray text-gray-400 transition hover:border-danger hover:bg-danger/10 hover:text-danger"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  )}
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
                  <span>{viewing.applicant_type} {viewing.is_walk_in && "(Walk-in Booking)"}</span>
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
                  <span className="font-bold text-dark block">Confirmed Date & Time</span>
                  <span className="font-semibold text-primary">
                    {new Date(viewing.appointment_date).toLocaleDateString("en-PH", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })} · {viewing.appointment_time || "Pending Time Confirmation"}
                  </span>
                </div>
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
                  <span>Minutes of Appointment / Discussion:</span>
                </div>
                <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">{viewing.minutes}</p>
              </div>
            )}

            {viewing.rejection_reason && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-800">
                <span className="font-bold block mb-1">Rejection Reason:</span>
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

      {/* New Walk-in Appointment Modal (Secretary only) */}
      {createModalOpen && (
        <Modal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Record Walk-in Appointment"
        >
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-4 border-b border-gray/40 pb-3">
              <span className="text-xs font-bold text-dark">Applicant Type:</span>
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
                  }}
                />
                Non-resident
              </label>
            </div>

            {applicantType === "Resident" && (
              <FormField label="Search & Select Resident" hint="Pumili mula sa rehistradong residente">
                <ResidentPicker
                  value={selectedResident}
                  onChange={handleResidentSelect}
                  placeholder="Type name to find resident…"
                />
              </FormField>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Full Name">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                  className={inputClasses}
                  disabled={applicantType === "Resident" && !!selectedResident}
                />
              </FormField>
              <FormField label="Contact Phone Number">
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="09123456789"
                  className={inputClasses}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Email Address" hint={applicantType === "Non-resident" ? "Non-resident will receive approval email" : "Optional"}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Address">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Zone / Street / Municipality"
                  className={inputClasses}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Appointment Date">
                <input
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Appointment Time" hint="Halimbawa: 09:30 AM">
                <input
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  placeholder="09:30 AM"
                  className={inputClasses}
                />
              </FormField>
            </div>

            <FormField label="Purpose of Appointment">
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="State the purpose of this appointment or meeting…"
                rows={3}
                className={inputClasses}
              />
            </FormField>

            <FormField label="Appointment Minutes / Notes (Optional)" hint="Maaari ding ilagay matapos ang appointment">
              <textarea
                value={initialMinutes}
                onChange={(e) => setInitialMinutes(e.target.value)}
                placeholder="Initial notes or summary of discussions…"
                rows={2}
                className={inputClasses}
              />
            </FormField>

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

      {/* Approve Modal (Secretary only) */}
      {approving && (
        <Modal
          open={!!approving}
          onClose={() => setApproving(null)}
          title={`Approve Appointment ${approving.appointment_number}`}
        >
          <div className="space-y-4 text-sm">
            <p className="text-xs text-gray-600">
              Set and confirm the scheduled time for <strong>{approving.full_name}</strong>. An email notification will be automatically dispatched if an email address is on file.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Confirmed Date">
                <input
                  type="date"
                  value={approveDate}
                  onChange={(e) => setApproveDate(e.target.value)}
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Confirmed Time">
                <input
                  value={approveTime}
                  onChange={(e) => setApproveTime(e.target.value)}
                  placeholder="e.g. 10:00 AM"
                  className={inputClasses}
                />
              </FormField>
            </div>

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
                disabled={approvingLoading}
                className="cursor-pointer rounded-full bg-emerald-600 px-6 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                {approvingLoading ? "Approving…" : "Confirm & Approve"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Modal (Secretary only) */}
      {rejecting && (
        <Modal
          open={!!rejecting}
          onClose={() => setRejecting(null)}
          title={`Reject Appointment ${rejecting.appointment_number}`}
        >
          <div className="space-y-4 text-sm">
            <FormField label="Reason for Rejection">
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

      {/* Minutes Modal (Secretary only) */}
      {editingMinutes && (
        <Modal
          open={!!editingMinutes}
          onClose={() => setEditingMinutes(null)}
          title={`Appointment Minutes — ${editingMinutes.appointment_number}`}
        >
          <div className="space-y-4 text-sm">
            <p className="text-xs text-gray-600">
              Record the meeting minutes, actions taken, and discussions for <strong>{editingMinutes.full_name}</strong>. Punong Barangay can read these minutes on their calendar.
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

            <FormField label="Mark Status as">
              <select
                value={minutesStatus}
                onChange={(e) => setMinutesStatus(e.target.value as "Approved" | "Completed")}
                className={inputClasses}
              >
                <option value="Approved">Approved (In Progress / Retain Schedule)</option>
                <option value="Completed">Completed (Meeting Finished)</option>
              </select>
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
