import { useEffect, useState } from "react";
import { FiBell, FiSettings, FiUserPlus, FiUsers } from "react-icons/fi";
import { Link } from "react-router-dom";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { PageLoading, settleAll, usePageLoad } from "../../../shared/ui/PageLoad";
import Card from "../../../shared/ui/Card";
import StatTile from "../../../shared/ui/StatTile";
import PageHeader from "../../../shared/ui/PageHeader";
import RevealGroup from "../../../shared/ui/RevealGroup";
import type { User } from "../../../shared/types";
import { adminApi } from "../../admin/api";
import { populationApi } from "../../population/api";

export default function AdminDashboard() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [portalAccounts, setPortalAccounts] = useState(0);

  // Live updates: bump `tick` to re-run the fetches below.
  const [tick, setTick] = useState(0);
  useAutoRefresh(() => setTick((t) => t + 1), REFRESH.dashboard);

  /* And within a second when somebody else touches one. */
  usePulse("users", () => setTick((t) => t + 1));

  /* Its skeleton until the first answer, then the page — see PageLoad. A
     refresh after that keeps the page; only a first load that gets NO
     answer at all shows the error. */
  const pageLoad = usePageLoad();

  useEffect(() => {
    void Promise.allSettled([
      adminApi.users().then((r) => {
        setTotalUsers(r.data.data.total ?? 0);
        setUsers(r.data.data.data ?? []);
      }),
      populationApi.accounts().then((r) => setPortalAccounts(r.data.data.total ?? 0)),
    ]).then((results) => settleAll(pageLoad, results));
  }, [tick]);

  const staffCount = users.filter((u) => u.role !== "Resident").length;
  const inactive = users.filter((u) => u.is_active === false).length;

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => setTick((t) => t + 1)} />;

  return (
    <div>
      <PageHeader
        title="System Administration"
        subtitle="Accounts, content, and system configuration"
        actions={
          <Link
            to="/admin/users"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiUsers className="h-4 w-4" aria-hidden="true" /> Manage users
          </Link>
        }
      />

      <RevealGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total Accounts" value={totalUsers} icon={FiUsers} />
        <StatTile label="Staff Accounts (page)" value={staffCount} icon={FiSettings} tone="success" />
        <StatTile label="Resident Portal Accounts" value={portalAccounts} icon={FiUserPlus} tone="warning" />
        <StatTile label="Deactivated (page)" value={inactive} icon={FiBell} tone="danger" />
      </RevealGroup>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Administration shortcuts">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { to: "/admin/users", label: "User Accounts", icon: FiSettings },
              { to: "/population/accounts/not-activated", label: "Portal Accounts", icon: FiUserPlus },
              { to: "/manage/announcements", label: "Announcements", icon: FiBell },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-xl border border-gray px-4 py-3 text-sm font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
              >
                <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </div>
        </Card>

        <Card title="Access-control reminders">
          <ul className="list-inside list-disc space-y-2 text-sm text-gray-600">
            <li>VAWC case content is restricted to the VAWC office — even administrators cannot read it.</li>
            <li>Health records are visible to Health Station personnel only.</li>
            <li>Resident portal accounts are created by the Population Office after residency verification.</li>
            <li>General reports expose aggregated, anonymized figures only.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
