import Card from "../../../../shared/ui/Card";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import type { Resident } from "../../../../shared/types";

/**
 * What this resident has asked the barangay for, and been issued.
 */
export function ServiceHistory({ resident }: { resident: Resident }) {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card title="Service request history">
        {(resident.service_requests ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">No requests on record.</p>
        ) : (
          <ul className="divide-y divide-gray/70">
            {resident.service_requests?.map((request) => (
              <li key={request.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-dark">{request.service_type}</p>
                  <p className="text-xs text-gray-500">{request.request_number}</p>
                </div>
                <StatusBadge status={request.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Certificates issued">
        {(resident.certificates ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">No certificates on record.</p>
        ) : (
          <ul className="divide-y divide-gray/70">
            {resident.certificates?.map((certificate) => (
              <li key={certificate.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-dark">{certificate.certificate_type}</p>
                  <p className="font-mono text-xs text-gray-500">{certificate.reference_number}</p>
                </div>
                <StatusBadge status={certificate.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
