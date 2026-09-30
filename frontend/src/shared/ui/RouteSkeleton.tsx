import { useLayoutEffect, useRef, type ReactElement } from "react";
import { useLocation } from "react-router-dom";
import { sessionHint, useAuth } from "../auth/AuthContext";
import Skeleton from "./Skeleton";

/**
 * THE page skeleton — the one loading state a page has.
 *
 * WHY THERE IS ONLY ONE. A page used to arrive in up to four drawings in a
 * row: the app shell's while the session was checked, a guessed shape while
 * the page's code downloaded, then the page's own heading over a second,
 * different skeleton (pulsing table rows; a dashboard grid of another shape)
 * while its data came, and then the page. Three loading states that did not
 * agree with each other, each replacing the last.
 *
 * Now every one of those waits draws THIS, and this draws one named skeleton
 * per page, chosen from the address — which is known before the code or the
 * data is:
 *
 *   the session check     AppShellSkeleton, with this as its body
 *   the code download     the Suspense fallback in DashboardLayout
 *   the first data        the page itself, until its first answer
 *                         (usePageLoad / PageLoading)
 *
 * so the three are one continuous skeleton, and the page replaces it once.
 *
 * WHAT EACH ONE IS DRAWN FROM. The page as it actually renders, measured in
 * the browser block by block: how many stat tiles and in how many columns,
 * whether there is a notice above the list, a period bar, a row of filters,
 * how many columns the table has. The heading, tiles and filters land where
 * the real ones will; only a table's length, which is the data's, can move.
 *
 * The dashboard is drawn for the office that is signed in, because each
 * office has its own. During the session check the user is not known yet,
 * so the office this device last signed in as is used (sessionHint) — it is
 * the same account the stored token belongs to.
 */

/* ------------------------------------------------------------------
 | Blocks — each drawn to the real component's dimensions
 * ---------------------------------------------------------------- */

/**
 * PageHeader: breadcrumb (20px + 16px), title (32px), subtitle (2px + 20px),
 * pill buttons (40px) on the right. 90px with a trail, 54px without.
 */
function Head({ actions = 1, crumbs = true, lines = 1, stacked = false }: {
  actions?: number;
  crumbs?: boolean;
  /** Subtitle lines — some wrap to two at desktop width. */
  lines?: number;
  /** The buttons wrap below the title (a long subtitle pushes them down). */
  stacked?: boolean;
}) {
  const buttons = actions > 0 && (
    <div className="flex items-center gap-2">
      {Array.from({ length: actions }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-36 rounded-full" />
      ))}
    </div>
  );

  return (
    <div className="mb-6">
      {crumbs && (
        <div className="mb-4 flex h-5 items-center gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      )}
      <div className={stacked ? "space-y-3" : "flex flex-wrap items-center justify-between gap-3"}>
        <div className="min-w-0">
          <div className="flex h-8 items-center">
            <Skeleton className="h-6 w-64" />
          </div>
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className={`${i === 0 ? "mt-0.5" : ""} flex h-5 items-center`}>
              <Skeleton className={`h-3.5 ${i === lines - 1 && lines > 1 ? "w-72" : "w-[28rem]"} max-w-full`} />
            </div>
          ))}
        </div>
        {buttons}
      </div>
    </div>
  );
}

/** A dashboard's heading: no trail. */
const DashHead = (props: { actions?: number; lines?: number; stacked?: boolean }) => <Head crumbs={false} {...props} />;

/** A tinted notice above a list — "Reminder:", "How the workflow moves". */
function Note({ h, className = "mb-4" }: { h: number; className?: string }) {
  return (
    <div className={`${className} rounded-2xl border border-gray bg-white px-4 py-3`} style={{ height: h }}>
      <div className="space-y-2">
        <Skeleton className="h-3 w-2/3" />
        {h > 50 && <Skeleton className="h-3 w-1/2" />}
        {h > 75 && <Skeleton className="h-3 w-3/5" />}
      </div>
    </div>
  );
}

