import { useEffect, useState, type FormEvent } from "react";
import { FiPlus, FiPrinter } from "react-icons/fi";
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
    if (!(await confirmAction({ title: "Record this patient visit?", confirmText: "Yes, record" }))) return;
    try {
      const saved = await healthApi.recordVisit(
        itrPayload(draft, patient?.id),
        { offline: { label: `Patient visit — ${patient ? patient.first_name + " " + patient.last_name : "unnamed patient"}` } },
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
        <div className="mb-4 flex print-hide items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
            className={`${inputClasses} max-w-48`}
            aria-label="Filter by date"
          />
          {date && (
            <button type="button" onClick={() => setDate("")} className="cursor-pointer text-sm font-medium text-primary hover:underline">
              Clear
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
              disabled={!patient}
              className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              Record consultation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
