import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import ChoiceWithOther from "../../../../shared/ui/ChoiceWithOther";
import { peso } from "../../lib/money";
import type { PortalRequestsState } from "../../hooks/usePortalRequests";

/**
 * Asking the barangay for a certificate from home.
 */
export function NewRequestModal({ ctx }: { ctx: PortalRequestsState }) {
  const {
    createOpen, setCreateOpen, submit, serviceType, setServiceType, services, chosen,
    quotedTotal, quotedFee, stamp, businessName, setBusinessName, businessKind,
    setBusinessKind, purpose, setPurpose, saving,
  } = ctx;

  return (
    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Request a certificate">
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Which certificate?" required>
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
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
                {quotedTotal !== null ? peso(quotedTotal) : "Choose below to see the amount"}
              </span>
            </div>

            {/* What the total is made of, so it can be checked at the counter. */}
            {quotedFee !== null && stamp > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {peso(quotedFee)} fee + ₱{stamp.toFixed(2)} documentary stamp
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

        {chosen?.fee_from === "business" && (
          <>
            <FormField label="Business name" required>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
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
                value={businessKind}
                onChange={setBusinessKind}
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
              value={purpose}
              onChange={setPurpose}
              placeholder="Choose what you need it for…"
              otherPlaceholder="Type the purpose — e.g. Scholarship application"
              otherPrice={chosen.other_fee}
              required
            />
          </FormField>
        ) : (
          <FormField label="Purpose" required hint="e.g. Employment requirement, school enrollment">
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={3}
              required
              className={`${inputClasses} resize-none`}
            />
          </FormField>
        )}

        <button
          type="submit"
          disabled={saving || !serviceType}
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {saving ? "Submitting…" : "Submit request"}
        </button>
      </form>
    </Modal>
  );
}