/** PeriodFilter: the preset chips and the month / year selects, in a card (102px). */
function Period() {
  return (
    <div className="mb-4 rounded-2xl border border-gray bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
        <Skeleton className="h-9 w-32 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <div className="mt-3 flex h-5 items-center"><Skeleton className="h-3 w-48" /></div>
    </div>
  );
}

/** StatTile: 90px, or 106px with its hint line. */
function Tile({ hint = false }: { hint?: boolean }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray bg-white p-5 shadow-sm">
      <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="flex h-4 items-center"><Skeleton className="h-2.5 w-24" /></div>
        <div className="flex h-8 items-center"><Skeleton className="h-6 w-14" /></div>
        {hint && <div className="flex h-4 items-center"><Skeleton className="h-2.5 w-28" /></div>}
      </div>
    </div>
  );
}

/* Written out: Tailwind scans source text, and a class it never sees written
   is a class it never builds. */
const TILE_GRID = {
  1: "grid gap-4",
  2: "grid gap-4 sm:grid-cols-2",
  3: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
  4: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
} as const;

function Tiles({ n, cols = n as 1 | 2 | 3 | 4, hint = false, className = "mb-6" }: {
  n: number;
  cols?: 1 | 2 | 3 | 4;
  hint?: boolean;
  className?: string;
}) {
  return (
    <div className={`${className} ${TILE_GRID[cols]}`}>
      {Array.from({ length: n }).map((_, i) => <Tile key={i} hint={hint} />)}
    </div>
  );
}

/** A Card of a fixed height with a title — a chart, a list, a panel of facts. */
function Panel({ h, title = true, className = "" }: { h: number; title?: boolean; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray bg-white p-5 shadow-sm ${className}`} style={{ height: h }}>
      {title && <Skeleton className="mb-4 h-5 w-48" />}
      <div className="space-y-3">
        {Array.from({ length: Math.max(1, Math.floor((h - (title ? 76 : 40)) / 36)) }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <Skeleton className="h-3.5" style={{ width: `${[62, 48, 55, 40, 58][i % 5]}%` }} />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Panels side by side from lg: up, as the dashboards and reports lay theirs. */
function Panels({ hs, cols = 2, className = "mt-6" }: { hs: number[]; cols?: 1 | 2 | 3; className?: string }) {
  const grid = { 1: "grid gap-6", 2: "grid gap-6 lg:grid-cols-2", 3: "grid gap-6 lg:grid-cols-3" }[cols];

  return (
    <div className={`${className} ${grid}`}>
      {hs.map((h, i) => <Panel key={i} h={h} />)}
    </div>
  );
}

/**
 * A DataTable in a Card: an optional title, an optional row of filters
 * (RecordFilters), the toolbar (search box and selects), the table — or,
 * on a phone, DataTable's stack of cards — and the pager.
 */
function Table({ columns, rows = 6, search = true, selects = 0, filters = 0, title = false, pager = true, className = "" }: {
  columns: number;
  rows?: number;
  search?: boolean;
  /** Selects on the toolbar, beside the search box. */
  selects?: number;
  /** A row of filter selects above the toolbar. */
  filters?: number;
  title?: boolean;
  pager?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-gray bg-white p-5 shadow-sm ${className}`}>
      {title && <Skeleton className="mb-4 h-5 w-52" />}
      {filters > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {Array.from({ length: filters }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-xl" />
          ))}
        </div>
      )}
      {(search || selects > 0) && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {search && <Skeleton className="h-10 flex-1 rounded-full sm:min-w-56" />}
          {Array.from({ length: selects }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-full sm:w-36" />
          ))}
        </div>
      )}

      {/* Phones: DataTable stacks each row into its own card. */}
      <div className="space-y-3 sm:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray p-4">
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-baseline justify-between gap-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-gray sm:block">
        <div className="flex gap-4 bg-secondary px-4 py-3.5">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        <div className="divide-y divide-gray/70">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex items-center gap-4 px-4 py-4">
              {Array.from({ length: columns }).map((_, c) => (
                <Skeleton key={c} className="h-3.5 flex-1" style={{ maxWidth: `${[70, 45, 60, 35, 55, 50][c % 6]}%` }} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {pager && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-3 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-16 rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
}

/** A row of pill filters above a report or a list, right-aligned as OfficeReport lays them. */
function FilterPills({ n, h = 40, className = "mb-6 justify-end" }: { n: number; h?: number; className?: string }) {
  return (
    <div className={`${className} flex flex-wrap items-center gap-2`}>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="w-40 rounded-full" style={{ height: h }} />
      ))}
    </div>
  );
}

