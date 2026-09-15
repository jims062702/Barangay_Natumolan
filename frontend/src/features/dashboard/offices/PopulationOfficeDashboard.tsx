import { FiHome, FiTrendingUp, FiUserPlus, FiUsers } from "react-icons/fi";
import { Link } from "react-router-dom";
import StatTile from "../../../shared/ui/StatTile";
import PageHeader from "../../../shared/ui/PageHeader";
import { DashboardSkeleton } from "../../../shared/ui/Skeleton";
import RevealGroup from "../../../shared/ui/RevealGroup";
import { usePopulationDashboard } from "../hooks/usePopulationDashboard";
import { AgeSexEvents } from "./population/AgeSexEvents";
import { RegisterGrowth } from "./population/RegisterGrowth";
import { PurokAndDependency } from "./population/PurokAndDependency";
import { SectorsAndHouseholds } from "./population/SectorsAndHouseholds";

export default function PopulationOfficeDashboard() {
  const ctx = usePopulationDashboard();
  const {
    analytics, firstLoad,
  } = ctx;

  return (
    <div>
      <PageHeader
        title="Population Office Dashboard"
        subtitle="Demographics, households, migration, and portal account issuance"
        actions={
          <Link
            to="/population/accounts"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiUserPlus className="h-4 w-4" aria-hidden="true" /> Portal accounts
          </Link>
        }
      />

      {firstLoad ? (
        <DashboardSkeleton />
      ) : (
        <>
          <RevealGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Total Population" value={analytics?.total_population ?? 0} icon={FiUsers} />
            <StatTile label="Households" value={analytics?.total_households ?? 0} icon={FiHome} tone="success" />
            <StatTile label="Avg. Household Size" value={analytics?.average_household_size ?? 0} icon={FiTrendingUp} tone="warning" />
            <StatTile label="Portal Accounts" value={analytics?.portal_accounts ?? 0} icon={FiUserPlus} tone="danger" />
          </RevealGroup>

          {/* ---------- Age, and who the barangay is ---------- */}
          <AgeSexEvents ctx={ctx} />

          {/* ---------- The year, and the line it draws ---------- */}
          <RegisterGrowth ctx={ctx} />

          {/* ---------- Where they live, and who carries whom ---------- */}
          <PurokAndDependency ctx={ctx} />

          {/* ---------- Sectoral counts & intervention shortlist ---------- */}
          <SectorsAndHouseholds ctx={ctx} />
        </>
      )}
    </div>
  );
}

