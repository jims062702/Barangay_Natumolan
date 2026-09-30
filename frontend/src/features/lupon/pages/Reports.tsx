import { useEffect, useMemo, useRef, useState } from "react";
import { FiAlertTriangle, FiCalendar, FiCheckCircle, FiFolder } from "react-icons/fi";
import { Link } from "react-router-dom";
import { formatWallClock } from "../../../shared/lib/datetime";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import StatTile from "../../../shared/ui/StatTile";
import StatusBadge from "../../../shared/ui/StatusBadge";
import PageHeader from "../../../shared/ui/PageHeader";
import { inputClasses } from "../../../shared/ui/FormField";
import RevealGroup from "../../../shared/ui/RevealGroup";
import FormPreview, { type FormPreviewHandle } from "../../../shared/print/FormPreview";
import { SignatoryFields, useSignatories } from "../../../shared/print/SignatoryFields";
import { withoutHon } from "../../../shared/print/formKit";
import { luponApi } from "../api";
import { transmittalHtml, type Transmittal } from "../lib/transmittalForm";
import { casesFiledHtml, type CasesFiled } from "../lib/casesFiledForm";
import type { LuponCase, LuponHearing, LuponSettlement } from "../types";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

interface MonthlyReport {
  month: string | number;
  year: string | number;
  cases_filed: number;
  cases_settled: number;
  cases_dismissed: number;
  cases_referred: number;
  hearings_held: number;
  settlement_rate: number;
  /* The form itself, and who it is addressed to and signed by. */
  transmittal?: Transmittal;
  signatories?: Record<string, string | null>;
}

interface Deadlines {
  upcoming_hearings: LuponHearing[];
  repudiation_window: LuponSettlement[];
}

/**
 * Stages that mean the case is no longer active — the searchable archive.
 *
 * Five, not three: a complaint the complainant took back and a case
 * certified to court are as closed as a settled one, and they were missing
 * from the archive entirely — the two ends somebody is most likely to come
 * back and ask about.
 */
const CLOSED_STAGES = ["Settled", "Dismissed", "Referred", "Withdrawn", "CFA", "Closed — Unpaid"];

/**
 * What the Consolidated Cases Filed sheet may be narrowed to.
 *
 * The office's word on the left, the register's on the right: a withdrawn
 * complaint is "cancelled" at the counter, and a case certified to court is
 * a "CFA case". Nobody asks for the cases whose current_stage is CFA.
 */
