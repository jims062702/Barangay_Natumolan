import { useEffect, useState } from "react";
import { FiChevronRight, FiPlus } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import PageHeader from "../../../shared/ui/PageHeader";
import RowAction from "../../../shared/ui/RowAction";
import StatusBadge from "../../../shared/ui/StatusBadge";
import { healthApi } from "../api";
import { PregnancyFormModal } from "../components/PregnancyModals";
import RecordFilters, { filterParams, noFilter, type RecordFilter } from "../components/RecordFilters";
import { fmtDate } from "../lib/records";
import type { PregnancyRow } from "../types";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

/**
 * Maternal Health — one record per pregnancy, newest registration first.
 *
 * "Prenatal Visits" is the count of the pregnancy's own prenatal records
 * while it is current, and 0 once it is completed; its records stay with it.
 */
export default function MaternalHealth() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PregnancyRow[]>([]);
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RecordFilter>(noFilter);
  const [adding, setAdding] = useState(false);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    healthApi.maternalHealth({ params: { page, search: search.trim() || undefined, ...filterParams(filter) } })
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

  const open = (id: number) => navigate(`/health/maternal/pregnancy/${id}`);

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => load()} />;

  return (
    <div>
      <PageHeader
        title="Maternal Health"
        subtitle="One record per pregnancy — prenatal visits are counted from the prenatal records"
        actions={
          <button type="button" onClick={() => setAdding(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark">
            <FiPlus className="h-4 w-4" aria-hidden="true" /> Register pregnancy
          </button>
        }
      />

      <Card>
        <RecordFilters value={filter} onChange={(f) => { setFilter(f); setPage(1); }} statuses={["Active", "Delivered", "Closed"]} />
        <DataTable
          columns={[
            { header: "Registered", render: (p: PregnancyRow) => <span className="whitespace-nowrap">{fmtDate(p.pregnancy_registration_date)}</span> },
            {
              header: "Mother",
              render: (p: PregnancyRow) => (
                <span>
                  <span className="font-medium text-dark">{p.mother_name}</span>
                  <span className="block text-xs text-gray-500">{p.mother_resident_number}</span>
                </span>
              ),
            },
            { header: "Age", render: (p: PregnancyRow) => p.mother_age ?? "—" },
            { header: "Zone / Purok", render: (p: PregnancyRow) => p.zone_purok ?? "—" },
            { header: "Contact Number", render: (p: PregnancyRow) => p.contact_number ?? "—" },
            { header: "Pregnancy", render: (p: PregnancyRow) => `#${p.pregnancy_number}` },
            { header: "LMP", render: (p: PregnancyRow) => <span className="whitespace-nowrap">{fmtDate(p.lmp ?? null)}</span> },
            { header: "EDC", render: (p: PregnancyRow) => <span className="whitespace-nowrap">{fmtDate(p.expected_delivery_date ?? null)}</span> },
            {
              header: "Prenatal Visits",
              render: (p: PregnancyRow) => (
                <span className="tabular-nums">
                  {p.current_prenatal_visits}
                  {p.status !== "Active" && p.prenatal_visits > 0 && (
                    <span className="block text-xs text-gray-500">{p.prenatal_visits} on record</span>
                  )}
                </span>
              ),
            },
            { header: "Status", render: (p: PregnancyRow) => <StatusBadge status={p.status} /> },
            { header: "", render: (p: PregnancyRow) => <RowAction label="Open record" icon={FiChevronRight} tone="primary" onClick={() => open(p.id)} /> },
          ]}
          rows={rows}
          rowKey={(p) => p.id}
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
          emptyMessage={search || filter.year || filter.zone || filter.status ? "No records match." : "No maternal health records yet."}
        />
      </Card>

      <PregnancyFormModal open={adding} onClose={() => setAdding(false)}
        onSaved={(view) => (view?.selected ? open(view.selected.id) : load())} />
    </div>
  );
}
