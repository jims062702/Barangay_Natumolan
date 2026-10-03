import { FiPlus, FiTrash2 } from "react-icons/fi";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import ChoiceWithOther from "../../../../shared/ui/ChoiceWithOther";
import { peso } from "../../lib/money";
import { MAX_IN_TRANSACTION, type PortalRequestsState, type RequestItem } from "../../hooks/usePortalRequests";
import { DeathCertificatePortalFields } from "./DeathCertificatePortalFields";

/**
 * Asking the barangay for certificates from home — one, or several at once.
 *
 * Several are sent as ONE request: the office sees them together and the
 * resident collects them in one visit, instead of asking (and queueing)
 * once for each.
 */
export function NewRequestModal({ ctx }: { ctx: PortalRequestsState }) {
  const {
    createOpen, setCreateOpen, submit, items, addItem, grandTotal, quoteTotal, saving, requestDraft,
  } = ctx;

  return (
    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Request certificates" size="wide">
      <form onSubmit={submit} className="space-y-4">
        {items.map((item, index) => (
          <RequestedCertificate key={item.key} ctx={ctx} item={item} index={index} />
        ))}

        {items.length < MAX_IN_TRANSACTION && (
          <button
            type="button"
            onClick={addItem}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-primary/50 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" /> Add another certificate
          </button>
        )}

        {items.length > 1 && (
          <div className="rounded-xl bg-primary/[0.06] px-4 py-3" data-testid="request-summary">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {items.length} certificates in this request
            </p>
            <ul className="space-y-0.5 text-sm text-dark">
              {items.map((item) => {
                const total = quoteTotal(item);

                return (
                  <li key={item.key} className="flex justify-between gap-3">
                    <span className="min-w-0">{item.serviceType}</span>
                    <span className="tabular-nums">{total !== null ? peso(total) : "—"}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 flex justify-between border-t border-primary/20 pt-2 text-sm font-bold text-dark">
              <span>Amount at the counter</span>
              <span className="tabular-nums" data-testid="request-total">
                {grandTotal !== null ? peso(grandTotal) : "Choose above to see it"}
              </span>
            </p>
          </div>
        )}

        <DraftNotice draft={requestDraft} />

        <button
          type="submit"
          disabled={saving || items.length === 0 || items.some((i) => !i.serviceType)}
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {saving ? "Submitting…" : items.length > 1 ? `Submit request for ${items.length} certificates` : "Submit request"}
        </button>
      </form>
    </Modal>
  );
}

/** One certificate of the request: which, what for, and what it costs. */
function RequestedCertificate({ ctx, item, index }: { ctx: PortalRequestsState; item: RequestItem; index: number }) {
  const { items, services, serviceOf, quoteFee, quoteTotal, stampOf, patchItem, setItemType, removeItem } = ctx;
  const chosen = serviceOf(item.serviceType);
  const fee = quoteFee(item);
  const total = quoteTotal(item);
  const stamp = stampOf(item);
  const several = items.length > 1;

  return (
    <fieldset className={several ? "space-y-4 rounded-2xl border border-gray p-4" : "space-y-4"} data-testid="requested-certificate">
      {several && (
        <legend className="flex items-center gap-3 px-1">
          <span className="text-sm font-semibold text-dark">Certificate {index + 1}</span>
          <button
            type="button"
            onClick={() => removeItem(item.key)}
            aria-label={`Remove certificate ${index + 1}`}
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-gray-400 hover:text-danger"
          >
            <FiTrash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
          </button>
        </legend>
      )}

      <FormField label="Which certificate?" required>
          <select
            value={item.serviceType}
            onChange={(e) => setItemType(item.key, e.target.value)}
            className={inputClasses}
          >
            {services.map((s) => (
              <option key={s.certificate_type} value={s.certificate_type}>
                {s.certificate_type} — {peso(s.fee)}
              </option>
            ))}
          </select>
      </FormField>

      {/*
        The fee and the papers, before the walk.

        A resident used to pick a name from a list, walk to the office,
        and find out at the counter that they needed a valid ID and ₱50.
        For somebody who walked half an hour to get there, that is the
        whole morning gone.
      */}
      {chosen && (
        <div className="rounded-xl border border-gray bg-secondary/50 p-4">
          {chosen.description && (
            <p className="mb-3 text-xs leading-relaxed text-gray-600">{chosen.description}</p>
          )}

          <div className="flex flex-wrap items-baseline gap-2 text-sm">
            <span className="text-gray-500">Amount at the counter:</span>
            <span className="font-bold text-dark">
              {total !== null ? peso(total) : "Choose below to see the amount"}
            </span>
          </div>

          {/* What the total is made of, so it can be checked at the counter. */}
          {fee !== null && stamp > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {peso(fee)} fee + ₱{stamp.toFixed(2)} documentary stamp
            </p>
          )}

          <p className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Bring with you
          </p>
          {chosen.requirements.length > 0 ? (
            <ul className="list-inside list-disc space-y-0.5 text-xs text-dark">
              {chosen.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500">
              Nothing listed for this one — bring a valid ID and the office will tell you if
              anything else is needed.
            </p>
          )}

          {chosen.schedule && (
            <p className="mt-3 text-xs text-gray-500">Office hours: {chosen.schedule}</p>
          )}
        </div>
      )}

      {item.serviceType === "Certification of Death" && (
        <DeathCertificatePortalFields item={item} patchItem={patchItem} />
      )}

      {chosen?.fee_from === "business" && (
        <>
          <FormField label="Business name" required>
            <input
              value={item.businessName}
              onChange={(e) => patchItem(item.key, { businessName: e.target.value })}
              required
              maxLength={150}
              className={inputClasses}
              placeholder="e.g. Dela Cruz General Merchandise"
            />
          </FormField>

          <FormField
            label="Kind of business"
            required
            hint="Not on the list? Choose Others and type it — the office will review it."
          >
            <ChoiceWithOther
              options={chosen.business_kinds ?? {}}
              value={item.businessKind}
              onChange={(value) => patchItem(item.key, { businessKind: value })}
              placeholder="Choose the kind of business…"
              otherPlaceholder="Type the kind of business"
              otherPrice={chosen.other_fee}
              required
            />
          </FormField>
        </>
      )}

      {chosen?.asks_purpose === false ? null : chosen?.fee_from === "clearance" ? (
        <FormField
          label="Purpose"
          required
          hint="Not on the list? Choose Others and type it — the office will review it."
        >
          <ChoiceWithOther
            options={chosen.purposes ?? {}}
            value={item.purpose}
            onChange={(value) => patchItem(item.key, { purpose: value })}
            placeholder="Choose what you need it for…"
            otherPlaceholder="Type the purpose — e.g. Scholarship application"
            otherPrice={chosen.other_fee}
            required
          />
        </FormField>
      ) : (
        <FormField label="Purpose" required hint="e.g. Employment requirement, school enrollment">
          <textarea
            value={item.purpose}
            onChange={(e) => patchItem(item.key, { purpose: e.target.value })}
            rows={3}
            required
            className={`${inputClasses} resize-none`}
          />
        </FormField>
      )}
    </fieldset>
  );
}
