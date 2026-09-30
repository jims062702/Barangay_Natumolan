import { useEffect, useState } from "react";
import { FiPlus, FiPrinter } from "react-icons/fi";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import PageHeader from "../../../shared/ui/PageHeader";
import type { Resident } from "../../../shared/types";
import { healthApi } from "../api";
import ImmunizationCardModal from "../components/ImmunizationCardModal";
import type { ImmunizationRecord } from "../types";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

/**
 * Every dose the station has given, and each person's record behind it.
 *
 * WHAT CHANGED, AND WHY. This was a "schedule board" of single doses with a
 * Pending/Missed/Completed status typed in by hand. The DOH Individual
 * Treatment Record the station actually fills in has no status box: it is a
 * card per person with the DATE each vaccine was given. So a dose recorded
 * here is a dose given, the record opens as that card, and "due" and
 * "overdue" are worked out from each child's birth date on the dashboard —
 * never typed, so never wrong by omission.
 */
export default function Immunization() {
  const [rows, setRows] = useState<ImmunizationRecord[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();

  /* The card: closed, open blank for somebody new, or open on a person. */
  const [cardOpen, setCardOpen] = useState(false);
  const [cardFor, setCardFor] = useState<Resident | null>(null);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    healthApi.immunizations({ params: { page } })
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
  }, [page]);

  useAutoRefresh(() => load(true), REFRESH.staff);
  usePulse("health", () => load(true));

  const openCard = (person: Resident | null) => {
    setCardFor(person);
    setCardOpen(true);
  };

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => load()} />;

  return (
    <div>
      <PageHeader
        title="Immunization"
        subtitle="Vaccines given, as recorded on each person's Individual Treatment Record"
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray px-5 py-2.5 text-sm font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
            >
              <FiPrinter className="h-4 w-4" aria-hidden="true" /> Print
            </button>
            <button
              type="button"
              onClick={() => openCard(null)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <FiPlus className="h-4 w-4" aria-hidden="true" /> Immunization record
            </button>
          </div>
        }
      />

      <Card className="print-plain">
        <DataTable
          columns={[
            {
              /* "Name", not "Child": the ITR records adult immunizations
                 too — flu, tetanus toxoid, COVID. */
              header: "Name",
              render: (r: ImmunizationRecord) =>
                r.child ? (
                  <span className="font-medium text-dark">
                    {r.child.first_name} {r.child.last_name}
                  </span>
                ) : "—",
            },
            { header: "Zone / Purok", render: (r: ImmunizationRecord) => r.child?.zone_purok ?? "—" },
            { header: "Sex", render: (r: ImmunizationRecord) => r.child?.gender ?? "—" },
            { header: "Vaccine", render: (r: ImmunizationRecord) => r.vaccine_name },
            {
              header: "Date given",
              render: (r: ImmunizationRecord) => (
                <span className="whitespace-nowrap">
                  {new Date(r.vaccination_date).toLocaleDateString("en-PH")}
                </span>
              ),
            },
            {
              header: "Actions",
              render: (r: ImmunizationRecord) =>
                r.child ? (
                  <button
                    type="button"
                    onClick={() => openCard(r.child ?? null)}
                    className="cursor-pointer whitespace-nowrap rounded-full border border-primary/40 px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                  >
                    Open record
                  </button>
                ) : null,
            },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          numbered
          total={total}
          searchable
          searchPlaceholder="Search by Name, Zone / Purok or Vaccine…"
          getSearchText={(r) =>
            `${r.child ? `${r.child.first_name} ${r.child.last_name}` : ""} ${
              r.child?.zone_purok ?? ""
            } ${r.vaccine_name}`
          }
          loading={loading}
          page={page}
          lastPage={lastPage}
          onPageChange={setPage}
          emptyMessage="No dose has been recorded yet."
        />
      </Card>

      <ImmunizationCardModal
        open={cardOpen}
        resident={cardFor}
        onClose={() => {
          setCardOpen(false);
          setCardFor(null);
        }}
        onSaved={() => load()}
      />
    </div>
  );
}
