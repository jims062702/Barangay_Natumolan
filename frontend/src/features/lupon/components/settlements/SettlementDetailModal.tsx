import Modal from "../../../../shared/ui/Modal";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { asDate, actionsFor, ACTION_HELP, TONES } from "../../lib/settlements";
import { Deadline } from "./Deadline";
import type { SettlementDocketState } from "../../hooks/useSettlementDocket";

/**
 * One settlement: its terms, its deadlines, and what may be done next.
 */
export function SettlementDetailModal({ ctx }: { ctx: SettlementDocketState }) {
  const { viewing, setViewing, saveDeadline, deadline, setDeadline, notes, setNotes, run } = ctx;

  return (
    <Modal
      open={viewing !== null}
      onClose={() => setViewing(null)}
      wide
      title={`Settlement — ${viewing?.lupon_case?.case_number ?? ""}`}
    >
      {viewing && (
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-semibold text-dark">{viewing.lupon_case?.case_title}</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {viewing.settlement_type} · agreed {asDate(viewing.date_agreed)} ·{" "}
              <StatusBadge status={viewing.status} />
            </p>
          </div>

          {/* Who filed this, and against whom. */}
          <dl className="grid gap-3 rounded-xl border border-gray px-4 py-3 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-gray-400">Complainant</dt>
              <dd className="text-dark">
                {viewing.lupon_case?.complainant_display_name ?? "—"}
                {viewing.lupon_case?.complainant_is_resident === false && (
                  <span className="ml-2 rounded-full bg-gray px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                    not a barangay resident
                  </span>
                )}
              </dd>
              {viewing.lupon_case?.complainant_is_resident === false && (
                <dd className="mt-0.5 text-xs text-gray-500">
                  {viewing.lupon_case?.complainant_address ?? "Address not recorded"}
                  {viewing.lupon_case?.complainant_contact
                    ? ` · ${viewing.lupon_case.complainant_contact}`
                    : ""}
                </dd>
              )}
            </div>
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-gray-400">Respondent(s)</dt>
              <dd className="text-dark">
                {viewing.lupon_case?.respondent_display_names || "—"}
              </dd>
            </div>
          </dl>

          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">
              Terms and obligations
            </p>
            <p className="whitespace-pre-wrap rounded-xl border border-gray px-4 py-3 text-dark">
              {viewing.terms}
            </p>
          </div>

          <dl className="grid gap-3 rounded-xl bg-secondary px-4 py-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Repudiation</dt>
              <dd>
                <Deadline
                  date={viewing.repudiation_deadline}
                  active={viewing.status === "Within Repudiation Period"}
                />
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Certificates</dt>
              <dd className="text-dark">
                {viewing.cfa_issued ? `CFA ${asDate(viewing.cfa_issued_at)}` : "No CFA"} ·{" "}
                {viewing.cba_issued ? `CBA ${asDate(viewing.cba_issued_at)}` : "No CBA"}
              </dd>
            </div>
          </dl>

          <form onSubmit={saveDeadline} className="grid gap-4 rounded-xl border border-gray p-4 sm:grid-cols-2">
            <FormField label="Compliance deadline" hint="When the obligations fall due.">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={inputClasses}
              />
            </FormField>
            <FormField label="Compliance notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={`${inputClasses} resize-none`}
              />
            </FormField>
            <button
              type="submit"
              className="w-full cursor-pointer rounded-full border border-primary/40 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white sm:col-span-2"
            >
              Save deadline &amp; notes
            </button>
          </form>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Actions</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {actionsFor(viewing).map((a) => (
                <button
                  key={a.action}
                  type="button"
                  title={ACTION_HELP[a.action]}
                  onClick={() => run(viewing, a.action, a.label)}
                  className={`cursor-pointer rounded-full py-2 text-xs font-semibold transition-colors ${TONES[a.tone]}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            {actionsFor(viewing).length === 0 && (
              <p className="py-3 text-center text-xs text-gray-400">
                This settlement is closed — no further action available.
              </p>
            )}

          </div>
        </div>
      )}
    </Modal>
  );
}
