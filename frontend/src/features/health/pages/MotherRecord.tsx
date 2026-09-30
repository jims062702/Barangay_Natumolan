import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FiCheckCircle, FiEdit2, FiPlus, FiRotateCcw, FiTrash2 } from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/api";
import { announceWrite } from "../../../shared/lib/announceWrite";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { usePulse } from "../../../shared/hooks/usePulse";
import Card from "../../../shared/ui/Card";
import PageHeader from "../../../shared/ui/PageHeader";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";
import RowAction from "../../../shared/ui/RowAction";
import StatusBadge from "../../../shared/ui/StatusBadge";
import { healthApi } from "../api";
import { CompletePregnancyModal, PregnancyFormModal } from "../components/PregnancyModals";
import PrenatalRecordModal from "../components/PrenatalRecordModal";
import { fmtDate, measure } from "../lib/records";
import type { MotherView, PregnancyRow, PrenatalLine } from "../types";

/**
 * One mother's maternal record: her CURRENT pregnancy and its Prenatal
 * Visits, the prenatal records of the pregnancy chosen, and every pregnancy
 * she has had here.
 *
 * Completing a pregnancy keeps everything: only her current count goes to
 * 0, and her next pregnancy starts from there.
 */
export default function MotherRecord() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState<MotherView | null>(null);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();
  const [adding, setAdding] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PrenatalLine | null>(null);
  const [editingPregnancy, setEditingPregnancy] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [completing, setCompleting] = useState<PregnancyRow | null>(null);

  /* A first load that fails says so in place of the page; a background
     refresh that fails leaves the record on screen as it was. */
  const load = useCallback(() => {
    healthApi.pregnancy(id!)
      .then((r) => {
        setView(r.data.data);
        pageLoad.done();
      })
      .catch((err) => pageLoad.fail(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  usePulse("health", () => load());

  if (pageLoad.state !== "ready" || !view) return <PageLoading load={pageLoad} onRetry={() => load()} />;

  const { mother, current, selected } = view;
  const visits = view.visits ?? [];

  const removeVisit = async (v: PrenatalLine) => {
    if (!(await confirmAction({
      title: "Delete this prenatal record?",
      text: `Visit #${v.visit_number} on ${fmtDate(v.visit_date, true)}. The pregnancy's Prenatal Visits is counted again.`,
      confirmText: "Yes, delete",
      danger: true,
    }))) return;
    try {
      const done = await healthApi.deletePrenatal(v.id, { offline: { label: `Delete prenatal record — ${mother.name}` } });
      const count = done.data?.data?.pregnancy?.current_prenatal_visits;
      if (count !== undefined) toast(`Prenatal record deleted — Prenatal Visits: ${count}`);
      else announceWrite(done, "Prenatal record deleted.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const reopen = async (p: PregnancyRow) => {
    if (!(await confirmAction({ title: "Reopen this pregnancy?", text: "Only to undo a completion made in error.", confirmText: "Yes, reopen" }))) return;
    try {
      const done = await healthApi.reopenPregnancy(p.id, {});
      announceWrite(done, "Pregnancy reopened.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const removePregnancy = async (p: PregnancyRow) => {
    if (!(await confirmAction({ title: "Delete this pregnancy?", text: "Only a pregnancy registered in error, with no prenatal records.", confirmText: "Yes, delete", danger: true }))) return;
    try {
      await healthApi.deletePregnancy(p.id);
      toast("Pregnancy deleted.");
      const other = view.pregnancies.find((x) => x.id !== p.id);
      navigate(other ? `/health/maternal/pregnancy/${other.id}` : "/health/maternal", { replace: true });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <div>
      <PageHeader
        title={mother.name}
        subtitle="Maternal health record"
        actions={
          <div className="flex flex-wrap gap-2">
            {current ? (
              <button type="button" onClick={() => setAdding(true)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
                <FiPlus className="h-4 w-4" aria-hidden="true" /> Add prenatal record
              </button>
            ) : (
              <button type="button" onClick={() => setRegistering(true)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
                <FiPlus className="h-4 w-4" aria-hidden="true" /> Register new pregnancy
              </button>
            )}
          </div>
        }
      />

      {/* One column that may not grow past the screen: without it, a wide
          prenatal table stretched the whole page sideways on a phone. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* ---------------- CURRENT PREGNANCY ---------------- */}
          <Card title="Current Pregnancy">
            {current ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-4">
                  <Fact label="Pregnancy" value={`#${current.pregnancy_number}`} />
                  <Fact label="Status" value={<StatusBadge status="Active" />} />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Prenatal Visits</p>
                    <p className="text-3xl font-bold tabular-nums text-primary" data-testid="current-prenatal-visits">{current.prenatal_visits}</p>
                  </div>
                  <Fact label="Last Prenatal Record" value={fmtDate(current.last_visit_date ?? null, true)} />
                  <Fact label="LMP" value={fmtDate(current.lmp ?? null, true)} />
                  <Fact label="EDC" value={fmtDate(current.expected_delivery_date ?? null, true)} />
                  <Fact label="Registered" value={fmtDate(current.pregnancy_registration_date, true)} />
                </div>
                <p className="text-xs text-gray-500">
                  Prenatal Visits is the number of prenatal records saved for this pregnancy. It is counted by the system, never typed.
                </p>
                <div className="flex flex-wrap gap-2 border-t border-gray/70 pt-3">
                  <button type="button" onClick={() => setCompleting(current)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray px-3.5 py-1.5 text-xs font-semibold text-dark hover:border-primary hover:text-primary">
                    <FiCheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> Complete pregnancy
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <Fact label="Current Pregnancy" value={view.pregnancies.length ? "Completed" : "None registered"} />
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Current Prenatal Visits</p>
                  <p className="text-3xl font-bold tabular-nums text-gray-400" data-testid="current-prenatal-visits">0</p>
                </div>
                <p className="text-xs text-gray-500 sm:col-span-3">
                  Her next pregnancy starts at 0 prenatal visits. Earlier pregnancies and their records stay below.
                </p>
              </div>
            )}
          </Card>

          {/* ---------------- The chosen pregnancy's prenatal records ---------------- */}
          {selected && (
            <Card
              title={`Prenatal Records — Pregnancy #${selected.pregnancy_number}`}
              action={
                <span className="flex items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <button type="button" onClick={() => setEditingPregnancy(true)}
                    className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    <FiEdit2 className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                  </button>
                </span>
              }
            >
              <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                <span>Registered {fmtDate(selected.pregnancy_registration_date)}</span>
                <span>{selected.prenatal_visits} prenatal {selected.prenatal_visits === 1 ? "visit" : "visits"}</span>
                {selected.status === "Delivered" && <span>Delivered {fmtDate(selected.actual_delivery_date ?? null)}</span>}
                {selected.status === "Closed" && <span>Closed — {selected.closure_note}</span>}
                {selected.completed_by && <span>Completed by {selected.completed_by} on {fmtDate(selected.completed_at ?? null)}</span>}
                {selected.risk_indicators && <span>Remarks: {selected.risk_indicators}</span>}
              </div>
              <div className="overflow-x-auto rounded-2xl border border-gray">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      {["Visit #", "Date", "Zone", "Age", "WT", "BP", "HT", "LMP", "EDC", "MOS", "Contact Number"].map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
                      ))}
                      <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray/70">
                    {visits.length === 0 ? (
                      <tr><td colSpan={12} className="px-3 py-6 text-center text-gray-400">No prenatal records for this pregnancy yet.</td></tr>
                    ) : visits.map((v) => (
                      <tr key={v.id}>
                        <td className="px-3 py-2 font-semibold tabular-nums text-primary">#{v.visit_number}</td>
                        <td className="whitespace-nowrap px-3 py-2">{fmtDate(v.visit_date)}</td>
                        <td className="whitespace-nowrap px-3 py-2">{v.zone_purok ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{v.age ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{measure(v.weight_kg)}</td>
                        <td className="px-3 py-2 tabular-nums">{v.blood_pressure ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{measure(v.height_cm)}</td>
                        <td className="whitespace-nowrap px-3 py-2">{fmtDate(v.lmp ?? null)}</td>
                        <td className="whitespace-nowrap px-3 py-2">{fmtDate(v.edc ?? null)}</td>
                        <td className="whitespace-nowrap px-3 py-2">{v.months_of_pregnancy ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2">{v.contact_number ?? "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1.5">
                            <RowAction label="Edit" icon={FiEdit2} onClick={() => setEditingRecord(v)} />
                            <RowAction label="Delete" icon={FiTrash2} tone="danger" onClick={() => removeVisit(v)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.status !== "Active" && !current && (
                  <button type="button" onClick={() => reopen(selected)}
                    className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-primary">
                    <FiRotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reopen (undo a completion made in error)
                  </button>
                )}
                {selected.prenatal_visits === 0 && (
                  <button type="button" onClick={() => removePregnancy(selected)}
                    className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-danger">
                    <FiTrash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete (registered in error)
                  </button>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Mother">
            <div className="space-y-2 text-sm">
              <Fact label="Name" value={mother.name} />
              <Fact label="Resident Number" value={mother.resident_number ?? "—"} />
              <Fact label="Age" value={mother.age != null ? String(mother.age) : "—"} />
              <Fact label="Address" value={mother.address ?? "—"} />
              <Fact label="Zone / Purok" value={mother.zone_purok ?? "—"} />
              <Fact label="Contact Number" value={mother.contact_number ?? "—"} />
              <p className="pt-1 text-xs text-gray-400">From the Population Office&apos;s register. Corrections are made there.</p>
            </div>
          </Card>

          <Card title="Pregnancies">
            <ul className="divide-y divide-gray/70">
              {view.pregnancies.map((p) => (
                <li key={p.id}>
                  <Link to={`/health/maternal/pregnancy/${p.id}`}
                    aria-current={p.id === selected?.id ? "page" : undefined}
                    className={`flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-sm transition-colors ${p.id === selected?.id ? "bg-primary/5" : "hover:bg-secondary/60"}`}>
                    <span>
                      <span className="font-semibold text-dark">Pregnancy #{p.pregnancy_number}</span>
                      <span className="block text-xs text-gray-500">
                        {p.prenatal_visits} prenatal {p.prenatal_visits === 1 ? "visit" : "visits"} · registered {fmtDate(p.pregnancy_registration_date)}
                      </span>
                    </span>
                    <StatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <PrenatalRecordModal open={adding} onClose={() => setAdding(false)} onSaved={() => load()} view={view} />
      <PrenatalRecordModal open={editingRecord !== null} onClose={() => setEditingRecord(null)} onSaved={() => load()}
        view={view} editing={editingRecord && selected ? { record: editingRecord, pregnancyId: selected.id } : null} />
      <PregnancyFormModal open={editingPregnancy} onClose={() => setEditingPregnancy(false)} onSaved={() => load()}
        editing={selected ? { pregnancy: selected, mother } : null} />
      <PregnancyFormModal open={registering} onClose={() => setRegistering(false)} mother={mother}
        onSaved={(v) => (v?.selected ? navigate(`/health/maternal/pregnancy/${v.selected.id}`) : load())} />
      <CompletePregnancyModal pregnancy={completing} motherName={mother.name} onClose={() => setCompleting(null)} onSaved={() => load()} />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <div className="font-medium text-dark">{value}</div>
    </div>
  );
}
