import Modal from "../../../../shared/ui/Modal";
import StatusBadge from "../../../../shared/ui/StatusBadge";
import { formatWallClock } from "../../../../shared/lib/datetime";
import { asDate } from "../../lib/hearings";
import type { LuponCase } from "../../types";

/**
 * The case, for the officer who has to write it up.
 *
 * THE SECRETARY KEEPS THE MINUTES AND HAS NO DOCKET. The case number on
 * every row used to link to one, and the link answered 403 to the one
 * officer whose job it is to record what happened — asked to write an
 * account of a dispute they could not read. This is that case: what the
 * complaint says, who the parties are, every sitting held and what came of
 * it, and the settlement if there is one.
 *
 * Read-only, and deliberately not the docket. Filing, the fee and the
 * certificate to court are the Lupon's work and stay on their screen; what
 * is here is what somebody needs in front of them while a sitting is
 * running.
 */
export function CaseFileModal({ caseFor, onClose }: {
  caseFor: LuponCase | null;
  onClose: () => void;
}) {
  const c = caseFor;

  return (
    <Modal
      open={c !== null}
      onClose={onClose}
      wide
      title={`Case ${c?.case_number ?? ""}`}
    >
      {c && (
        <div className="space-y-4">
          <div className="rounded-xl bg-secondary px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold text-dark">{c.case_title}</p>
              <StatusBadge status={c.current_stage} />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {c.case_classification} · Filed {asDate(c.date_filed)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Party
              label="Complainant"
              name={c.complainant_display_name}
              where={c.complainant_display_address}
              phone={c.complainant_display_contact}
            />
            <Party label="Respondent" name={c.respondent_display_names} />
          </div>

          {/* What the case is ABOUT — the reason the sitting is being held,
              and the thing the minutes have to answer. */}
          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              The complaint
            </h3>
            <p className="whitespace-pre-wrap rounded-xl border border-gray px-3.5 py-3 text-sm leading-relaxed text-dark">
              {c.complaint?.complaint_narrative || "No narrative was recorded."}
            </p>
            {c.complaint && (
              <p className="mt-1.5 text-xs text-gray-500">
                {asDate(c.complaint.date_of_occurrence)} at {c.complaint.place_of_occurrence || "—"}
                {c.complaint.relationship_nature ? ` · the parties are ${c.complaint.relationship_nature.toLowerCase()}` : ""}
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Sittings
            </h3>
            <ul className="divide-y divide-gray/70 rounded-xl border border-gray">
              {(c.hearings ?? []).length === 0 && (
                <li className="px-3.5 py-3 text-sm text-gray-400">
                  No sitting is on the calendar — the summons has not been printed.
                </li>
              )}
              {(c.hearings ?? []).map((h) => (
                <li key={h.id} className="px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-dark">
                      {formatWallClock(h.scheduled_at)}
                      <span className="ml-2 text-xs text-gray-500">
                        {h.hearing_type === "Conciliation" ? "Lupon" : "Punong Barangay"}
                      </span>
                    </span>
                    <StatusBadge status={h.status} />
                  </div>
                  {h.outcome && <p className="mt-0.5 text-xs text-gray-600">{h.outcome}</p>}
                  {/* The minutes of the ones already held: what was said
                      last time is what this sitting picks up from. */}
                  {h.proceedings_notes && (
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
                      {h.proceedings_notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {c.settlement && (
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                What was agreed
              </h3>
              <p className="whitespace-pre-wrap rounded-xl border border-gray px-3.5 py-3 text-sm leading-relaxed text-dark">
                {c.settlement.terms}
              </p>
              <p className="mt-1.5 text-xs text-gray-500">
                Agreed {asDate(c.settlement.date_agreed)}
                {c.settlement.repudiation_deadline
                  ? ` · final after ${asDate(c.settlement.repudiation_deadline)} unless repudiated`
                  : ""}
              </p>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

function Party({ label, name, where, phone }: {
  label: string;
  name?: string | null;
  where?: string | null;
  phone?: string | null;
}) {
  return (
    <div className="rounded-xl border border-gray px-3.5 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-dark">{name || "—"}</p>
      {where && <p className="mt-0.5 text-xs text-gray-500">{where}</p>}
      {phone && <p className="text-xs text-gray-500">{phone}</p>}
    </div>
  );
}
