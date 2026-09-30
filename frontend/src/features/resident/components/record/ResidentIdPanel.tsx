import { useEffect, useState } from "react";
import { FiCreditCard, FiRefreshCw } from "react-icons/fi";
import { errorMessage } from "../../../../shared/lib/api";
import { confirmAction, confirmWithReason } from "../../../../shared/lib/confirm";
import { toast } from "../../../../shared/lib/toast";
import Card from "../../../../shared/ui/Card";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import { ResidentCardView } from "../../../../shared/residentCard/ResidentCardView";
import type { ResidentCardData } from "../../../../shared/residentCard/drawCard";
import { residentApi } from "../../api";

interface HistoryRow {
  card_no: string | null;
  status: string;
  action: string;
  issued_at: string | null;
  issued_via: string;
  issued_by: string | null;
  replaces: string | null;
  reason: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
}

interface CardState {
  eligible: boolean;
  card: ResidentCardData | null;
  issued_count: number;
  history: HistoryRow[];
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—");

/**
 * The Population Office's Resident ID for one resident — kept on the record
 * as the fallback to issuing from a census form or a household.
 *
 * ISSUE gives a first card only; somebody who holds one is shown it (the
 * server refuses a second active card). ISSUE A NEW CARD replaces theirs —
 * the old one stops verifying at once and stays in the history below, with
 * who issued and revoked each card and why.
 */
export function ResidentIdPanel({ residentId, name }: { residentId: number | string; name: string }) {
  const [state, setState] = useState<CardState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    residentApi.residentCard(residentId)
      .then((r) => setState(r.data.data as CardState))
      .catch((err) => toast(errorMessage(err), "error"));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [residentId]);

  const issue = async () => {
    if (!(await confirmAction({
      title: "Issue Resident ID?",
      text: `This will issue a Barangay Resident Identification Card for ${name}. Continue?`,
      confirmText: "Issue ID",
    }))) return;

    setBusy(true);
    try {
      const r = await residentApi.issueResidentCard(residentId);
      toast(r.data.message);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
      load();
    }
  };

  const reissue = async () => {
    const reason = await confirmWithReason({
      title: "Issue a new card?",
      text: `${name}'s current card will stop working the moment the new one is issued. Its record stays in the history.`,
      placeholder: "Why? e.g. lost, damaged, details changed (optional)",
      confirmText: "Issue a new card",
      optional: true,
    });
    if (reason === null) return;

    setBusy(true);
    try {
      const r = await residentApi.reissueResidentCard(residentId, { reason: reason || undefined });
      toast(r.data.message);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
      load();
    }
  };

  if (!state || !state.eligible) return null;

  return (
    <Card title="Barangay Resident ID" className="mt-6">
      {state.card ? (
        <>
          <div className="-mt-2 mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              Card <span className="font-mono font-semibold text-dark">{state.card.card_no}</span>, issued{" "}
              {state.card.issued_at ? new Date(state.card.issued_at).toLocaleDateString("en-PH", { dateStyle: "medium" }) : ""}
              {" "}through the {state.card.issued_via}. Verification code <span className="font-mono font-semibold text-dark">{state.card.code}</span>.
            </p>
            <button
              type="button"
              onClick={reissue}
              disabled={busy}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray px-4 py-2 text-xs font-semibold text-dark transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              <FiRefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Issue a New Card
            </button>
          </div>
          <ResidentCardView
            card={state.card}
            note="Printed from the register as it stands. Paste a 1×1 photo over the photo box before laminating."
          />
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-secondary/60 px-4 py-5">
          <p className="text-sm text-gray-600">No active Resident ID. {state.issued_count > 0 && "Earlier cards are listed below."}</p>
          <button
            type="button"
            onClick={issue}
            disabled={busy}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            <FiCreditCard className="h-4 w-4" aria-hidden="true" /> {busy ? "Issuing…" : "Issue Resident ID"}
          </button>
        </div>
      )}

      {state.history.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Issuance history</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs" data-testid="card-history">
              <thead className="text-gray-500">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Card No.</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                  <th className="px-2 py-1.5 font-medium">Issued</th>
                  <th className="px-2 py-1.5 font-medium">By</th>
                  <th className="px-2 py-1.5 font-medium">Replaces</th>
                  <th className="px-2 py-1.5 font-medium">Ended</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray">
                {state.history.map((h) => (
                  <tr key={h.card_no ?? h.issued_at ?? ""}>
                    <td className="px-2 py-2 font-mono font-semibold text-dark">{h.card_no ?? "—"}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={h.status === "Active" ? "Active" : "Revoked"} />
                      <span className="ml-1 text-gray-500">{h.action}</span>
                    </td>
                    <td className="px-2 py-2 text-gray-600">{when(h.issued_at)} · {h.issued_via}</td>
                    <td className="px-2 py-2 text-gray-600">{h.issued_by ?? (h.issued_via === "Portal" ? "The resident" : "—")}</td>
                    <td className="px-2 py-2 text-gray-600">{h.replaces ?? "—"}{h.reason ? ` — ${h.reason}` : ""}</td>
                    <td className="px-2 py-2 text-gray-600">
                      {h.revoked_at ? `${when(h.revoked_at)}${h.revoked_by ? ` by ${h.revoked_by}` : ""}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
