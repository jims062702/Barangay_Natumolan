import { FiBookOpen } from "react-icons/fi";
import PageHeader from "../../../../shared/ui/PageHeader";
import { DashboardBodySkeleton } from "../../../../shared/ui/Skeleton";
import StatTile from "../../../../shared/ui/StatTile";
import Card from "../../../../shared/ui/Card";
import { asDate } from "./format";
import { RequestedServicesCard } from "./RequestedServicesCard";
import type { FrontDeskDashboardState } from "../../hooks/useFrontDeskDashboard";

/**
 * The Punong Barangay's view: the whole barangay at a glance.
 */
export function ExecutiveView({ ctx }: { ctx: FrontDeskDashboardState }) {
  const { ready, exec, kpCounts, requested } = ctx;

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        subtitle="The sittings you preside over, and what the barangay is being asked for"
      />

      {!ready ? (
        <DashboardBodySkeleton tiles={6} tileColumns={3} cards={2} cardColumns={2} />
      ) : (
      <>
      {/*
        Two tiles, not five.
        The counter's certificate figures and the documents awaiting a
        signature came off: they are the Clerk's and the Secretary's work,
        and a dashboard that counts somebody else's backlog invites the PB
        to do somebody else's job. What is left is what the PB presides over.
      */}
      {/*
        One tile. Appointments came off every menu that had them, so a count
        of them on the PB's dashboard pointed at a page that is gone. What is
        left is the thing the PB presides over.
      */}
      <div className="grid gap-4">
        <StatTile label="KP Hearings / Deadlines" value={kpCounts.hearings + kpCounts.repudiation} icon={FiBookOpen} tone="warning" />
      </div>

      {/* What residents actually come in for. */}
      <div className="mt-6">
        <RequestedServicesCard rows={requested} />
      </div>

      {/* What the barangay has told everybody. */}
      <div className="mt-6">
        <Card title="Latest announcements">
          {(exec?.announcements ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Nothing published yet.</p>
          ) : (
            <ul className="divide-y divide-gray/70">
              {exec?.announcements.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <p className="min-w-0 truncate text-sm text-dark">{a.title}</p>
                  <span className="shrink-0 text-xs text-gray-400">{asDate(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      </>
    )}
    </div>
  );
}