const STATUS_FILTERS: [string, string][] = [
  ["", "All cases filed"],
  ["Filed", "Filed, not yet heard"],
  ["Mediation", "In mediation"],
  ["Conciliation", "In conciliation"],
  ["Settled", "Settled"],
  ["Withdrawn", "Cancelled"],
  ["Closed — Unpaid", "Closed — filing fee not paid"],
  ["CFA", "Filed CFA cases"],
  ["Dismissed", "Dismissed"],
  ["Referred", "Referred"],
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const asDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-PH") : "—";

/**
 * Hearing schedules are wall-clock values the secretary typed — parse them
 * as entered rather than shifting them by the browser's timezone.
 */
const asDateTime = (value?: string | null) => formatWallClock(value);

/** Days from today until `date` — negative means already overdue. */
const daysUntil = (date?: string | null) => {
  if (!date) return null;
  const diff = new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(diff / 86400000);
};

function DeadlineNote({ date }: { date?: string | null }) {
  const days = daysUntil(date);
  if (days === null) return <span className="text-gray-400">—</span>;
  if (days < 0)
    return <span className="font-semibold text-danger">{Math.abs(days)} day(s) overdue</span>;
  if (days === 0) return <span className="font-semibold text-warning">Due today</span>;
  return <span className="text-gray-500">in {days} day(s)</span>;
}

export default function Reports() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const [report, setReport] = useState<MonthlyReport | null>(null);
  /* The barangay's own list of the month's cases, and the status it is
     narrowed to. Its own preview, because it prints on its own sheet. */
  const [filed, setFiled] = useState<CasesFiled | null>(null);
  const [stage, setStage] = useState("");
  const filedPreview = useRef<FormPreviewHandle>(null);
  const [deadlines, setDeadlines] = useState<Deadlines | null>(null);
  const [archive, setArchive] = useState<LuponCase[]>([]);
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();
  const preview = useRef<FormPreviewHandle>(null);

  /* The names the form carries — correctable before it prints. */
  const s = report?.signatories ?? {};
  const signatoryDefaults = [
    { key: "presiding_judge", label: "Presiding Judge", value: s.presiding_judge ?? "" },
    { key: "court_place", label: "Court, place", value: s.court_place ?? "" },
    { key: "secretary", label: "Prepared by (Barangay Secretary)", value: s.secretary ?? "" },
    { key: "punong_barangay", label: "Attested by (Punong Barangay)", value: withoutHon(s.punong_barangay) },
    { key: "mlgoo", label: "DILG (MLGOO)", value: s.mlgoo ?? "" },
  ];
  const signatories = useSignatories(signatoryDefaults);

  const formHtml = useMemo(
    () =>
      report?.transmittal
        ? transmittalHtml(report.transmittal, {
            presiding_judge: signatories.names.presiding_judge ?? "",
            court_place: signatories.names.court_place ?? "",
            secretary: signatories.names.secretary ?? "",
            punong_barangay: signatories.names.punong_barangay ?? "",
            mlgoo: signatories.names.mlgoo ?? "",
          })
        : "",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    /* By value: the page refreshes on a timer, and a new object with the same
       rows must not reload the preview under somebody about to print it. */
    [JSON.stringify(report?.transmittal ?? null), JSON.stringify(signatories.names)],
  );

  const filedHtml = useMemo(
    () =>
      filed
        ? casesFiledHtml(filed, {
            secretary: signatories.names.secretary ?? "",
            punong_barangay: signatories.names.punong_barangay ?? "",
          })
        : "",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(filed), JSON.stringify(signatories.names)],
  );

  const loadReport = () => {
    luponApi.monthlyTransmittal({ params: { month, year } })
      .then((r) => setReport(r.data.data))
      .catch(() => setReport(null));

    luponApi.casesFiled({ params: { month, year, stage: stage || undefined } })
      .then((r) => setFiled(r.data.data))
      .catch(() => setFiled(null));
  };

  const loadRest = () => {
    luponApi.deadlines()
      .then((r) => setDeadlines(r.data.data))
      .catch(() => setDeadlines(null));

    // The archive is assembled per closed stage — the cases endpoint filters
    // one stage at a time.
    Promise.all(
      CLOSED_STAGES.map((stage) =>
        luponApi.cases({ params: { current_stage: stage } })
          .then((r) => (r.data.data.data ?? []) as LuponCase[])
          .catch(() => [] as LuponCase[])
      )
    )
      .then((groups) => setArchive(groups.flat()))
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, stage]);

  useEffect(() => {
    loadRest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoRefresh(() => {
    loadReport();
    loadRest();
  }, REFRESH.dashboard);

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => { loadReport(); loadRest(); }} />;

  return (
    <div>
      <PageHeader
        title="Reports & Archives"
        subtitle="The month's returns, the ten-day repudiation windows, and the searchable closed-case archive"
        actions={
          <>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="Report month"
              className={`${inputClasses} w-auto cursor-pointer rounded-full py-2`}
            >
              {MONTHS.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              aria-label="Report year"
              className={`${inputClasses} w-auto cursor-pointer rounded-full py-2`}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {/* NO PRINT BUTTON HERE. The header picks the month; each
                sheet is printed from its own card, where the names that go
                on it are also corrected. Two buttons reading "Print
                transmittal" on one screen read as two different sheets. */}
          </>
        }
      />

      <RevealGroup className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Cases filed" value={report?.cases_filed ?? 0} icon={FiFolder} />
        <StatTile
          label="Cases settled"
          value={report?.cases_settled ?? 0}
          icon={FiCheckCircle}
          tone="success"
        />
        <StatTile label="Hearings held" value={report?.hearings_held ?? 0} icon={FiCalendar} />
        <StatTile
          label="Settlement rate"
          value={`${report?.settlement_rate ?? 0}%`}
          icon={FiCheckCircle}
          tone="success"
          hint={`${MONTHS[Number(month) - 1]} ${year}`}
        />
      </RevealGroup>

      {/*
        The Monthly Transmittal of Final Reports, as the barangay's own sheet —
        what goes to the court, the DILG and the PNP by the fifth of the
        month.
      */}
      <Card title="Monthly Transmittal of Final Reports" className="mb-6">
        <p className="-mt-2 mb-4 text-xs text-gray-500">
          Every case filed in {MONTHS[Number(month) - 1]} {year}, with where it stands. Legal paper, landscape.
        </p>
        <SignatoryFields defaults={signatoryDefaults} state={signatories} />
        {formHtml ? (
          <FormPreview
            ref={preview}
            html={formHtml}
            title={`Monthly Transmittal of Final Reports, ${MONTHS[Number(month) - 1]} ${year}`}
            printLabel="Print transmittal"
          />
        ) : (
          <p className="py-6 text-center text-sm text-gray-400">Loading the transmittal…</p>
        )}
      </Card>

      {/*
        The barangay's own list of the month's cases.

        The sheet above is the court's form and says only what the court
        asks — a tick in a column. This one carries the TITLE of each
        complaint and where it ended up in words, which is what the office
        is asked for when somebody wants to know what the Lupon did.
      */}
      <Card title="Consolidated Cases Filed" className="mb-6">
        <p className="-mt-2 mb-3 text-xs text-gray-500">
          Every case filed in {MONTHS[Number(month) - 1]} {year}, with its title and where it
          stands. Legal paper, landscape.
        </p>
        {/* The same two names as the transmittal above — corrected there. */}
        {filedHtml ? (
          <FormPreview
            ref={filedPreview}
            html={filedHtml}
            title={`Consolidated Cases Filed, ${MONTHS[Number(month) - 1]} ${year}`}
            printLabel="Print the list"
            toolbar={
              /* Beside the button: choose what goes on the sheet, then
                 print it. `inputClasses` is a form field and would take the
                 whole width. */
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                aria-label="Case status"
                className="cursor-pointer rounded-full border border-gray bg-white px-3.5 py-2 text-xs text-dark outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
              >
                {STATUS_FILTERS.map(([value, label]) => (
                  <option key={value || "all"} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            }
          />
        ) : (
          <p className="py-6 text-center text-sm text-gray-400">Loading the list…</p>
        )}
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title="Monthly transmittal">
          <dl className="divide-y divide-gray/70 text-sm">
            {[
              ["Cases filed", report?.cases_filed ?? 0],
              ["Cases settled", report?.cases_settled ?? 0],
              ["Cases dismissed", report?.cases_dismissed ?? 0],
              ["Cases referred", report?.cases_referred ?? 0],
              ["Hearings held", report?.hearings_held ?? 0],
              ["Settlement rate", `${report?.settlement_rate ?? 0}%`],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between py-2.5">
                <dt className="text-gray-500">{label}</dt>
                <dd className="font-semibold text-dark">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-gray-400">
            Covering {MONTHS[Number(month) - 1]} {year}, for transmittal to the DILG.
          </p>
        </Card>

        <Card title="Upcoming hearings">
          {deadlines?.upcoming_hearings?.length ? (
            <ul className="divide-y divide-gray/70 text-sm">
              {deadlines.upcoming_hearings.map((hearing) => (
                <li key={hearing.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-dark">
                      {hearing.lupon_case?.case_number ?? "—"} · {hearing.hearing_type}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {hearing.lupon_case?.case_title ?? ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">
                    {asDateTime(hearing.scheduled_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-gray-400">No hearings scheduled.</p>
          )}
        </Card>
      </div>

      <div className="mb-6">
        <Card title="Ten-day repudiation window">
          <p className="mb-3 text-xs text-gray-500">
            A settlement becomes final once this period lapses without a proper
            repudiation.
          </p>
          {deadlines?.repudiation_window?.length ? (
            <ul className="divide-y divide-gray/70 text-sm">
              {deadlines.repudiation_window.map((settlement) => (
                <li key={settlement.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-dark">
                      {settlement.lupon_case?.case_number ?? "—"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Deadline {asDate(settlement.repudiation_deadline)}
                    </p>
                  </div>
                  <DeadlineNote date={settlement.repudiation_deadline} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-gray-400">
              No settlements inside the repudiation period.
            </p>
          )}
        </Card>

        {/*
          NO COMPLIANCE WATCH.

          It counted down to a compliance deadline that no longer exists —
          see useSettlementDocket. The office learns an obligation was not
          met from the complainant coming back, not from a date passing.
        */}
      </div>

      <Card title="Closed-case archive">
        <DataTable
          columns={[
            {
              header: "Case Number",
              render: (c: LuponCase) => (
                <Link
                  to={`/lupon/cases/${c.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {c.case_number}
                </Link>
              ),
            },
            { header: "Nature of the Case", render: (c: LuponCase) => c.case_classification },
            { header: "Filed", render: (c: LuponCase) => asDate(c.date_filed) },
            { header: "Resolved", render: (c: LuponCase) => asDate(c.date_resolved) },
            { header: "Outcome", render: (c: LuponCase) => <StatusBadge status={c.current_stage} /> },
          ]}
          rows={archive}
          rowKey={(c) => c.id}
          numbered
          total={archive.length}
          searchable
          searchPlaceholder="Search by Case Number or Nature of the Case…"
          getSearchText={(c) => `${c.case_number} ${c.case_title} ${c.case_classification}`}
          filters={[
            { label: "Outcome", getValue: (c) => c.current_stage, options: CLOSED_STAGES },
            { label: "Nature of the Case", getValue: (c) => c.case_classification },
          ]}
          loading={loading}
          emptyMessage="No closed cases in the archive yet."
        />
      </Card>

      <p className="mt-6 flex items-center gap-2 text-xs text-gray-400">
        <FiAlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        VAWC matters are outside Katarungang Pambarangay jurisdiction and never
        appear in these figures.
      </p>
    </div>
  );
}
