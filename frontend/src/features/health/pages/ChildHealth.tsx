import { useEffect, useState } from "react";
import { FiClock, FiPlus } from "react-icons/fi";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import PageHeader from "../../../shared/ui/PageHeader";
import RowAction from "../../../shared/ui/RowAction";
import { healthApi } from "../api";
import ChildHistoryModal from "../components/ChildHistoryModal";
import ChildRecordModal from "../components/ChildRecordModal";
import RecordFilters, { filterParams, noFilter, type RecordFilter } from "../components/RecordFilters";
import { fmtDate, measure } from "../lib/records";
import type { ChildRecordRow } from "../types";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

/**
 * Child Health & Nutrition — every weighing, newest first.
 *
 * A child's second weighing used to replace the first. Now each is its own
 * record, and "History" opens all of them.
 */
export default function ChildHealth() {
  const [rows, setRows] = useState<ChildRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RecordFilter>(noFilter);
  const [adding, setAdding] = useState(false);
  const [history, setHistory] = useState<number | null>(null);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    healthApi.childHealth({ params: { page, search: search.trim() || undefined, ...filterParams(filter) } })
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

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => load()} />;

  return (
    <div>
      <PageHeader
        title="Child Health & Nutrition"
        subtitle="Every weighing kept, for children on the Population Office's register — find the mother, choose the child"
        actions={
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" /> Add record
          </button>
        }
      />

      <Card>
        <RecordFilters value={filter} onChange={(f) => { setFilter(f); setPage(1); }} />
        <DataTable
          columns={[
            { header: "Date", render: (r: ChildRecordRow) => <span className="whitespace-nowrap">{fmtDate(r.record_date)}</span> },
            {
              header: "Child",
              render: (r: ChildRecordRow) => (
                <span>
                  <span className="font-medium text-dark">{r.child_name}</span>
                  <span className="block text-xs text-gray-500">
                    {r.child_resident_number}
                  </span>
                </span>
              ),
            },
            { header: "Birthdate", render: (r: ChildRecordRow) => <span className="whitespace-nowrap">{fmtDate(r.birth_date)}</span> },
            { header: "Weight", render: (r: ChildRecordRow) => <span className="tabular-nums">{measure(r.current_weight, "kg")}</span> },
            { header: "Height", render: (r: ChildRecordRow) => <span className="tabular-nums">{measure(r.current_height, "cm")}</span> },
            { header: "Nutritional Status", render: (r: ChildRecordRow) => r.nutritional_status ?? "Not recorded" },
            { header: "Mother", render: (r: ChildRecordRow) => r.mother_name ?? "—" },
            { header: "Father", render: (r: ChildRecordRow) => r.father_name ?? "—" },
            { header: "Zone / Purok", render: (r: ChildRecordRow) => r.zone_purok ?? "—" },
            {
              header: "",
              render: (r: ChildRecordRow) => (
                <RowAction label="Record and history" icon={FiClock} tone="primary" onClick={() => setHistory(r.child_id)} />
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
          searchPlaceholder="Search by Child, Resident Number, Mother or Zone / Purok…"
          emptyMessage={search || filter.year || filter.zone ? "No records match." : "No child health records yet."}
        />
      </Card>

      <ChildRecordModal open={adding} onClose={() => setAdding(false)} onSaved={() => load()} />
      <ChildHistoryModal childId={history} onClose={() => setHistory(null)} onChanged={() => load(true)} />
    </div>
  );
}
