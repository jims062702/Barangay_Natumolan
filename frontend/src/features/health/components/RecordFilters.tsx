import { inputClasses } from "../../../shared/ui/FormField";
import { useZoneNames } from "../../population/lib/useZones";
import { filterYears, MONTHS } from "../lib/records";

/**
 * Year, month, zone — and, for pregnancies, status. The same row above
 * every Child Health, Maternal and Prenatal list, so a month means the same
 * thing on all three: the record's own date.
 */
export interface RecordFilter {
  year: string;
  month: string;
  zone: string;
  status: string;
}

export const noFilter = (): RecordFilter => ({ year: "", month: "", zone: "", status: "" });

export const filterParams = (f: RecordFilter) => ({
  year: f.year || undefined,
  /* A month without a year is every year's September — only sent with one. */
  month: f.year && f.month ? f.month : undefined,
  zone_purok: f.zone || undefined,
  status: f.status || undefined,
});

export default function RecordFilters({
  value,
  onChange,
  statuses,
}: {
  value: RecordFilter;
  onChange: (next: RecordFilter) => void;
  /** Pregnancy statuses, where the list has them. */
  statuses?: string[];
}) {
  const zones = useZoneNames();
  const set = (patch: Partial<RecordFilter>) => onChange({ ...value, ...patch });
  /* The form box, minus its full width: four of these share one row. */
  const select = `${inputClasses.replace("w-full", "w-auto")} min-w-32`;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 print-hide">
      <select aria-label="Year" value={value.year} onChange={(e) => set({ year: e.target.value, month: e.target.value ? value.month : "" })} className={select}>
        <option value="">All years</option>
        {filterYears().map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select aria-label="Month" value={value.month} disabled={!value.year} onChange={(e) => set({ month: e.target.value })} className={select}>
        <option value="">All months</option>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select aria-label="Zone / Purok" value={value.zone} onChange={(e) => set({ zone: e.target.value })} className={select}>
        <option value="">All zones</option>
        {zones.map((z) => <option key={z}>{z}</option>)}
      </select>
      {statuses && (
        <select aria-label="Pregnancy status" value={value.status} onChange={(e) => set({ status: e.target.value })} className={select}>
          <option value="">Any status</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
      )}
      {(value.year || value.zone || value.status) && (
        <button type="button" onClick={() => onChange(noFilter())}
          className="cursor-pointer text-xs font-semibold text-primary hover:underline">
          Clear filters
        </button>
      )}
    </div>
  );
}
