import { useEffect, useState, type FormEvent } from "react";
import { FiPlus } from "react-icons/fi";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { confirmAction } from "../../../shared/lib/confirm";
import { formatWallClock, parseWallClock } from "../../../shared/lib/datetime";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import Modal from "../../../shared/ui/Modal";
import StatusBadge from "../../../shared/ui/StatusBadge";
import PageHeader from "../../../shared/ui/PageHeader";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import type { Appointment } from "../../../shared/types";
import { portalApi } from "../api";

const OFFICES = ["Main Office", "Population", "Health Station", "Lupon"];

export default function Appointments() {
  const [rows, setRows] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  // So the footer can say WHICH rows are on screen, not only the page.
  const [total, setTotal] = useState(0);
  const [bookOpen, setBookOpen] = useState(false);
  const [office, setOffice] = useState(OFFICES[0]);
  const [datetime, setDatetime] = useState("");
  const [notes, setNotes] = useState("");

  const load = (p = page) => {
    setLoading(true);
    portalApi.appointments({ params: { page: p } })
      .then((r) => {
        setRows(r.data.data.data ?? []);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Live updates: confirmations/cancellations appear without a refresh.
  useAutoRefresh(() => load(), REFRESH.portal);

  const book = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(await confirmAction({ title: "Book this appointment?", confirmText: "Yes, book" }))) return;
    try {
      await portalApi.bookAppointment({
        office,
        scheduled_datetime: datetime.replace("T", " ") + ":00",
        notes: notes || undefined,
      });
      setBookOpen(false);
      setNotes("");
      toast("Appointment requested — the office will confirm it.");
      load(1);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const cancel = async (appointment: Appointment) => {
    if (
      !(await confirmAction({
        title: "Cancel this appointment?",
        text: `${appointment.appointment_number} will be cancelled.`,
        confirmText: "Yes, cancel it",
        cancelText: "Keep it",
        danger: true,
      }))
    )
      return;
    try {
      await portalApi.cancelAppointment(appointment.id);
      toast(`Appointment ${appointment.appointment_number} cancelled.`);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <div>
      <PageHeader
        title="My Appointments"
        subtitle="Book a visit and skip the walk-in queue"
        actions={
          <button
            type="button"
            onClick={() => setBookOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" /> Book appointment
          </button>
        }
      />

      <Card>
        <DataTable
          columns={[
            {
              header: "Appointment #",
              render: (a: Appointment) => <span className="font-medium text-dark">{a.appointment_number}</span>,
            },
            { header: "Office", render: (a: Appointment) => a.office },
            {
              header: "Schedule",
              render: (a: Appointment) => formatWallClock(a.scheduled_datetime),
            },
            { header: "Status", render: (a: Appointment) => <StatusBadge status={a.status} /> },
            {
              header: "",
              render: (a: Appointment) =>
                ["Pending", "Scheduled", "Confirmed"].includes(a.status) &&
                (parseWallClock(a.scheduled_datetime) ?? new Date(0)) > new Date() ? (
                  <button
                    type="button"
                    onClick={() => cancel(a)}
                    className="cursor-pointer text-xs font-semibold text-danger hover:underline"
                  >
                    Cancel
                  </button>
                ) : null,
            },
          ]}
          rows={rows}
          rowKey={(a) => a.id}
          numbered
          total={total}
          loading={loading}
          emptyMessage="No appointments yet."
          page={page}
          lastPage={lastPage}
          onPageChange={setPage}
        />
      </Card>

      <Modal open={bookOpen} onClose={() => setBookOpen(false)} title="Book an Appointment">
        <form onSubmit={book} className="space-y-4">
          <FormField label="Office" required>
            <select value={office} onChange={(e) => setOffice(e.target.value)} className={inputClasses}>
              {OFFICES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Date & time" required hint="Office hours: Mon–Fri, 8:00 AM–5:00 PM">
            <input
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              required
              className={inputClasses}
            />
          </FormField>
          <FormField label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${inputClasses} resize-none`}
              placeholder="What is the visit for?"
            />
          </FormField>
          <button
            type="submit"
            className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Request booking
          </button>
        </form>
      </Modal>
    </div>
  );
}
