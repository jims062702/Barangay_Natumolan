import Card from "../../../shared/ui/Card";
import { FiCalendar } from "react-icons/fi";

/**
 * The sections of a barangay report, one office each.
 *
 * SHARED between the consolidated return (Secretary and Punong Barangay, all
 * five) and each office's own report (Health, Population), so the Health
 * Station's own figures and the Health section of the consolidated return are
 * drawn by the same code from the same numbers — they cannot disagree.
 *
 * ALL TABLES, NO CHARTS. These are printed and filed. A bar chart on a
 * barangay's mono laser is a row of grey blocks; a table of figures is still a
 * table of figures a year later.
 */

export type Section = "lupon" | "vawc" | "health" | "population" | "certificates";

export const SECTION_LABELS: Record<Section, string> = {
  lupon: "Katarungang Pambarangay",
  vawc: "VAWC Desk",
  health: "Health Station",
  population: "Population Office",
  certificates: "Certificates (Clerk)",
};

type Breakdown = { label: string; total: number }[];

export interface Report {
  period: { from: string; to: string; label: string };
  sections: Section[];
  lupon?: {
    filed: number;
    by_classification: Breakdown;
    settled: number;
    open_now: number;
    referred_out: number;
    hearings_held: number;
    hearings_scheduled: number;
    fees_settled: number;
  };
  vawc?: { opened: number; open_now: number; note: string };
  health?: {
    visits: number;
    doses_given: number;
    doses_by_vaccine: Breakdown;
    prenatal_visits: number;
    pregnancies_registered: number;
    senior_checks: number;
    animal_bites_referred: number;
  };
  population?: {
    residents: number;
    male: number;
    female: number;
    households: number;
    age_bands: Breakdown;
    registered: number;
    by_sector: Breakdown;
    /** Every zone and how many live there; one row when a zone was chosen. */
    by_zone?: Breakdown;
    /** The zone the figures are narrowed to, or null for the whole barangay. */
    zone?: string | null;
  };
  certificates?: {
    requested: number;
    released: number;
    waiting: number;
    by_type: Breakdown;
  };
}

/** One labelled figure in a report table. */
function Line({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <tr>
      <td className="border-b border-gray/60 py-2 pr-4 text-sm text-gray-600">
        {label}
        {hint && <span className="block text-xs text-gray-400">{hint}</span>}
      </td>
      <td className="border-b border-gray/60 py-2 text-right text-sm font-bold tabular-nums text-dark">
        {value}
      </td>
    </tr>
  );
}

function Figures({ children }: { children: React.ReactNode }) {
  return (
    <table className="w-full">
      <tbody>{children}</tbody>
    </table>
  );
}

/** A "by kind" table beneath the headline figures — drawn only if it has rows. */
function Breakdown({ title, rows }: { title: string; rows: Breakdown }) {
  if (rows.length === 0) return null;
  return (
    <>
      <p className="mb-2 mt-5 text-sm font-semibold text-dark">{title}</p>
      <Figures>
        {rows.map((row) => (
          <Line key={row.label} label={row.label} value={row.total} />
        ))}
      </Figures>
    </>
  );
}

/**
 * Which part of the Population Office's report to show — and so to print.
 * The office picks one, and the page draws only that.
 */
export type PopulationPart = "all" | "summary" | "age" | "sector" | "zone";

export const POPULATION_PARTS: [PopulationPart, string][] = [
  ["all", "Whole report"],
  ["summary", "Summary only"],
  ["age", "By age"],
  ["sector", "By sector"],
  ["zone", "By zone"],
];

