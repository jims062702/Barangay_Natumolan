import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FiLock, FiPlus, FiX } from "react-icons/fi";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import Card from "../../../shared/ui/Card";
import { inputClasses } from "../../../shared/ui/FormField";
import FormPreview from "../../../shared/print/FormPreview";
import { SignatoryNames, type Signatory } from "../../../shared/print/SignatoryFields";
import { withoutHon } from "../../../shared/print/formKit";
import { vawcApi } from "../api";
import {
  annualReportHtml, casesReportHtml, dataCaptureHtml,
  type AnnualActivity, type AnnualPopulation, type AnnualReport, type CasesReport, type DataCapture, type DeskNames, type Headcount,
} from "../lib/deskFormsHtml";

type Signed<T> = T & { signatories: Record<string, string | null> };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const QUARTERS = [
  { value: "q1", label: "1st Quarter (Jan–Mar)" },
  { value: "q2", label: "2nd Quarter (Apr–Jun)" },
  { value: "q3", label: "3rd Quarter (Jul–Sep)" },
  { value: "q4", label: "4th Quarter (Oct–Dec)" },
];

const manila = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const thisYear = () => Number(manila().slice(0, 4));
const thisQuarter = () => `q${Math.floor((Number(manila().slice(5, 7)) - 1) / 3) + 1}`;

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

function YearSelect({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label="Year"
      className={`${inputClasses} w-auto cursor-pointer rounded-full py-2`}
    >
      {Array.from({ length: 5 }, (_, i) => thisYear() - i).map((y) => <option key={y}>{y}</option>)}
    </select>
  );
}

/**
 * Who signs the desk's forms — the official names, not correctable here.
 *
 * The Punong Barangay is read from the officials roster and the VAW Desk
 * person from the barangay's settings; a name that is wrong is changed
 * there, once, and every form follows.
 */
function deskNames(signatories: Record<string, string | null> | undefined): { list: Signatory[]; names: DeskNames } {
  const names = {
    vaw_desk: signatories?.vaw_desk ?? "",
    punong_barangay: withoutHon(signatories?.punong_barangay),
  };

  return {
    names,
    list: [
      { key: "vaw_desk", label: "Submitted by (VAW Desk)", value: names.vaw_desk },
      { key: "punong_barangay", label: "Noted by (Punong Barangay)", value: names.punong_barangay },
    ],
  };
}

const NAMES_NOTE = "The Punong Barangay's name comes from the officials roster; the VAW Desk's from the barangay's settings.";

/** Beside the print button: what is about to print, in counts only. */
function Summary({ children }: { children: ReactNode }) {
  return <p className="text-sm text-gray-600" data-testid="form-summary">{children}</p>;
}

/**
 * The printed VAW Desk forms.
 *
 * PRINT ONLY: none of the three is drawn on the page — the print dialog's
 * own preview is where a sheet is seen. The VAW-C Cases report carries the
 * victim-survivors' NAMES, so it is drawn up only when the officer asks —
 * never on a timer — and each time, every case on it gets a line in its
 * access trail. VAW Form 1 holds case codes and counts, and loads with the
 * period.
 */
