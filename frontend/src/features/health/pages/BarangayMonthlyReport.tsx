import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FiRotateCcw } from "react-icons/fi";
import { useAuth } from "../../../shared/auth/AuthContext";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import Card from "../../../shared/ui/Card";
import { inputClasses } from "../../../shared/ui/FormField";
import PageHeader from "../../../shared/ui/PageHeader";
import FormPreview from "../../../shared/print/FormPreview";
import { SignatoryFields, useSignatories } from "../../../shared/print/SignatoryFields";
import { PageLoading, usePageLoad, type PageLoad } from "../../../shared/ui/PageLoad";
import { filterSelect } from "../../dashboard/pages/OfficeReport";
import { healthApi } from "../api";
import { filterYears, MONTHS } from "../lib/records";
import { monthlyReportHtml, type MonthlySections } from "../lib/monthlyReportHtml";

interface Row { label: string; total: number }

export interface MonthlyFigures {
  year: number;
  month: number;
  month_name: string;
  consultation: { total: number; male: number; female: number; by_reason: Row[]; referred: number };
  prenatal: { visits: number; mothers: number; new_pregnancies: number };
  immunization: { doses: number; people: number; by_vaccine: Row[] };
  postpartum: { deliveries: number; followup_required: number };
  animal_bite: { total: number; by_animal: Row[]; by_category: Row[]; attended: number };
  submitted_by?: string | null;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (rows: Row[]) => rows.map((r) => `${r.label || "Not recorded"} ${r.total}`).join(", ");

/**
 * The figures, written the way the station writes its lines — plain
 * sentences with the counts in them. Only what the registers say: a section
 * with nothing in it says so, and nothing is concluded from the numbers.
 */
export function writeSections(f: MonthlyFigures): MonthlySections {
  const c = f.consultation;
  const unsexed = c.total - c.male - c.female;
  const consultation = c.total === 0
    ? "No consultations recorded this month."
    : `${plural(c.total, "consultation")} (${c.male} male, ${c.female} female${unsexed > 0 ? `, ${unsexed} not recorded` : ""})`
      + (c.by_reason.length ? `. By reason: ${list(c.by_reason)}` : "")
      + (c.referred ? `. ${plural(c.referred, "patient")} referred.` : ".");

  const p = f.prenatal;
  const prenatal = p.visits === 0 && p.new_pregnancies === 0
    ? "No prenatal check-ups recorded this month."
    : [
        p.visits ? `${plural(p.visits, "prenatal check-up")} of ${plural(p.mothers, "pregnant woman", "pregnant women")}` : "",
        p.new_pregnancies ? `${plural(p.new_pregnancies, "new pregnancy", "new pregnancies")} registered` : "",
      ].filter(Boolean).join("; ") + ".";

  const i = f.immunization;
  const immunization = i.doses === 0
    ? "No vaccine doses given this month."
    : `${plural(i.doses, "dose")} given to ${plural(i.people, "person", "persons")}: ${list(i.by_vaccine)}.`;

  const pp = f.postpartum;
  const postpartum = pp.deliveries === 0
    ? "No deliveries recorded this month."
    : `${plural(pp.deliveries, "mother")} delivered this month`
      + (pp.followup_required ? `; ${pp.followup_required} marked for postnatal follow-up.` : ".");

  const a = f.animal_bite;
  const animal_bite = a.total === 0
    ? "No animal bite cases this month."
    : `${plural(a.total, "animal bite case")} referred: ${list(a.by_animal)}`
      + (a.by_category.length ? ` (${list(a.by_category)})` : "")
      + (a.attended ? `; ${a.attended} attended treatment.` : ".");

  return { consultation, prenatal, immunization, postpartum, animal_bite };
}

const LABELS: [keyof MonthlySections, string][] = [
  ["consultation", "Consultation"],
  ["prenatal", "Prenatal"],
  ["immunization", "Immunization"],
  ["postpartum", "Postpartum"],
  ["animal_bite", "Animal bite"],
];

/**
 * The Health Station's one-page BARANGAY MONTHLY REPORT, on its own paper.
 *
 * The lines are written from the month's registers and can be corrected
 * here before printing — the station knows things a register does not.
 */
export default function BarangayMonthlyReport({
  year,
  month,
  onChoose,
  filters,
  pageLoad: shared,
}: {
  year: number;
  month: number;
  onChoose: (patch: { year?: number; month?: number }) => void;
  filters: ReactNode;
  pageLoad?: PageLoad;
}) {
  const { user } = useAuth();
  const own = usePageLoad();
  const pageLoad = shared ?? own;
  const [figures, setFigures] = useState<MonthlyFigures | null>(null);
  const [sections, setSections] = useState<MonthlySections | null>(null);

  const load = () => {
    setFigures(null);
    setSections(null);
    healthApi.barangayMonthly({ params: { year, month } })
      .then((r) => {
        const data = r.data.data as MonthlyFigures;
        setFigures(data);
        setSections(writeSections(data));
      })
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch((err) => toast(errorMessage(err), "error"));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [year, month]);

  const signers = [
    { key: "health_monthly_submitted_by", label: "Submitted by", value: figures?.submitted_by ?? user?.name ?? "" },
    { key: "health_monthly_position", label: "Position", value: user?.role ?? "" },
  ];
  const names = useSignatories(signers);

  const html = useMemo(() => (figures && sections ? monthlyReportHtml({
    monthName: figures.month_name,
    year: figures.year,
    sections,
    submittedBy: names.names.health_monthly_submitted_by ?? "",
    position: names.names.health_monthly_position ?? "",
  }) : ""), [figures, sections, names.names]);

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Barangay Monthly Report — the station's one-page report, written from the month's registers"
      />

      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        {filters}
        <select aria-label="Year" value={year} onChange={(e) => onChoose({ year: Number(e.target.value) })} className={filterSelect}>
          {filterYears().map((y) => <option key={y} value={y}>Year: {y}</option>)}
        </select>
        <select aria-label="Month" value={month} onChange={(e) => onChoose({ month: Number(e.target.value) })} className={filterSelect}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>Month: {m}</option>)}
        </select>
      </div>

      <Card title={`Lines for ${figures ? `${MONTHS[figures.month - 1]} ${figures.year}` : "the month"}`}>
        <div className="-mt-2 mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-2xl text-xs leading-relaxed text-gray-500">
            Written from the consultations, prenatal records, doses, deliveries and animal-bite referrals
            recorded for the month. Correct or add to any line — what is here is what prints.
          </p>
          <button
            type="button"
            onClick={() => figures && setSections(writeSections(figures))}
            disabled={!figures}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray px-3 py-1.5 text-xs font-semibold text-dark hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <FiRotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Write the lines again from the records
          </button>
        </div>
        {sections ? (
          <div className="grid gap-4 md:grid-cols-2" data-testid="monthly-sections">
            {LABELS.map(([key, label]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-sm font-medium text-dark">{label}</span>
                <textarea
                  value={sections[key]}
                  onChange={(e) => setSections({ ...sections, [key]: e.target.value })}
                  rows={3}
                  aria-label={label}
                  className={`${inputClasses} resize-y`}
                />
              </label>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-gray-400">Reading the month's registers…</p>
        )}
      </Card>

      <Card title="Barangay Monthly Report" className="mt-6">
        <SignatoryFields defaults={signers} state={names} />
        {html ? (
          <FormPreview html={html} title="Barangay Monthly Report" printLabel="Print report" />
        ) : (
          <p className="py-6 text-center text-sm text-gray-400">Preparing the form…</p>
        )}
      </Card>
    </div>
  );
}