/** Draws one section of a report, or nothing if it was not built. */
export function ReportSection({
  section,
  report,
  part = "all",
}: {
  section: Section;
  report: Report;
  /** Population only: the one part to draw. */
  part?: PopulationPart;
}) {
  const title = SECTION_LABELS[section];

  if (section === "lupon" && report.lupon) {
    const l = report.lupon;
    return (
      <Card title={title} className="print-plain">
        <Figures>
          <Line label="Cases filed" value={l.filed} />
          <Line label="Cases settled" value={l.settled} />
          <Line label="Cases referred out" value={l.referred_out}
            hint="To the VAWC desk, or to the barangay with jurisdiction" />
          <Line label="Cases still open" value={l.open_now} hint="At the end of the period" />
          <Line label="Hearings held" value={l.hearings_held} />
          <Line label="Hearings scheduled" value={l.hearings_scheduled} />
          {/* A COUNT, not a sum: the barangay keeps its own book of the
              money, and this system never touched a peso of it. */}
          <Line label="Filing fees settled" value={l.fees_settled}
            hint="Receipts the Lupon has seen and marked paid" />
        </Figures>
        <Breakdown title="Cases by nature" rows={l.by_classification} />
      </Card>
    );
  }

  if (section === "vawc" && report.vawc) {
    return (
      <Card title={title} className="print-plain">
        <Figures>
          <Line label="Cases opened" value={report.vawc.opened} />
          <Line label="Cases still open" value={report.vawc.open_now} />
        </Figures>
        <p className="mt-3 rounded-xl bg-secondary px-3.5 py-2.5 text-xs leading-relaxed text-gray-600">
          {report.vawc.note}
        </p>
      </Card>
    );
  }

  if (section === "health" && report.health) {
    const h = report.health;
    return (
      <Card title={title} className="print-plain">
        <Figures>
          <Line label="Patient consultations" value={h.visits} />
          <Line label="Immunization doses given" value={h.doses_given} hint="Counted by the day given" />
          <Line label="Prenatal visits" value={h.prenatal_visits} />
          <Line label="Pregnancies registered" value={h.pregnancies_registered} />
          <Line label="Senior citizen BP checks" value={h.senior_checks} />
          <Line label="Animal bites referred" value={h.animal_bites_referred}
            hint="Sent to an animal bite treatment centre" />
        </Figures>
        <Breakdown title="Doses given, by vaccine" rows={h.doses_by_vaccine} />
      </Card>
    );
  }

  if (section === "population" && report.population) {
    const p = report.population;
    return (
      <Card title={title} className="print-plain">
        {(part === "all" || part === "summary") && (
          <Figures>
            <Line label="Residents" value={p.residents} hint="Living, resident population on the register" />
            <Line label="Male" value={p.male} />
            <Line label="Female" value={p.female} />
            <Line label="Households" value={p.households} />
            <Line label="Newly registered this period" value={p.registered} />
          </Figures>
        )}
        {(part === "all" || part === "age") && <Breakdown title="By age" rows={p.age_bands} />}
        {(part === "all" || part === "sector") && (
          p.by_sector.length > 0 || part === "all"
            ? <Breakdown title="By sector" rows={p.by_sector} />
            : <p className="mt-2 text-sm text-gray-400">Nobody is on a sector list{p.zone ? ` in ${p.zone}` : ""}.</p>
        )}
        {(part === "all" || part === "zone") && <Breakdown title="By zone" rows={p.by_zone ?? []} />}
      </Card>
    );
  }

  if (section === "certificates" && report.certificates) {
    const c = report.certificates;
    return (
      <Card title={title} className="print-plain">
        <Figures>
          <Line label="Certificates requested" value={c.requested} hint="Counted by the day requested" />
          <Line label="Certificates released" value={c.released} hint="Counted by the day handed over" />
          <Line label="Still waiting" value={c.waiting} hint="Not yet released, at the time of printing" />
        </Figures>
        <Breakdown title="Requested, by certificate" rows={c.by_type} />
      </Card>
    );
  }

  return null;
}

/**
 * Which month is being reported on.
 *
 * A month input, because a barangay reports by the month — and choosing one
 * is the whole of "generating" the report: the figures load for it, and
 * Print puts them on paper.
 */
export function MonthPicker({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  return (
    <label className="print-hide flex items-center gap-2 rounded-full border border-gray bg-white px-3.5 py-1.5 text-sm font-medium text-dark shadow-xs">
      <FiCalendar className="h-4 w-4 text-primary" aria-hidden="true" />
      <span>Month:</span>
      <input
        type="month"
        value={value}
        max={new Date().toLocaleDateString("en-CA").slice(0, 7)}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="bg-transparent text-sm text-dark outline-none cursor-pointer"
        aria-label="Filter by month"
      />
    </label>
  );
}

/** "2026-09" to the from/to the server takes: the whole month, or up to today. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const end = `${month}-${String(last).padStart(2, "0")}`;
  const today = new Date().toLocaleDateString("en-CA");
  return { from: `${month}-01`, to: end > today ? today : end };
}
