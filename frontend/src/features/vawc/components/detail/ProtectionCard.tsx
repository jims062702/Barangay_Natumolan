import { FiAlertTriangle, FiShield } from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import { RiskBadge } from "../RiskBadge";
import { BPO_DAYS, BPO_OPEN_STATUSES, formatDay } from "../../lib/caseOptions";
import type { VawcCase, VawcProtectionOrder } from "../../types";
import { CardButton, DetailRows, type CaseModal } from "./parts";

/** Issued orders nobody has renewed yet — the ones a renewal can follow. */
export function renewable(orders: VawcProtectionOrder[]): VawcProtectionOrder | undefined {
  const renewed = new Set(orders.map((o) => o.renewal_of_id).filter(Boolean));

  /* Newest first, as the server sends them. */
  return orders.find((o) => o.status === "Issued" && !renewed.has(o.id));
}

/** The application the desk is still working on, if there is one. */
export const openApplication = (orders: VawcProtectionOrder[]) =>
  orders.find((o) => BPO_OPEN_STATUSES.includes(o.status));

/** The order in effect today, if there is one. */
export const orderInEffect = (orders: VawcProtectionOrder[]) => orders.find((o) => o.in_effect);

/**
 * What "Apply for BPO" should open, given what the case already holds.
 *
 * An application in progress is updated, not started twice; an order in
 * effect is renewed, not applied for again — the same rules the server
 * enforces, so the button never opens a form that is bound to be refused.
 */
export function bpoActionFor(orders: VawcProtectionOrder[]): CaseModal {
  const open = openApplication(orders);
  if (open) return { kind: "bpo", mode: "edit", order: open };

  const current = orderInEffect(orders);
  if (current) return { kind: "bpo", mode: "renew", order: current };

  return { kind: "bpo", mode: "new" };
}

/**
 * The immediate safety assessment and the Barangay Protection Order.
 *
 * Its own card, near the top: protection is the desk's first job, and it
 * never waits on a referral or on any dialogue between the parties.
 */
export function ProtectionCard({ caseData, open, active }: {
  caseData: VawcCase;
  open: (modal: CaseModal) => void;
  active: boolean;
}) {
  const orders = caseData.protection_orders ?? [];
  const current = orderInEffect(orders);
  const pending = openApplication(orders);
  const next = renewable(orders);
  const latestIssued = orders.find((o) => o.status === "Issued");

  return (
    <Card
      title="Safety & protection order"
      action={active && <CardButton onClick={() => open(bpoActionFor(orders))}>Apply for BPO</CardButton>}
    >
      <DetailRows
        rows={[
          ["Currently in danger", caseData.currently_in_danger ?? "Not assessed"],
          ["Immediate protection needed", caseData.protection_needed ?? "Not assessed"],
          ["Risk level", <RiskBadge key="risk" level={caseData.risk_level} />],
        ]}
      />
      {active && (
        <button
          type="button"
          onClick={() => open({ kind: "safety" })}
          className="mt-2 cursor-pointer text-xs font-semibold text-primary hover:underline"
        >
          Update safety assessment
        </button>
      )}

      <div className="mt-4">
        {current ? (
          <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-dark">
              <FiShield className="h-4 w-4 text-success" aria-hidden="true" />
              BPO in effect — {current.days_left} {current.days_left === 1 ? "day" : "days"} left
            </p>
            <p className="mt-1 text-xs text-gray-600">
              Day {BPO_DAYS - (current.days_left ?? 0) + 1} of {BPO_DAYS}: {formatDay(current.issued_on, "medium")} to{" "}
              <strong>{formatDay(current.expires_on, "medium")}</strong>
              {current.issued_by_name ? ` · issued by ${current.issued_by_name}` : ""}
            </p>
          </div>
        ) : pending ? (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
            <p className="font-semibold text-dark">BPO: {pending.status}</p>
            <p className="mt-1 text-xs text-gray-600">
              {pending.applied_on ? `Applied ${formatDay(pending.applied_on, "medium")}. ` : ""}
              Update it once the Punong Barangay or a Kagawad acts on it.
            </p>
          </div>
        ) : caseData.protection_needed === "Yes" && orders.length === 0 ? (
          <div className="flex gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-dark">
            <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
            <p>Immediate protection was marked needed, and no BPO has been recorded yet.</p>
          </div>
        ) : latestIssued && !latestIssued.in_effect ? (
          <p className="rounded-xl bg-secondary p-3 text-sm text-gray-600">
            The last BPO ended on {formatDay(latestIssued.expires_on, "medium")}. It can be renewed.
          </p>
        ) : (
          <p className="rounded-xl bg-secondary p-3 text-sm text-gray-500">No protection order on this case.</p>
        )}
      </div>

      {orders.length > 0 && (
        <ul className="mt-4 divide-y divide-gray/70">
          {orders.map((order) => (
            <li key={order.id} className="py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-dark">
                  {order.renewal_of_id ? "Renewal" : "BPO"}
                  {order.issued_on ? ` · ${formatDay(order.issued_on, "medium")}` : ""}
                </span>
                <StatusBadge status={order.in_effect ? "In effect" : order.status === "Issued" ? "Expired" : order.status} />
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {order.status === "Issued"
                  ? `Until ${formatDay(order.expires_on, "medium")} · ${order.issued_by ?? ""}${order.issued_by_name ? ` — ${order.issued_by_name}` : ""}`
                  : order.applied_on
                    ? `Applied ${formatDay(order.applied_on, "medium")}`
                    : "Not yet applied for"}
              </p>
              {order.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">{order.notes}</p>}
              {active && (
                <div className="mt-1 flex gap-3">
                  <CardButton onClick={() => open({ kind: "bpo", mode: "edit", order })}>
                    <span className="text-xs">Update</span>
                  </CardButton>
                  {next?.id === order.id && !pending && (
                    <CardButton onClick={() => open({ kind: "bpo", mode: "renew", order })}>
                      <span className="text-xs">Renew</span>
                    </CardButton>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
