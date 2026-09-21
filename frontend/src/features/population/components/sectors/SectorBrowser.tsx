import { Link } from "react-router-dom";
import Card from "../../../../shared/ui/Card";
import DataTable from "../../../../shared/ui/DataTable";
import { personName } from "../../../../shared/lib/names";
import type { Resident } from "../../../../shared/types";
import { ageFromBirthdate } from "../../../resident/components/ResidentFormFields";
import type { SectorReportState } from "../../hooks/useSectorReport";

/**
 * One sector's list of people, searchable.
 */
export function SectorBrowser({ ctx }: { ctx: SectorReportState }) {
  const {
    setSelected, setPage, selected, sectors, report, chosen, residents, total, page, lastPage,
    loading,
  } = ctx;

  return (
    <Card title="Browse a sector list">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { setSelected("all"); setPage(1); }}
          aria-pressed={selected === "all"}
          className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
            selected === "all" ? "bg-primary text-white" : "bg-secondary text-dark hover:bg-primary/10"
          }`}
        >
          Everyone on a list
        </button>

        {sectors.map((row) => (
          <button
            key={row.sector_type}
            type="button"
            onClick={() => { setSelected(row.sector_type); setPage(1); }}
            aria-pressed={selected === row.sector_type}
            className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              selected === row.sector_type
                ? "bg-primary text-white"
                : "bg-secondary text-dark hover:bg-primary/10"
            }`}
          >
            {row.sector_type}
            <span className="ml-1.5 opacity-70">{row.count}</span>
          </button>
        ))}

        {report && report.people_on_no_list > 0 && (
          <button
            type="button"
            onClick={() => { setSelected("untagged"); setPage(1); }}
            aria-pressed={selected === "untagged"}
            className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              selected === "untagged"
                ? "bg-warning text-white"
                : "bg-warning/15 text-amber-700 hover:bg-warning/25"
            }`}
          >
            On no list
            <span className="ml-1.5 opacity-70">{report.people_on_no_list}</span>
          </button>
        )}
      </div>

      <p className="mb-3 text-xs text-gray-500">
        Showing <strong className="text-dark">{chosen}</strong>.
      </p>

      <DataTable
        columns={[
          {
            header: "Name",
            render: (r: Resident) => (
              <Link
                to={`/population/residents/${r.id}`}
                className="font-medium text-primary hover:underline"
              >
                {personName(r)}
              </Link>
            ),
          },
          { header: "Resident no.", render: (r: Resident) => r.resident_number ?? "—" },
          { header: "Purok", render: (r: Resident) => r.zone_purok ?? "—" },
          {
            header: "Age",
            render: (r: Resident) => {
              const age = ageFromBirthdate(String(r.birthdate ?? ""));
              return age === null ? "—" : String(age);
            },
          },
          { header: "Sex", render: (r: Resident) => r.gender ?? "—" },
          {
            /*
              Every list they are on, not only the one being browsed. This
              is the column the page existed without, and the reason an
              officer had to open forty profiles.
            */
            header: "On these lists",
            render: (r: Resident) =>
              r.sectors?.length ? (
                <span className="flex flex-wrap gap-1">
                  {r.sectors.map((s) => (
                    <span
                      key={s.id}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        s.sector_type === selected
                          ? "bg-primary text-white"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {s.sector_type}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-xs text-amber-700">None</span>
              ),
          },
        ]}
        rows={residents}
        rowKey={(r) => r.id}
        numbered
        total={total}
        page={page}
        lastPage={lastPage}
        onPageChange={setPage}
        loading={loading}
        searchable
        searchPlaceholder="Search by name or resident number…"
        getSearchText={(r) =>
          [
            personName(r),
            r.resident_number ?? "",
            r.zone_purok ?? "",
            r.gender ?? "",
            (r.sectors ?? []).map((s) => s.sector_type).join(" "),
          ].join(" ")
        }
        filters={[
          { label: "Purok", getValue: (r) => r.zone_purok ?? "Not recorded" },
          { label: "Sex", getValue: (r) => r.gender ?? "Not recorded" },
        ]}
        emptyMessage="Nobody is on this list."
      />
    </Card>
  );
}
