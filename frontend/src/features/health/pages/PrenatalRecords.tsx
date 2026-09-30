import { useEffect, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2, FiUser } from "react-icons/fi";
import { errorMessage } from "../../../shared/lib/api";
import { announceWrite } from "../../../shared/lib/announceWrite";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import PageHeader from "../../../shared/ui/PageHeader";
import RowAction from "../../../shared/ui/RowAction";
import { healthApi } from "../api";
import PrenatalRecordModal from "../components/PrenatalRecordModal";
import RecordFilters, { filterParams, noFilter, type RecordFilter } from "../components/RecordFilters";
import { fmtDate, measure } from "../lib/records";
import type { MotherView, PrenatalRow } from "../types";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

/**
 * Prenatal Records — the station's handwritten prenatal register, digitised
 * column for column: Date, Zone, Name, Age, WT, BP, HT, LMP, EDC, MOS,
 * Contact #. Plus the two the paper could not keep straight: which pregnancy
 * the line belongs to, and which visit of it this is — both counted.
 */
export default function PrenatalRecords() {
  const [rows, setRows] = useState<PrenatalRow[]>([]);
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RecordFilter>(noFilter);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ row: PrenatalRow; view: MotherView } | null>(null);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    healthApi.prenatalRecords({ params: { page, search: search.trim() || undefined, ...filterParams(filter) } })
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
    const timer = setTimeout(() => load(), search ? 300 : 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filter]);

  useAutoRefresh(() => load(true), REFRESH.staff);
  usePulse("health", () => load(true));

  /* Editing needs the mother's pregnancies, in case the line is on the wrong one. */
  const edit = (row: PrenatalRow) => {
    healthApi.pregnancy(row.pregnancy_id)
      .then((r) => setEditing({ row, view: r.data.data }))
      .catch((err) => toast(errorMessage(err), "error"));
  };

  const remove = async (row: PrenatalRow) => {
    if (!(await confirmAction({
      title: "Delete this prenatal record?",
      text: `${row.mother_name} — Visit #${row.visit_number} on ${fmtDate(row.visit_date, true)}. The pregnancy's Prenatal Visits is counted again.`,
      confirmText: "Yes, delete",
      danger: true,
    }))) return;
    try {
      const done = await healthApi.deletePrenatal(row.id, { offline: { label: `Delete prenatal record — ${row.mother_name}` } });
      const count = done.data?.data?.pregnancy?.current_prenatal_visits;
      if (count !== undefined) toast(`Prenatal record deleted — Prenatal Visits: ${count}`);
      else announceWrite(done, "Prenatal record deleted.");
      load(true);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => load()} />;

  return (
    <div>
      <PageHeader
        title="Prenatal Records"
        subtitle="The prenatal register — each line's Visit # and each pregnancy's Prenatal Visits are counted, never typed"
        actions={
          <button type="button" onClick={() => setAdding(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark">
            <FiPlus className="h-4 w-4" aria-hidden="true" /> Add prenatal record
          </button>
        }
      />

      <Card>
        <RecordFilters value={filter} onChange={(f) => { setFilter(f); setPage(1); }} statuses={["Active", "Delivered", "Closed"]} />
        <DataTable
          columns={[
            { header: "Date", render: (r: PrenatalRow) => <span className="whitespace-nowrap">{fmtDate(r.visit_date)}</span> },
            { header: "Zone / Purok", render: (r: PrenatalRow) => r.zone_purok ?? "—" },
            {
              header: "Name",
              render: (r: PrenatalRow) => (
                <span>
                  <span className="font-medium text-dark">{r.mother_name}</span>
                  <span className="block text-xs text-gray-500">{r.mother_resident_number}</span>
                </span>
              ),
            },
            { header: "Age", render: (r: PrenatalRow) => r.age ?? "—" },
            { header: "WT", render: (r: PrenatalRow) => <span className="tabular-nums">{measure(r.weight_kg)}</span> },
            { header: "BP", render: (r: PrenatalRow) => <span className="tabular-nums">{r.blood_pressure ?? "—"}</span> },
            { header: "HT", render: (r: PrenatalRow) => <span className="tabular-nums">{measure(r.height_cm)}</span> },
            { header: "LMP", render: (r: PrenatalRow) => <span className="whitespace-nowrap">{fmtDate(r.lmp ?? null)}</span> },
            { header: "EDC", render: (r: PrenatalRow) => <span className="whitespace-nowrap">{fmtDate(r.edc ?? null)}</span> },
            { header: "MOS", render: (r: PrenatalRow) => r.months_of_pregnancy ?? "—" },
            { header: "Contact Number", render: (r: PrenatalRow) => r.contact_number ?? "—" },
            {
              header: "Pregnancy",
              render: (r: PrenatalRow) => (
                <span className="whitespace-nowrap">#{r.pregnancy_number}<span className="block text-xs text-gray-500">{r.pregnancy_status}</span></span>
              ),
            },
            { header: "Visit #", render: (r: PrenatalRow) => <span className="font-semibold tabular-nums text-primary">#{r.visit_number}</span> },
            {
              header: "",
              render: (r: PrenatalRow) => (
                <div className="flex justify-end gap-1.5">
                  <RowAction label="Mother's record" icon={FiUser} to={`/health/maternal/pregnancy/${r.pregnancy_id}`} />
                  <RowAction label="Edit" icon={FiEdit2} onClick={() => edit(r)} />
                  <RowAction label="Delete" icon={FiTrash2} tone="danger" onClick={() => remove(r)} />
                </div>
              ),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading}
          numbered
          total={total}
          page={page}
          lastPage={lastPage}
          onPageChange={setPage}
          searchable
          onSearch={(text) => { setSearch(text); setPage(1); }}
          searchValue={search}
          searchPlaceholder="Search by Mother, Resident Number, Zone / Purok or Contact Number…"
          emptyMessage={search || filter.year || filter.zone || filter.status ? "No records match." : "No prenatal records yet."}
        />
      </Card>

      <PrenatalRecordModal open={adding} onClose={() => setAdding(false)} onSaved={() => load(true)} />
      <PrenatalRecordModal open={editing !== null} onClose={() => setEditing(null)} onSaved={() => load(true)}
        view={editing?.view ?? null}
        editing={editing ? { record: editing.row, pregnancyId: editing.row.pregnancy_id } : null} />
    </div>
  );
}