/** Tabs or chips across the top of a list — 32px chips, or 38px tab buttons. */
function Chips({ n, tabs = false, className = "mb-4" }: { n: number; tabs?: boolean; className?: string }) {
  return (
    <div className={`${className} flex flex-wrap gap-2`}>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className={`${tabs ? "h-[38px] w-32" : "h-8 w-28"} rounded-full`} />
      ))}
    </div>
  );
}

/** A form in cards: labelled boxes, three to a row from lg: up. */
function FormCards({ sections, fields = 6, className = "space-y-6" }: { sections: number; fields?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: sections }).map((_, s) => (
        <div key={s} className="rounded-2xl border border-gray bg-white p-5 shadow-sm">
          <Skeleton className="mb-1.5 h-5 w-48" />
          <Skeleton className="mb-5 h-3 w-72 max-w-full" />
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: fields }).map((_, i) => (
              <div key={i}>
                <Skeleton className="mb-1.5 h-3 w-24" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A "← Back to …" link above a record's heading. */
const BackLink = () => <Skeleton className="mb-3 h-5 w-48" />;

/* ------------------------------------------------------------------
 | The dashboards — one per office, as each is actually laid out
 * ---------------------------------------------------------------- */

function dashboardFor(office: string | undefined, role: string | undefined): [string, () => ReactElement] {
  switch (office) {
    case "VAWC":
      return ["VawcDashboardSkeleton", () => (
        <div>
          <DashHead />
          <Note h={66} className="mb-6" />
          <Tiles n={4} />
          <Panels hs={[342, 342]} className="" />
        </div>
      )];
    case "Lupon":
      return ["LuponDashboardSkeleton", () => (
        <div>
          <DashHead />
          <Tiles n={4} />
          <Panels hs={[640, 640]} className="" />
        </div>
      )];
    case "Population":
      return ["PopulationDashboardSkeleton", () => (
        <div>
          <DashHead />
          <Tiles n={4} className="" />
          <Panels hs={[432, 432]} />
          <Panels hs={[560, 560]} />
        </div>
      )];
    case "Health Station":
      return ["HealthDashboardSkeleton", () => (
        <div>
          <DashHead />
          <Tiles n={4} className="" />
          <Tiles n={4} hint className="mt-4" />
          <Panel h={420} className="mt-6" />
        </div>
      )];
    case "SK":
      return ["SkDashboardSkeleton", () => (
        <div>
          <DashHead stacked />
          <Tiles n={3} />
          <Panel h={200} />
        </div>
      )];
    case "Admin":
      return ["AdminDashboardSkeleton", () => (
        <div>
          <DashHead />
          <Tiles n={4} className="" />
          <Panels hs={[226, 226]} />
        </div>
      )];
    default:
      /* The Main Office: the Punong Barangay's executive view, or the
         counter's. */
      if (role === "Punong Barangay") {
        return ["ExecutiveDashboardSkeleton", () => (
          <div>
            <DashHead actions={0} />
            <Tiles n={3} hint className="" />
            <Panel h={150} className="mt-6" />
            <Panel h={396} className="mt-6" />
          </div>
        )];
      }
      return ["MainOfficeDashboardSkeleton", () => (
        <div>
          <DashHead actions={0} />
          <Tiles n={3} hint className="" />
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Table columns={3} rows={5} search={false} title pager={false} />
            <Panel h={462} />
          </div>
        </div>
      )];
  }
}

/* ------------------------------------------------------------------
 | Every other page
 * ---------------------------------------------------------------- */

type Draw = () => ReactElement;

/**
 * Address → the page's skeleton. A string matches that address and
 * everything under it, and the LONGEST match wins; a pattern matches exactly
 * and beats any string — a record (/lupon/cases/12) is not its list.
 */
const PAGES: [string | RegExp, string, Draw][] = [
  /* ---- Records opened by id: their own shapes, not their lists' ---- */
  [/^\/population\/residents\/(non-residents\/)?\d+$/, "ResidentDetailSkeleton", () => (
    <div>
      <Head actions={2} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel h={545} className="lg:col-span-2" />
        <Panel h={545} />
      </div>
      <Panel h={456} className="mt-6" />
      <Panel h={179} className="mt-6" />
    </div>
  )],
  [/^\/population\/residents\/(non-residents\/)?\d+\/edit$/, "ResidentEditSkeleton", () => (
    <div>
      <Head />
      <FormCards sections={1} fields={12} />
    </div>
  )],
  [/^\/lupon\/cases\/\d+$/, "LuponCaseDetailSkeleton", () => (
    <div>
      <BackLink />
      <Head actions={0} />
      <Note h={62} className="mb-6" />
      <Note h={110} className="mb-6" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel h={634} className="lg:col-span-2" />
        <Panel h={400} />
      </div>
    </div>
  )],
  [/^\/lupon\/hearings\/\d+\/session$/, "HearingSessionSkeleton", () => (
    <div>
      <BackLink />
      <Head />
      <Note h={46} />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Panel h={420} />
        <Panel h={620} />
      </div>
    </div>
  )],
  [/^\/vawc\/cases\/\d+$/, "VawcCaseDetailSkeleton", () => (
    <div>
      <Head actions={2} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel h={560} />
        <div className="space-y-6 lg:col-span-2">
          <Panel h={220} />
          <Panel h={220} />
          <Panel h={220} />
        </div>
      </div>
    </div>
  )],
  [/^\/health\/maternal\/pregnancy\/\d+$/, "MotherRecordSkeleton", () => (
    <div>
      <Head />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Panel h={300} />
          <Table columns={11} rows={3} search={false} title pager={false} />
        </div>
        <div className="min-w-0 space-y-6">
          <Panel h={330} />
          <Panel h={180} />
        </div>
      </div>
    </div>
  )],
  [/^\/population\/rbim\/(new|\d+)$/, "CensusFormSkeleton", () => (
    <div>
      <DashHead />
      <FormCards sections={5} fields={9} className="space-y-4" />
    </div>
  )],

  /* ---- The Main Office ---- */
  ["/certificates", "CertificatesSkeleton", () => (
    <div>
      <Head />
      <Note h={90} />
      <Table columns={8} selects={1} />
    </div>
  )],
  ["/certificates/report", "CertificateReportSkeleton", () => (
    <div>
      <Head />
      <Panel h={395} className="mb-6" />
      <Period />
      <Panel h={342} />
      <Panel h={243} className="mt-12" />
    </div>
  )],
  ["/services", "ServiceRequestsSkeleton", () => (
    <div>
      <Head actions={0} />
      <Note h={58} />
      <div className="rounded-2xl border border-gray bg-white p-5 shadow-sm">
        <Chips n={5} />
        <Table columns={6} className="border-0 p-0 shadow-none" />
      </div>
    </div>
  )],
  ["/records", "AdministrativeRecordsSkeleton", () => (
    <div>
      <Head />
      <Table columns={6} selects={1} />
    </div>
  )],
  ["/sessions", "SessionsSkeleton", () => (
    <div>
      <Head />
      <Period />
      <Table columns={7} search={false} />
    </div>
  )],
  ["/reports/consolidated", "ConsolidatedReportSkeleton", () => (
    <div>
      <Head />
      <FilterPills n={2} h={34} />
      <Panel h={900} />
    </div>
  )],
  ["/chat", "LiveChatSkeleton", () => (
    <div>
      <Head actions={0} />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Panel h={520} />
        <Panel h={520} title={false} />
      </div>
    </div>
  )],

  /* ---- Lupon ---- */
  ["/lupon/cases", "LuponCasesSkeleton", () => (
    <div>
      <Head />
      <Note h={58} />
      <Period />
      <Table columns={10} selects={1} />
    </div>
  )],
  ["/vawc/online-reports", "VawcOnlineReportsSkeleton", () => (
    <div>
      <Head actions={0} />
      <Tiles n={2} className="mb-5" />
      <Table columns={7} search={false} />
    </div>
  )],
  ["/lupon/online-complaints", "OnlineComplaintsSkeleton", () => (
    <div>
      <Head actions={0} />
      <Note h={65} />
      <Tiles n={3} className="mb-5" />
      <Table columns={8} search={false} />
    </div>
  )],
  ["/lupon/settlements", "SettlementsSkeleton", () => (
    <div>
      <Head actions={0} />
      <Note h={58} />
      <Tiles n={2} />
      <Table columns={8} selects={2} />
    </div>
  )],
  ["/lupon/reports", "LuponReportsSkeleton", () => (
    <div>
      <Head actions={0} />
      <Tiles n={4} hint />
      <Panel h={358} className="mb-6" />
      <Panel h={154} className="mb-6" />
      <Panels hs={[600, 600]} className="" />
    </div>
  )],
  ["/lupon/hearings", "HearingsSkeleton", () => (
    <div>
      <Head />
      <Tiles n={1} />
      <Table columns={7} selects={1} />
    </div>
  )],
  ["/lupon/hearings/for-summons", "ForSummonsSkeleton", () => (
    <div>
      <Head />
      <Tiles n={1} hint />
      <Table columns={8} />
    </div>
  )],
  ["/lupon/hearings/upcoming", "UpcomingHearingsSkeleton", () => (
    <div>
      <Head />
      <Tiles n={2} hint />
      <Table columns={8} selects={1} />
    </div>
  )],
  ["/lupon/hearings/past", "PastHearingsSkeleton", () => (
    <div>
      <Head />
      <Tiles n={2} />
      <Table columns={9} selects={1} />
    </div>
  )],
  ["/lupon/hearings/cancelled", "CancelledHearingsSkeleton", () => (
    <div>
      <Head />
      <Tiles n={1} />
      <Table columns={9} />
    </div>
  )],
  ["/lupon/hearings/cfa", "CfaCasesSkeleton", () => (
    <div>
      <Head />
      <Tiles n={1} />
      <Table columns={9} />
    </div>
  )],
  ["/lupon/hearings/calendar", "HearingCalendarSkeleton", () => (
    <div>
      <Head actions={0} />
      <Tiles n={1} hint />
      <div className="rounded-2xl border border-gray bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
        <div className="overflow-hidden">
          <div className="min-w-[46rem]">
            <div className="grid grid-cols-7 gap-1.5 pb-1.5">
              {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="mx-auto h-3 w-8" />)}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )],

  /* ---- VAWC ---- */
  ["/vawc/cases", "VawcCasesSkeleton", () => (
    <div>
      <Head />
      <Note h={46} />
      <Period />
      <Table columns={10} selects={3} />
    </div>
  )],
  ["/vawc/documents", "VawcDocumentsSkeleton", () => (
    <div>
      <Head actions={0} />
      <Note h={66} />
      <Note h={58} />
      <Chips n={2} tabs />
      <Table columns={9} selects={1} />
    </div>
  )],
  ["/vawc/reports", "VawcReportsSkeleton", () => (
    <div>
      <Head actions={0} />
      <Panel h={342} className="mb-6" />
      <Panel h={374} />
      <Panels hs={[322, 322, 322]} cols={3} />
    </div>
  )],

  /* ---- Population ---- */
  ["/population/residents", "ResidentsSkeleton", () => (
    <div>
      <Head actions={3} />
      <Table columns={8} selects={3} rows={10} />
    </div>
  )],
  ["/population/residents/create", "ResidentCreateSkeleton", () => (
    <div>
      <Head />
      <FormCards sections={2} fields={9} />
    </div>
  )],
  ["/population/households", "HouseholdsSkeleton", () => (
    <div>
      <Head actions={0} />
      <Table columns={7} selects={1} rows={10} />
    </div>
  )],
  ["/population/sectors", "SectorListsSkeleton", () => (
    <div>
      <Head actions={0} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Panel h={132} title={false} />
        <Panel h={132} title={false} />
        <Panel h={132} title={false} />
      </div>
      <Panel h={382} className="mb-6" />
      <Panel h={459} className="mb-12" />
      <Table columns={7} selects={2} title />
    </div>
  )],
  ["/population/accounts", "PortalAccountsSkeleton", () => (
    <div>
      <Head actions={0} />
      <Table columns={8} />
    </div>
  )],
  ["/population/reports", "PopulationReportSkeleton", () => (
    <div>
      <Head />
      <FilterPills n={3} />
      <Panel h={900} />
    </div>
  )],
  ["/verify-records", "RecordsVerificationSkeleton", () => (
    <div>
      <Head actions={0} />
      <Note h={58} />
      <Panel h={260} />
    </div>
  )],

  /* ---- Health Station ---- */
  ["/health/visits", "PatientVisitsSkeleton", () => (
    <div>
      <Head actions={2} />
      <Table columns={7} />
    </div>
  )],
  ["/health/immunization", "ImmunizationSkeleton", () => (
    <div>
      <Head actions={2} />
      <Table columns={7} />
    </div>
  )],
  ["/health/child-health", "ChildHealthSkeleton", () => (
    <div>
      <Head />
      <Table columns={11} filters={3} />
    </div>
  )],
  ["/health/maternal", "MaternalHealthSkeleton", () => (
    <div>
      <Head />
      <Table columns={12} filters={4} />
    </div>
  )],
  ["/health/prenatal", "PrenatalSkeleton", () => (
    <div>
      <Head />
      <Table columns={15} filters={4} />
    </div>
  )],
  ["/health/reports", "HealthReportsSkeleton", () => (
    <div>
      <Head />
      <FilterPills n={2} />
      <Panel h={461} />
    </div>
  )],

  /* ---- SK ---- */
  ["/sk/hero-slides", "HeroSlidesSkeleton", () => (
    <div>
      <Head />
      <div className="mb-3 flex h-5 items-center"><Skeleton className="h-3.5 w-80" /></div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Panel h={318} title={false} />
        <Panel h={318} title={false} />
        <Panel h={318} title={false} />
      </div>
    </div>
  )],
  ["/sk/announcements", "AnnouncementsSkeleton", () => (
    <div>
      <Head />
      <Chips n={4} />
      <Table columns={7} selects={1} />
    </div>
  )],
  ["/sk/officials", "OfficialsSkeleton", () => (
    <div>
      <Head />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel h={691} />
        <Panel h={691} />
      </div>
    </div>
  )],

  /* ---- System administration ---- */
  ["/admin/users", "UserManagementSkeleton", () => (
    <div>
      <Head />
      <Note h={80} className="mb-6" />
      <Table columns={7} />
    </div>
  )],
  ["/admin/residents", "ResidentAccountsAdminSkeleton", () => (
    <div>
      <Head actions={0} />
      <Table columns={7} />
    </div>
  )],
  ["/admin/non-residents", "NonResidentsSkeleton", () => (
    <div>
      <Head actions={0} lines={2} />
      <Table columns={6} />
    </div>
  )],

  /* ---- The resident's own portal ---- */
  ["/resident", "PortalHomeSkeleton", () => (
    <div>
      <DashHead actions={0} />
      <Tiles n={3} />
      <Panel h={122} />
      <Panel h={150} className="mt-6" />
      <Panels hs={[160, 160]} />
    </div>
  )],
  ["/resident/requests", "PortalRequestsSkeleton", () => (
    <div>
      <DashHead />
      <Table columns={8} search={false} rows={4} />
    </div>
  )],
  ["/resident/vawc-report", "PortalVawcReportSkeleton", () => (
    <div>
      <DashHead />
      <Note h={46} />
      <Table columns={4} search={false} rows={3} title />
    </div>
  )],
  ["/resident/file-complaint", "PortalFileComplaintSkeleton", () => (
    <div>
      <DashHead />
      <Table columns={6} search={false} rows={4} title />
    </div>
  )],
  ["/resident/lupon", "PortalLuponSkeleton", () => (
    <div>
      <Head actions={0} />
      <Table columns={6} search={false} rows={4} />
    </div>
  )],
  ["/resident/health", "PortalHealthSkeleton", () => (
    <div>
      <DashHead actions={0} />
      <Note h={72} className="mb-6" />
      <Table columns={8} search={false} rows={5} title />
    </div>
  )],
  ["/resident/announcements", "PortalAnnouncementsSkeleton", () => (
    <div>
      <DashHead actions={0} />
      <Chips n={6} />
      <div className="space-y-4">
        <Panel h={155} />
        <Panel h={155} />
      </div>
    </div>
  )],
  ["/resident/profile", "PortalProfileSkeleton", () => (
    <div>
      <DashHead actions={0} />
      <Panels hs={[386, 386]} className="" />
      <Panels hs={[184, 184]} />
      <Panel h={192} className="mt-6" />
    </div>
  )],
];

/** The skeleton for an address, and its name. */
export function skeletonFor(pathname: string, office?: string, role?: string): [string, Draw] {
  if (pathname === "/dashboard") return dashboardFor(office, role);

  for (const [match, name, draw] of PAGES) {
    if (match instanceof RegExp && match.test(pathname)) return [name, draw];
  }

  let best: [string, Draw] | null = null;
  let longest = -1;
  for (const [match, name, draw] of PAGES) {
    if (typeof match !== "string") continue;
    if ((pathname === match || pathname.startsWith(match + "/")) && match.length > longest) {
      best = [name, draw];
      longest = match.length;
    }
  }

  /* An address nobody listed — a new page — gets a heading over a list,
     which is what nearly every page here is. */
  return best ?? ["ListPageSkeleton", () => (
    <div>
      <Head />
      <Table columns={6} />
    </div>
  )];
}

export default function RouteSkeleton() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const hint = user ? null : sessionHint();
  const [name, draw] = skeletonFor(pathname, user?.office ?? hint?.office, user?.role ?? hint?.role);
  const ref = useRef<HTMLDivElement>(null);

  /*
   * One pulse, not a restart.
   *
   * The same skeleton is drawn by up to three owners in a row — the session
   * check, the code download, the page's first request. Each new copy would
   * begin its pulse from the top, and the swap would blink although nothing
   * changed shape. Every bar is put on the document's clock instead, so a
   * new copy picks the pulse up exactly where the old one was.
   */
  useLayoutEffect(() => {
    try {
      ref.current?.getAnimations({ subtree: true }).forEach((animation) => {
        animation.startTime = 0;
      });
    } catch {
      /* An older browser: the pulse restarts, and that is all. */
    }
  }, [name]);

  return (
    <div ref={ref} data-page-skeleton={name} aria-busy="true">
      <span role="status" aria-live="polite" className="sr-only">Loading the page</span>
      <div aria-hidden="true">{draw()}</div>
    </div>
  );
}
