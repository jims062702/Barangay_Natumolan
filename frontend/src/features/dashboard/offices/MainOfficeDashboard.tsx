import { FiAward, FiCheckCircle, FiClock } from "react-icons/fi";
import { Link } from "react-router-dom";
import { PageLoading } from "../../../shared/ui/PageLoad";
import Card from "../../../shared/ui/Card";
import StatTile from "../../../shared/ui/StatTile";
import StatusBadge from "../../../shared/ui/StatusBadge";
import PageHeader from "../../../shared/ui/PageHeader";
import DataTable from "../../../shared/ui/DataTable";
import { asOf } from "../../../shared/offline/lastSeen";
import { useFrontDeskDashboard, type RecentCertificate } from "../hooks/useFrontDeskDashboard";
import { ExecutiveView } from "./mainOffice/ExecutiveView";
import { RequestedServicesCard } from "./mainOffice/RequestedServicesCard";
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
    stats, recent, pageLoad, firstLoad, countedAt, requested,
  } = ctx;

  if (executive) {
    return (
      <ExecutiveView ctx={ctx} />
    );
  }

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={firstLoad} />;

  return (
    <div>
      <PageHeader
        title="Main Office Dashboard"
        subtitle="Today's queue and pending work for the Main Barangay Office"
      />

      {/* The two certificate tiles are the clerk's own worklist: requests
          nobody has started, and signed documents waiting to be collected. */}
      {/*
        THREE TILES, and each is a different question.

        It was five, two of which counted service requests — and a request
        raises its certificate the moment it is made, so both were "work
        waiting" under an earlier name. A fourth counted Lupon fees waiting
        at this counter; the Lupon confirms those itself now, so the Clerk
        has none to wait on.

        Four columns, not five: at five "Certificates This Month" came out as
        "CERTIFICATES THIS MON…", and a label that cannot finish is a label
        that has to be guessed.
      */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/*
          Short labels, because the tile truncates rather than wraps.
          "Certificates this month" came out "CERTIFICATES THIS MONT…", and a
          label that cannot finish is a label that has to be guessed — the
          hint underneath carries the rest of the sentence.
        */}
        <StatTile label="To start" value={stats.pending_certificates ?? 0} icon={FiClock} tone="danger" hint="Filed, not begun" />
        <StatTile label="Ready to claim" value={stats.ready_to_claim ?? 0} icon={FiCheckCircle} tone="success" hint="Not yet collected" />
        <StatTile label="This month" value={stats.monthly_certificates ?? 0} icon={FiAward} hint="Certificates issued" />
      </div>

      {/* Said once, under the tiles, rather than five times inside them. */}
      {countedAt !== null && (
        <p className="mt-2 text-xs text-gray-500">
          These counts are the last the office could see — {asOf(countedAt)}. They will
          catch up on their own when the connection is back.
        </p>
      )}

      {/*
        Two columns: the day's work on the left, the year's shape on the
        right. The clerk issues these documents all day and had no way to
        see which ones lead — that figure existed only on the Punong
        Barangay's dashboard.
      */}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/*
          CERTIFICATES, not service requests.

          A request for a certificate raises the certificate the moment it is
          made, so the request list was the same work under an earlier name —
          and the queue it linked to came off this menu. What a clerk wants on
          opening the day is the last few documents and who they are for.
        */}
        <Card
          title="Recent certificate requests"
          action={
            <Link to="/certificates" className="text-sm font-medium text-primary hover:underline">
              Open certificates
            </Link>
          }
        >
          {/*
            Three columns, not five.

            This card is half the page wide. With a number, a type, a name, a
            status and a row counter each in its own column the table ran off
            the card: "CERT-2026-01-000015" broke over three lines, "Barangay
            Clearance with Picture" over four, and the STATUS column — the one
            thing a clerk scans this list for — sat off the right edge behind
            a scrollbar. The counter was dropped outright (the rows are
            already in order, so it said nothing), and the number and type
            share a cell: they name the same document, and stacked they take
            two short lines instead of seven wrapped ones.
          */}
          <DataTable
            columns={[
              {
                header: "Certificate",
                render: (c: RecentCertificate) => (
                  <div className="leading-tight">
                    <span className="whitespace-nowrap font-medium text-dark">
                      {c.certificate_number}
                    </span>
                    <span className="block text-xs text-gray-500">{c.certificate_type}</span>
                  </div>
                ),
              },
              {
                header: "For",
                render: (c: RecentCertificate) => (
                  <span className="text-gray-600">{c.resident ?? "—"}</span>
                ),
              },
              { header: "Status", render: (c: RecentCertificate) => <StatusBadge status={c.status} /> },
            ]}
            rows={recent}
            rowKey={(c) => c.id}
            emptyMessage="No certificates yet."
          />
        </Card>

        <RequestedServicesCard rows={requested} />
      </div>

    </div>
  );
}

