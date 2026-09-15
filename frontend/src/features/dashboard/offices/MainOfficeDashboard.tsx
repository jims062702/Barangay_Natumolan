import { FiAward, FiCheckCircle, FiClipboard, FiClock } from "react-icons/fi";
import { Link } from "react-router-dom";
import { DashboardBodySkeleton } from "../../../shared/ui/Skeleton";
import Card from "../../../shared/ui/Card";
import StatTile from "../../../shared/ui/StatTile";
import StatusBadge from "../../../shared/ui/StatusBadge";
import PageHeader from "../../../shared/ui/PageHeader";
import DataTable from "../../../shared/ui/DataTable";
import type { ServiceRequest } from "../../../shared/types";
import { useFrontDeskDashboard } from "../hooks/useFrontDeskDashboard";
import { ExecutiveView } from "./mainOffice/ExecutiveView";
import type { MainOfficeDashboardProps } from "./mainOffice/types";

/**
 * Main Office dashboard.
 * `executive` = the Punong Barangay view: appointments, KP cases, and what
 * the counter has produced (requests, the queue and the certificate workflow
 * itself are the clerk's work). Certificates are neither approved nor signed
 * off in the system, so nothing here acts on one — the PB signs paper.
 */
export default function MainOfficeDashboard({ executive = false }: MainOfficeDashboardProps) {
  const ctx = useFrontDeskDashboard({ executive });
  const {
    stats, recent, ready,
  } = ctx;

  if (executive) {
    return (
      <ExecutiveView ctx={ctx} />
    );
  }

  return (
    <div>
      <PageHeader
        title="Main Office Dashboard"
        subtitle="Today's queue and pending work for the Main Barangay Office"
      />

      {/* The two certificate tiles are the clerk's own worklist: requests
          nobody has started, and signed documents waiting to be collected. */}
      {!ready ? (
        <DashboardBodySkeleton tiles={5} tileColumns={5} cards={1} cardColumns={1} />
      ) : (
      <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Pending Requests" value={stats.pending_requests ?? 0} icon={FiClipboard} tone="warning" />
        <StatTile label="Certificates To Start" value={stats.pending_certificates ?? 0} icon={FiClock} tone="danger" />
        <StatTile label="Ready To Claim" value={stats.ready_to_claim ?? 0} icon={FiCheckCircle} tone="success" />
        <StatTile label="Certificates This Month" value={stats.monthly_certificates ?? 0} icon={FiAward} />
        <StatTile label="Unassigned Requests" value={stats.unassigned_requests ?? 0} icon={FiClipboard} />
      </div>

      <div className="mt-6">
        <Card
          title="Recent service requests"
          action={
            <Link to="/services" className="text-sm font-medium text-primary hover:underline">
              Open queue
            </Link>
          }
        >
          <DataTable
            columns={[
              { header: "Request #", render: (r: ServiceRequest) => <span className="font-medium text-dark">{r.request_number}</span> },
              { header: "Service", render: (r: ServiceRequest) => r.service_type },
              { header: "Status", render: (r: ServiceRequest) => <StatusBadge status={r.status} /> },
            ]}
            rows={recent}
            rowKey={(r) => r.id}
            numbered
            emptyMessage="No recent requests."
          />
        </Card>
      </div>
      </>
      )}
    </div>
  );
}