export function DeskFormsCards() {
  /* ---------- VAW-C Cases ---------- */
  const [cYear, setCYear] = useState(thisYear);
  const [cPeriod, setCPeriod] = useState(thisQuarter);
  const [cases, setCases] = useState<Signed<CasesReport> | null>(null);
  const [drawing, setDrawing] = useState(false);
  const caseNames = deskNames(cases?.signatories);

  /* A different period is a different report — draw it up again. */
  useEffect(() => setCases(null), [cYear, cPeriod]);

  const drawUp = async () => {
    setDrawing(true);
    try {
      const r = await vawcApi.casesReport({ params: { year: cYear, period: cPeriod } });
      setCases(r.data.data as Signed<CasesReport>);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setDrawing(false);
    }
  };

  const casesHtml = useMemo(
    () => (cases ? casesReportHtml(cases, caseNames.names) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cases],
  );

  /* ---------- VAW Form 1 ---------- */
  const [dYear, setDYear] = useState(thisYear);
  const [dPeriod, setDPeriod] = useState(thisQuarter);
  const [capture, setCapture] = useState<Signed<DataCapture> | null>(null);
  const captureNames = deskNames(capture?.signatories);

  useEffect(() => {
    setCapture(null);
    vawcApi.dataCapture({ params: { year: dYear, period: dPeriod } })
      .then((r) => setCapture(r.data.data as Signed<DataCapture>))
      .catch((err) => toast(errorMessage(err), "error"));
  }, [dYear, dPeriod]);

  const captureHtml = useMemo(
    () => (capture ? dataCaptureHtml(capture, captureNames.names) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [capture],
  );

  return (
    <>
      <Card title="VAW-C Cases report" className="mt-6">
        <div className="-mt-2 mb-4 flex flex-wrap items-center gap-3">
          <p className="mr-auto flex max-w-xl gap-2 text-xs leading-relaxed text-gray-500">
            <FiLock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            One row per victim-survivor taken in, by name. Drawing it up is written to each case's
            access log. Legal paper, landscape.
          </p>
          <select
            value={cPeriod}
            onChange={(e) => setCPeriod(e.target.value)}
            aria-label="Report period"
            className={`${inputClasses} w-auto cursor-pointer rounded-full py-2`}
          >
            {QUARTERS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
            <option value="year">Whole year (summary)</option>
          </select>
          <YearSelect value={cYear} onChange={setCYear} />
          <button
            type="button"
            onClick={drawUp}
            disabled={drawing}
            className="cursor-pointer rounded-full border border-primary px-5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-50"
          >
            {drawing ? "Drawing up…" : cases ? "Draw up again" : "Draw up report"}
          </button>
        </div>

        {cases ? (
          <>
            <SignatoryNames names={caseNames.list} note={NAMES_NOTE} />
            <FormPreview
              html={casesHtml}
              title="VAW-C Cases report"
              printLabel="Print report"
              preview={false}
              toolbar={<Summary>{cases.subheading ?? cases.heading}: {plural(cases.rows.length, "victim-survivor")} on the report.</Summary>}
            />
          </>
        ) : (
          <p className="rounded-xl bg-secondary px-4 py-6 text-center text-sm text-gray-500">
            Choose the quarter and press Draw up report.
          </p>
        )}
      </Card>

      <Card title="VAW Form 1 — Barangay Data Capture Form" className="mt-6">
        <div className="-mt-2 mb-4 flex flex-wrap items-center gap-3">
          <p className="mr-auto max-w-xl text-xs leading-relaxed text-gray-500">
            Types of violence and the actions the barangay took, by case code — no names. A4 paper, landscape.
          </p>
          <select
            value={dPeriod}
            onChange={(e) => setDPeriod(e.target.value)}
            aria-label="Form period"
            className={`${inputClasses} w-auto cursor-pointer rounded-full py-2`}
          >
            <optgroup label="Quarter">
              {QUARTERS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
            </optgroup>
            <optgroup label="Month">
              {MONTHS.map((m, i) => <option key={m} value={`m${i + 1}`}>{m}</option>)}
            </optgroup>
            <option value="year">Whole year</option>
          </select>
          <YearSelect value={dYear} onChange={setDYear} />
        </div>

        <SignatoryNames names={captureNames.list} note={NAMES_NOTE} />
        <FormPreview
          html={captureHtml}
          title="VAW Form 1"
          printLabel="Print form"
          preview={false}
          disabled={!captureHtml}
          toolbar={<Summary>{capture ? `${capture.period}: ${plural(capture.totals.victims ?? 0, "case")}.` : "Loading the form…"}</Summary>}
        />
      </Card>

      <AnnualReportCard />
    </>
  );
}

const count = (n: number) => n.toLocaleString("en-US");

const fromRegister = (h: Headcount): AnnualPopulation => ({
  total: count(h.total),
  male: count(h.male),
  female: count(h.female),
  adults: count(h.adults),
  minors: count(h.minors),
});

const POPULATION_FIELDS: [keyof AnnualPopulation, string][] = [
  ["total", "Total Population"],
  ["male", "No. of Male"],
  ["female", "No. of Females"],
  ["adults", "No. of Adults (18 yrs & above)"],
  ["minors", "No. of Minors (17 yrs & below)"],
];

const ACTIVITY_FIELDS: [keyof AnnualActivity, string][] = [
  ["trainings", "Trainings"],
  ["advocacy", "Advocacy"],
  ["others", "Others"],
  ["remarks", "Remarks"],
];

const blankActivity = (): AnnualActivity => ({ trainings: "", advocacy: "", others: "", remarks: "" });

/**
 * The Barangay VAW Report — Annual Accomplishment Report.
 *
 * Counts only, so it loads with the year like VAW Form 1. The population
 * figures are the barangay register's (the Population Office's own
 * headcount) and are not changed here — a wrong figure is a wrong register,
 * corrected there. Section II's activities are typed here; they are not
 * saved anywhere — they live on this page until it is closed, and print
 * with the report.
 */
function AnnualReportCard() {
  const [year, setYear] = useState(thisYear);
  const [report, setReport] = useState<Signed<AnnualReport> | null>(null);
  const [activities, setActivities] = useState<AnnualActivity[]>(() => [blankActivity(), blankActivity(), blankActivity()]);
  const names = deskNames(report?.signatories);

  useEffect(() => {
    setReport(null);
    vawcApi.annualReport({ params: { year } })
      .then((r) => setReport(r.data.data as Signed<AnnualReport>))
      .catch((err) => toast(errorMessage(err), "error"));
  }, [year]);

  const head = report?.population;
  const population = head ? fromRegister(head) : null;

  const html = useMemo(
    () => (report && population ? annualReportHtml(report, { population, activities }, names.names) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report, activities],
  );

  const asOf = head ? new Date(`${head.as_of}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
  const setActivity = (i: number, key: keyof AnnualActivity, value: string) =>
    setActivities((rows) => rows.map((row, j) => (j === i ? { ...row, [key]: value } : row)));

  return (
    <Card title="Barangay VAW Report — Annual Accomplishment Report" className="mt-6">
      <div className="-mt-2 mb-4 flex flex-wrap items-center gap-3">
        <p className="mr-auto max-w-xl text-xs leading-relaxed text-gray-500">
          The year from January to December, in counts — no names and no case codes. A4 paper, portrait.
        </p>
        <YearSelect value={year} onChange={setYear} />
      </div>

      <ul className="mb-5 list-disc space-y-1 rounded-xl bg-secondary px-8 py-3 text-xs leading-relaxed text-gray-600" data-testid="annual-how-counted">
        <li><b>Clients served</b> counts different women: one woman with two cases is one client, and one victim.</li>
        <li><b>Acted upon</b> means a referral was made, a BPO was applied for or issued, or a follow-up was recorded.</li>
        <li>A case of two kinds is counted in both rows. <b>Sexual Extortion</b> counts every case filed as sexual violence; <b>Rape</b> and <b>Sexual Harassment</b> count the cases where that act was noted.</li>
        <li><b>Trafficking in Persons</b> is not recorded in the case files, so its row prints blank for writing in.</li>
      </ul>

      {population && head && (
        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-dark">Population, for the report's header</p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="annual-population">
            {POPULATION_FIELDS.map(([key, label]) => (
              <div key={key}>
                <dt className="mb-1 text-xs font-medium text-gray-600">{label}</dt>
                <dd className="rounded-xl border border-gray bg-secondary/60 px-4 py-2.5 text-sm font-semibold tabular-nums text-dark" data-field={label}>
                  {population[key]}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-gray-500" data-testid="annual-population-note">
            From the barangay register (Population Office) as of {asOf}.
            {head.sex_not_recorded > 0 && ` ${count(head.sex_not_recorded)} ${head.sex_not_recorded === 1 ? "resident has" : "residents have"} no sex recorded`}
            {head.sex_not_recorded > 0 && head.age_not_recorded > 0 && " and"}
            {head.age_not_recorded > 0 && ` ${count(head.age_not_recorded)} no birthdate`}
            {(head.sex_not_recorded > 0 || head.age_not_recorded > 0) && ", so the pairs do not add up to the total."}
          </p>
        </div>
      )}

      <div className="mb-5">
        <p className="mb-2 text-sm font-medium text-dark">
          II. Activities implemented to address VAW issues in the barangay
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm" data-testid="annual-activities">
            <thead>
              <tr className="text-xs text-gray-500">
                {ACTIVITY_FIELDS.map(([key, label]) => <th key={key} className="px-1 pb-1 font-medium">{label}</th>)}
                <th className="w-8" aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {activities.map((row, i) => (
                <tr key={i}>
                  {ACTIVITY_FIELDS.map(([key, label]) => (
                    <td key={key} className="p-1 align-top">
                      <textarea
                        value={row[key]}
                        onChange={(e) => setActivity(i, key, e.target.value)}
                        aria-label={`${label}, row ${i + 1}`}
                        rows={1}
                        className={`${inputClasses} resize-y`}
                      />
                    </td>
                  ))}
                  <td className="p-1 align-top">
                    <button
                      type="button"
                      onClick={() => setActivities((rows) => (rows.length > 1 ? rows.filter((_, j) => j !== i) : [blankActivity()]))}
                      aria-label={`Remove row ${i + 1}`}
                      className="mt-2 cursor-pointer rounded-full p-1.5 text-gray-400 hover:bg-secondary hover:text-danger"
                    >
                      <FiX className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setActivities((rows) => [...rows, blankActivity()])}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray px-3 py-1.5 text-xs font-semibold text-dark hover:border-primary hover:text-primary"
          >
            <FiPlus className="h-3.5 w-3.5" aria-hidden="true" /> Add a row
          </button>
          <p className="text-xs text-gray-500">Not saved — what you type stays on this page until you leave it, and prints with the report.</p>
        </div>
      </div>

      <SignatoryNames names={names.list} note={NAMES_NOTE} />
      <FormPreview
        html={html}
        title="Barangay VAW Report"
        printLabel="Print annual report"
        preview={false}
        disabled={!html}
        toolbar={<Summary>{report
          ? `${report.year}: ${plural(report.cases_received, "case")} received, ${plural(report.clients_served, "client")} served, ${report.cases_acted_upon.toLocaleString("en-US")} acted upon.`
          : "Loading the report…"}</Summary>}
      />
    </Card>
  );
}
