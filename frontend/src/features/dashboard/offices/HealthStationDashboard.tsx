import { useEffect, useState } from "react";
import { FiActivity, FiCalendar, FiClipboard, FiHeart, FiPlus, FiSmile, FiUser } from "react-icons/fi";
import { Link } from "react-router-dom";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { PageLoading, settleAll, usePageLoad } from "../../../shared/ui/PageLoad";
import StatTile from "../../../shared/ui/StatTile";
import PageHeader from "../../../shared/ui/PageHeader";
import RevealGroup from "../../../shared/ui/RevealGroup";
import { dashboardApi } from "../api";
import { healthApi } from "../../health/api";
import type { RecordsSummary } from "../../health/types";

interface Coverage {
  total_visits: number;
  total_immunized: number;
  total_prenatal: number;
  immunization_coverage: number;
}

export default function HealthStationDashboard() {
  const [todayVisits, setTodayVisits] = useState(0);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  /* The record books' counts — every one a COUNT of rows, from the server. */
  const [records, setRecords] = useState<RecordsSummary | null>(null);

  // Live updates: bump `tick` to re-run the fetches below.
  const [tick, setTick] = useState(0);
  useAutoRefresh(() => setTick((t) => t + 1), REFRESH.dashboard);

  /* And within a second when somebody else touches one. */
  usePulse("health", () => setTick((t) => t + 1));

  /* Its skeleton until the first answer, then the page — see PageLoad. A
     refresh after that keeps the page; only a first load that gets NO
     answer at all shows the error. */
  const pageLoad = usePageLoad();

  useEffect(() => {
    void Promise.allSettled([
      dashboardApi.summary().then((r) => setTodayVisits(r.data.data.quick_stats?.today_visits ?? 0)),
      healthApi.coverageReport().then((r) => setCoverage(r.data.data)),
      healthApi.recordsSummary().then((r) => setRecords(r.data.data)),
    ]).then((results) => settleAll(pageLoad, results));
  }, [tick]);

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => setTick((t) => t + 1)} />;

  return (
    <div>
      <PageHeader
        title="Health Station Dashboard"
        subtitle="Visits, immunization coverage, and maternal care at a glance"
        actions={
          <Link
            to="/health/visits"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" /> Record a visit
          </Link>
        }
      />

      <RevealGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Visits Today" value={todayVisits} icon={FiActivity} />
        <StatTile label="Visits This Year" value={coverage?.total_visits ?? 0} icon={FiHeart} tone="success" />
        <StatTile label="Children Immunized" value={coverage?.total_immunized ?? 0} icon={FiSmile} tone="warning" />
        {/* It showed the pregnancies REGISTERED this year under this name, and
            in red. It is now the ones current today, and a count is not an
            alarm. */}
        <StatTile label="Active Pregnancies" value={records?.active_pregnancies ?? 0} icon={FiUser} />
      </RevealGroup>

      <RevealGroup className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Child Health Records" value={records?.child_records ?? 0} icon={FiSmile}
          hint={`${records?.child_records_this_year ?? 0} this year`} />
        <StatTile label="Maternal Health Records" value={records?.maternal_records ?? 0} icon={FiUser}
          hint={`${records?.maternal_records_this_year ?? 0} this year`} />
        <StatTile label="Current Prenatal Visits" value={records?.current_prenatal_visits ?? 0} icon={FiClipboard}
          hint={`Across ${records?.active_pregnancies ?? 0} current ${records?.active_pregnancies === 1 ? "pregnancy" : "pregnancies"}`} />
        <StatTile label="Prenatal Records This Month" value={records?.prenatal_records_this_month ?? 0} icon={FiCalendar}
          hint={`${records?.prenatal_records_this_year ?? 0} this year`} />
      </RevealGroup>
    </div>
  );
}
