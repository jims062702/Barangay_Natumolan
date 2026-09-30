import { useEffect, useState, type FormEvent } from "react";
import { useModalDraft } from "../../../../shared/lib/useModalDraft";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import BpoFields, { bpoPayload, emptyBpo, type BpoDraft } from "../BpoFields";
import { BPO_DAYS, formatDay, manilaToday } from "../../lib/caseOptions";
import { vawcApi } from "../../api";
import type { VawcProtectionOrder } from "../../types";
import { saveToCase, SubmitButton, type CaseModal } from "./parts";

const draftFrom = (order: VawcProtectionOrder): BpoDraft => ({
  status: order.status,
  applied_on: order.applied_on ?? "",
  issued_on: order.issued_on ?? "",
  issued_by: order.issued_by ?? "",
  issued_by_name: order.issued_by_name ?? "",
  notes: order.notes ?? "",
});

/**
 * Apply for a BPO, move one along, or renew one.
 *
 * A renewal is a NEW order — its own fifteen days, its own issuing official
 * — pointing at the one it renews, so the history reads as one chain.
 */
export function ProtectionOrderModal({ caseId, modal, onClose, onSaved }: {
  caseId: number;
  modal: CaseModal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const bpo = modal?.kind === "bpo" ? modal : null;
  const [draft, setDraft] = useState<BpoDraft>(emptyBpo);
  const [saving, setSaving] = useState(false);

  /* Each opening starts from what it is about, never from the last one. */
  useEffect(() => {
    if (!bpo) return;
    if (bpo.mode === "edit") setDraft(draftFrom(bpo.order));
    else if (bpo.mode === "renew") setDraft({ ...emptyBpo("Issued"), issued_on: manilaToday() });
    else setDraft(emptyBpo("Applied"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal]);

  /* Tab memory only — a VAWC record is never written to the device. One
     draft per kind of opening: a new application, an order's update, an
     order's renewal. An update's version is the order as it was opened. */
  const startingBpo: BpoDraft | null = !bpo ? null
    : bpo.mode === "edit" ? draftFrom(bpo.order)
      : bpo.mode === "renew" ? { ...emptyBpo("Issued"), issued_on: manilaToday() }
        : emptyBpo("Applied");
  const kept = useModalDraft<BpoDraft>(
    !bpo ? null : bpo.mode === "new" ? `vawc-bpo-new:${caseId}` : `vawc-bpo-${bpo.mode}:${bpo.order.id}`,
    bpo !== null,
    draft,
    (value) => setDraft({ ...(startingBpo ?? emptyBpo()), ...value }),
    {
      memoryOnly: true,
      blank: startingBpo ?? undefined,
      reset: () => startingBpo && setDraft(startingBpo),
      version: bpo?.mode === "edit" ? JSON.stringify(draftFrom(bpo.order)) : null,
    },
  );

  if (!bpo) return null;

  const title = bpo.mode === "edit"
    ? "Update Barangay Protection Order"
    : bpo.mode === "renew"
      ? "Renew Barangay Protection Order"
      : "Apply for Barangay Protection Order (BPO)";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const payload = bpoPayload(draft);
    await saveToCase(
      () => bpo.mode === "edit"
        ? vawcApi.updateProtectionOrder(caseId, bpo.order.id, payload)
        : vawcApi.recordProtectionOrder(caseId, {
            ...payload,
            renewal_of_id: bpo.mode === "renew" ? bpo.order.id : undefined,
          }),
      () => { kept.clear(); onClose(); onSaved(); },
      "Protection order saved.",
      bpo.mode === "renew" ? "Record this renewal?" : "Save this protection order?",
    );
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={title} size="wide">
      <form onSubmit={submit} className="space-y-4">
        {bpo.mode === "renew" && (
          <p className="rounded-xl bg-primary/5 px-4 py-3 text-sm text-dark">
            Renews the BPO issued {formatDay(bpo.order.issued_on)}
            {bpo.order.expires_on ? `, in effect until ${formatDay(bpo.order.expires_on)}` : ""}.
            The renewal is its own BPO with its own {BPO_DAYS} days.
          </p>
        )}
        <BpoFields
          value={draft}
          onChange={setDraft}
          issuedAfter={bpo.mode === "renew" ? bpo.order.issued_on : null}
        />
        <DraftNotice draft={kept} tabOnly />
        <SubmitButton disabled={saving}>
          {saving ? "Saving…" : bpo.mode === "renew" ? "Record renewal" : "Save protection order"}
        </SubmitButton>
      </form>
    </Modal>
  );
}
