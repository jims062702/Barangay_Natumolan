import { FiHome, FiTrendingUp, FiUser, FiUserCheck, FiUserPlus, FiUsers } from "react-icons/fi";
import { Link } from "react-router-dom";
import StatTile from "../../../shared/ui/StatTile";
import PageHeader from "../../../shared/ui/PageHeader";
import { PageLoading } from "../../../shared/ui/PageLoad";
import RevealGroup from "../../../shared/ui/RevealGroup";
import { usePopulationDashboard } from "../hooks/usePopulationDashboard";
import { AgeSexEvents } from "./population/AgeSexEvents";
import { RegisterGrowth } from "./population/RegisterGrowth";
import { PurokAndDependency } from "./population/PurokAndDependency";
import { SectorsAndHouseholds } from "./population/SectorsAndHouseholds";

/** "45 with no sex recorded" — the residents in the total and in neither column. */
const notRecorded = (count: number | undefined, what: string) =>
  count ? `${count.toLocaleString()} with no ${what} recorded` : undefined;

export default function PopulationOfficeDashboard() {
  const ctx = usePopulationDashboard();
  const {
    analytics, pageLoad, setTick,
  } = ctx;

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => setTick((t) => t + 1)} />;

  const head = analytics?.headcount;

  return (
    <div>
      <PageHeader
        title="Population Office Dashboard"
        subtitle="Demographics, households, migration, and portal account issuance"
        actions={
          <Link
            to="/population/accounts/not-activated"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiUserPlus className="h-4 w-4" aria-hidden="true" /> Portal accounts
          </Link>
        }
      />

      <RevealGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total Population" value={analytics?.total_population ?? 0} icon={FiUsers} />
        <StatTile label="Households" value={analytics?.total_households ?? 0} icon={FiHome} tone="success" />
        <StatTile label="Avg. Household Size" value={analytics?.average_household_size ?? 0} icon={FiTrendingUp} tone="warning" />
        <StatTile label="Portal Accounts" value={analytics?.portal_accounts ?? 0} icon={FiUserPlus} tone="danger" />
      </RevealGroup>

      {/*
        The four figures every barangay report asks for — male and female,
        adults and minors. Somebody the register has no sex or birthdate for
        is in the total and in neither column, and the tile says how many,
        so each pair adds back up to the population.
      */}
      <RevealGroup className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="No. of Male"
          value={head?.male ?? 0}
          icon={FiUser}
          hint={notRecorded(head?.sex_not_recorded, "sex")}
        />
        <StatTile
          label="No. of Female"
          value={head?.female ?? 0}
          icon={FiUser}
          tone="danger"
          hint={notRecorded(head?.sex_not_recorded, "sex")}
        />
        <StatTile
          label="No. of Adults (18 yrs & above)"
          value={head?.adults ?? 0}
          icon={FiUserCheck}
          tone="success"
          hint={notRecorded(head?.age_not_recorded, "birthdate")}
        />
        <StatTile
          label="No. of Minors (17 yrs & below)"
          value={head?.minors ?? 0}
          icon={FiUsers}
          tone="warning"
          hint={notRecorded(head?.age_not_recorded, "birthdate")}
        />
      </RevealGroup>

      {/* ---------- Age, and who the barangay is ---------- */}
      <AgeSexEvents ctx={ctx} />

      {/* ---------- The year, and the line it draws ---------- */}
      <RegisterGrowth ctx={ctx} />

      {/* ---------- Where they live, and who carries whom ---------- */}
      <PurokAndDependency ctx={ctx} />

      {/* ---------- Sectoral counts & intervention shortlist ---------- */}
      <SectorsAndHouseholds ctx={ctx} />
    </div>
  );
}

