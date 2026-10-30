import { useEffect, useState, type FormEvent } from "react";
import { FiCalendar, FiEye, FiPlus, FiPrinter } from "react-icons/fi";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { confirmAction } from "../../../shared/lib/confirm";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import DraftNotice from "../../../shared/ui/DraftNotice";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import Modal from "../../../shared/ui/Modal";
import { inputClasses } from "../../../shared/ui/FormField";
import PageHeader from "../../../shared/ui/PageHeader";
import { announceWrite } from "../../../shared/lib/announceWrite";
import type { Resident } from "../../../shared/types";
import { healthApi } from "../api";
import { ItrConsultationForm } from "../components/ItrConsultationForm";
import { blankItr, itrPayload, type ItrDraft } from "../lib/itr";
import type { HealthVisit } from "../types";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

export default function PatientVisits() {
  const [rows, setRows] = useState<HealthVisit[]>([]);
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  // So the footer can say WHICH rows are on screen, not only the page.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();

  const [createOpen, setCreateOpen] = useState(false);
  const [viewingVisit, setViewingVisit] = useState<HealthVisit | null>(null);
  const [patient, setPatient] = useState<Resident | null>(null);
  /*
   * ONE DRAFT, not twenty useStates.
   *
   * The ITR block has nineteen fields. Each as its own pair of hooks would
   * be forty lines of ceremony at the top of this file, and a reset that
   * has to name every one of them — which is how a form comes to open
   * holding the last patient's readings.
   */
  const [draft, setDraft] = useState<ItrDraft>(blankItr);

  const set = <K extends keyof ItrDraft>(key: K, value: ItrDraft[K]) =>
    setDraft((was) => ({ ...was, [key]: value }));

  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is
   * reading; a first load or a filter change should still say it is
   * working. Same fetch, and only the announcement differs.
   */
  const load = (silent = false) => {
    if (!silent) setLoading(true);
    healthApi.visits({ params: { page, date: date || undefined } })
      .then((r) => {
        setRows(r.data.data.data ?? []);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
      })
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, date]);

  // Live updates without a manual refresh.
  useAutoRefresh(() => load(true), REFRESH.staff);

  /*
   * Somebody else's change, about a second after they make it.
   *
   * The timer above stays as a backstop: if the pulse cannot be
   * reached the page is a few seconds stale rather than frozen.
   */
  usePulse("health", () => load(true));

  /* The consultation being written, kept until it is recorded or discarded —
     the patient does not have to repeat their complaint because the dialog
     closed. */
  const visitDraft = useModalDraft<{ patient: Resident | null; itr: ItrDraft }>(
    "new-patient-visit",
    createOpen,
    { patient, itr: draft },
    (kept) => {
      setPatient(kept.patient ?? null);
      setDraft({ ...blankItr(), ...kept.itr });
    },
    {
      blank: { patient: null, itr: blankItr() },
      reset: () => {
        setPatient(null);
        setDraft(blankItr());
      },
    },
  );

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!patient) {
      toast("Please search and select a patient from the resident list first.", "error");
      return;
    }
    if (!(await confirmAction({ title: "Record this patient visit?", confirmText: "Yes, record" }))) return;
    try {
      const saved = await healthApi.recordVisit(
        itrPayload(draft, patient.id),
        { offline: { label: `Patient visit — ${patient.first_name} ${patient.last_name}` } },
      );
      visitDraft.clear();
      setCreateOpen(false);
      /* Cleared together. A form that opens holding the last patient's
         readings is how one person's blood pressure lands on another. */
      setPatient(null);
      setDraft(blankItr());
      announceWrite(saved, "Visit recorded.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => load()} />;

  return (
    <div>
      <PageHeader
        title="Patient Visits"
        subtitle="Consultations, vital signs, and referrals at the Barangay Health Station"
        actions={
          <div className="flex gap-2 print-hide">
            {/*
              A station keeps paper. The day's consultations get printed and
              filed in the family folder alongside the ITR itself, and until
              now the only way to get them onto paper was to write them out
              again. Prints WHAT IS ON SCREEN, so the date filter above is
              also the thing that chooses what comes out.
            */}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray px-5 py-2.5 text-sm font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
            >
              <FiPrinter className="h-4 w-4" aria-hidden="true" /> Print
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <FiPlus className="h-4 w-4" aria-hidden="true" /> Record visit
            </button>
          </div>
        }
      />

      <Card className="print-plain">
        <div className="mb-4 flex flex-wrap print-hide items-center gap-2.5">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <FiCalendar className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Filter by Visit Date:</span>
          </label>
          <div className="relative flex items-center">
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPage(1);
              }}
              className={`${inputClasses} w-full sm:w-auto min-w-[170px]`}
              aria-label="Filter by visit date"
            />
          </div>
          {date && (
            <button
              type="button"
              onClick={() => setDate("")}
              className="cursor-pointer text-sm font-semibold text-primary hover:underline"
            >
              Clear date
            </button>
          )}
        </div>

        <DataTable
          columns={[
            {
              header: "Patient",
              render: (v: HealthVisit) => (v.patient ? `${v.patient.first_name} ${v.patient.last_name}` : "—"),
            },
            { header: "Date", render: (v: HealthVisit) => new Date(v.visit_date).toLocaleDateString("en-PH") },
            { header: "Reason", render: (v: HealthVisit) => v.visit_reason },
            { header: "BP", render: (v: HealthVisit) => v.blood_pressure ?? "—" },
            { header: "Temp", render: (v: HealthVisit) => (v.temperature ? `${v.temperature}°C` : "—") },
            {
              header: "Referral",
              render: (v: HealthVisit) =>
                v.referral_recommended ? (
                  <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">Referred</span>
                ) : (
                  "—"
                ),
            },
            {
              header: "Actions",
              render: (v: HealthVisit) => (
                <button
                  type="button"
                  onClick={() => setViewingVisit(v)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray bg-white px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  <FiEye className="h-3.5 w-3.5" /> View
                </button>
              ),
            },
          ]}
          rows={rows}
          rowKey={(v) => v.id}
          numbered
          total={total}
          searchable
          searchPlaceholder="Search by Patient or Reason…"
          getSearchText={(v) =>
            `${v.patient ? `${v.patient.first_name} ${v.patient.last_name}` : ""} ${v.visit_reason}`
          }
          loading={loading}
          page={page}
          lastPage={lastPage}
          onPageChange={setPage}
        />
      </Card>

      {/*
        The consultation block of the ITR, in the paper's own order.

        It asked for three vital signs; the form asks for eleven. A midwife
        recording a prenatal check had nowhere to put the fundal height, the
        fetal heart tone, the age of gestation or the presentation — which,
        for that patient, are the whole examination.
      */}
      {/* View Visit Modal */}
      <Modal
        open={!!viewingVisit}
        onClose={() => setViewingVisit(null)}
        title="Patient Visit Details"
        size="wide"
      >
        {viewingVisit && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray bg-secondary/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray/50 pb-3">
                <div>
                  <h3 className="text-base font-bold text-dark">
                    {viewingVisit.patient ? `${viewingVisit.patient.first_name} ${viewingVisit.patient.last_name}` : "Unknown Patient"}
                  </h3>
                  {viewingVisit.patient?.resident_number && (
                    <p className="text-xs text-gray-500">ID: {viewingVisit.patient.resident_number}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {new Date(viewingVisit.visit_date).toLocaleDateString("en-PH", {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    {viewingVisit.visit_time ? ` · ${viewingVisit.visit_time}` : ""}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-gray-400">Blood Pressure:</span>
                  <p className="font-semibold text-dark">{viewingVisit.blood_pressure || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-400">Temperature:</span>
                  <p className="font-semibold text-dark">{viewingVisit.temperature ? `${viewingVisit.temperature}°C` : "—"}</p>
                </div>
                <div>
                  <span className="text-gray-400">Heart Rate:</span>
                  <p className="font-semibold text-dark">{viewingVisit.heart_rate ? `${viewingVisit.heart_rate} bpm` : "—"}</p>
                </div>
                <div>
                  <span className="text-gray-400">Respiratory Rate:</span>
                  <p className="font-semibold text-dark">{viewingVisit.respiratory_rate ? `${viewingVisit.respiratory_rate} cpm` : "—"}</p>
                </div>
                <div>
                  <span className="text-gray-400">O2 Saturation:</span>
                  <p className="font-semibold text-dark">{viewingVisit.oxygen_saturation ? `${viewingVisit.oxygen_saturation}%` : "—"}</p>
                </div>
                <div>
                  <span className="text-gray-400">Height:</span>
                  <p className="font-semibold text-dark">{viewingVisit.height_cm ? `${viewingVisit.height_cm} cm` : "—"}</p>
                </div>
                <div>
                  <span className="text-gray-400">Weight:</span>
                  <p className="font-semibold text-dark">{viewingVisit.weight_kg ? `${viewingVisit.weight_kg} kg` : "—"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Reason for Visit</label>
                <p className="mt-0.5 rounded-lg border border-gray bg-white p-2.5 text-sm font-medium text-dark">
                  {viewingVisit.visit_reason || "—"}
                </p>
              </div>

              {viewingVisit.chief_complaints && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Chief Complaints</label>
                  <p className="mt-0.5 whitespace-pre-wrap rounded-lg border border-gray bg-white p-2.5 text-sm text-dark">
                    {viewingVisit.chief_complaints}
                  </p>
                </div>
              )}

              {viewingVisit.symptoms && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Symptoms</label>
                  <p className="mt-0.5 whitespace-pre-wrap rounded-lg border border-gray bg-white p-2.5 text-sm text-dark">
                    {viewingVisit.symptoms}
                  </p>
                </div>
              )}

              {viewingVisit.consultation_notes && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Consultation Notes / Findings</label>
                  <p className="mt-0.5 whitespace-pre-wrap rounded-lg border border-gray bg-white p-2.5 text-sm text-dark">
                    {viewingVisit.consultation_notes}
                  </p>
                </div>
              )}

              {viewingVisit.treatment_advice && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Treatment / Advice</label>
                  <p className="mt-0.5 whitespace-pre-wrap rounded-lg border border-gray bg-white p-2.5 text-sm text-dark">
                    {viewingVisit.treatment_advice}
                  </p>
                </div>
              )}

              {viewingVisit.medication && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Prescribed Medication</label>
                  <p className="mt-0.5 whitespace-pre-wrap rounded-lg border border-gray bg-white p-2.5 text-sm text-dark">
                    {viewingVisit.medication}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Referral Status</label>
                  <div className="mt-0.5 rounded-lg border border-gray bg-white p-2.5 text-sm">
                    {viewingVisit.referral_recommended ? (
                      <span className="font-semibold text-warning">
                        Referred {viewingVisit.referral_destination ? `to ${viewingVisit.referral_destination}` : ""}
                      </span>
                    ) : (
                      <span className="text-gray-500">No referral required</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Follow-up Schedule</label>
                  <div className="mt-0.5 rounded-lg border border-gray bg-white p-2.5 text-sm font-medium text-dark">
                    {viewingVisit.followup_schedule
                      ? new Date(viewingVisit.followup_schedule).toLocaleDateString("en-PH")
                      : "None scheduled"}
                  </div>
                </div>
              </div>

              {viewingVisit.provider?.name && (
                <p className="text-right text-xs text-gray-400">
                  Recorded by: <span className="font-medium text-dark">{viewingVisit.provider.name}</span>
                </p>
              )}
            </div>

            <div className="flex justify-end border-t border-gray pt-4">
              <button
                type="button"
                onClick={() => setViewingVisit(null)}
                className="cursor-pointer rounded-full border border-gray px-5 py-2 text-sm font-semibold text-dark hover:border-primary/50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Individual Treatment Record — consultation"
        size="xl"
      >
        <form onSubmit={create} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ItrConsultationForm
            draft={draft}
            set={set}
            patient={patient}
            onPatient={setPatient}
          />

          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <DraftNotice draft={visitDraft} />
            <button
              type="submit"
              className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              {patient ? "Record consultation" : "Select a patient to record consultation"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
