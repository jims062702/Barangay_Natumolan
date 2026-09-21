import { useEffect, useState } from "react";
import { FiAward, FiClipboard, FiFileText } from "react-icons/fi";
import { Link } from "react-router-dom";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { useAuth } from "../../../shared/auth/AuthContext";
import Card from "../../../shared/ui/Card";
import StatTile from "../../../shared/ui/StatTile";
import StatusBadge from "../../../shared/ui/StatusBadge";
import PageHeader from "../../../shared/ui/PageHeader";
import RevealGroup from "../../../shared/ui/RevealGroup";
import type { Resident, ServiceRequest } from "../../../shared/types";
import { portalApi } from "../api";
import MyHearingsCard from "../components/MyHearingsCard";
import type { Announcement } from "../../content/types";

interface PortalHome {
  resident: Resident;
  stats: {
    active_requests: number;
    total_requests: number;
    certificates_ready: number;
  };
  recent_requests: ServiceRequest[];
  announcements: Announcement[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [home, setHome] = useState<PortalHome | null>(null);

  // Live updates: bump `tick` to re-run the fetch below.
  const [tick, setTick] = useState(0);
  useAutoRefresh(() => setTick((t) => t + 1), REFRESH.portal);

  useEffect(() => {
    portalApi.dashboard().then((r) => setHome(r.data.data)).catch(() => undefined);
  }, [tick]);

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? "Resident"}!`}
        subtitle={
          home
            ? `Resident No. ${home.resident?.resident_number} · ${home.resident?.zone_purok ?? ""}`
            : "Your barangay services, online"
        }
      />

      <RevealGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active Requests" value={home?.stats.active_requests ?? 0} icon={FiClipboard} tone="warning" />
        <StatTile label="Total Requests" value={home?.stats.total_requests ?? 0} icon={FiFileText} />
        <StatTile label="Certificates Ready" value={home?.stats.certificates_ready ?? 0} icon={FiAward} tone="danger" />
      </RevealGroup>

      <Card title="Quick actions" className="mt-6">
        <div className="flex flex-wrap gap-3">
          <Link
            to="/resident/requests"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Request a certificate
          </Link>
          {/*
            One action, because there is one thing a resident opens the
            portal to do. Appointments, the service guide and certificate
            verification came off with their menu entries — a row of four
            buttons where three go nowhere the resident wanted is a row
            nobody reads.
          */}
        </div>
      </Card>

      {/*
        The summons, on the front page.

        It is the one thing here a resident can be penalised for missing, and
        it sat two clicks away behind a menu they had no reason to open unless
        they already knew there was something in it.
      */}
      <div className="mt-6">
        <MyHearingsCard />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card
          title="My recent requests"
          action={
            <Link to="/resident/requests" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          }
        >
          {(home?.recent_requests ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No requests yet — start one above.</p>
          ) : (
            <ul className="divide-y divide-gray/70">
              {home?.recent_requests.map((request) => (
                <li key={request.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-dark">{request.service_type}</p>
                    <p className="text-xs text-gray-500">{request.request_number}</p>
                  </div>
                  <StatusBadge status={request.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Latest announcements"
          action={
            <Link to="/resident/announcements" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          }
        >
          {(home?.announcements ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No announcements right now.</p>
          ) : (
            <ul className="divide-y divide-gray/70">
              {home?.announcements.map((announcement) => (
                <li key={announcement.id} className="py-3">
                  <p className="text-sm font-semibold text-dark">{announcement.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{announcement.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
