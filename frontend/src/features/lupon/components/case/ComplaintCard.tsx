import { useState } from "react";
import Card from "../../../../shared/ui/Card";
import { errorMessage } from "../../../../shared/lib/api";
import { toast } from "../../../../shared/lib/toast";
import type { Resident } from "../../../../shared/types";
import ResidentMultiPicker from "../../../resident/components/ResidentMultiPicker";
import { luponApi } from "../../api";
import type { LuponCase } from "../../types";

/**
 * A case with NO respondent — accepted from an online complaint before the
 * respondent was required there (2026-09-29). The Lupon names them here,
 * once, from the register; a case that names its respondent is never
 * changed (see below, and CaseController::nameRespondents).
 */
function NameRespondent({ caseData, onChanged }: { caseData: LuponCase; onChanged?: () => void }) {
  const [chosen, setChosen] = useState<Resident[]>([]);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const r = await luponApi.nameRespondents(caseData.id, { respondent_ids: chosen.map((p) => p.id) });
      toast(r.data.message);
      onChanged?.();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-warning/40 bg-warning/5 p-3" data-testid="name-respondent">
      <p className="text-sm font-semibold text-dark">No respondent on the register yet</p>
      <p className="mt-0.5 text-xs leading-relaxed text-gray-600">
        This case was accepted before the respondent was required. Search the register for the person the complaint
        is against — a summons cannot be served on a name alone.
      </p>
      <div className="mt-2">
        <ResidentMultiPicker
          value={chosen}
          onChange={setChosen}
          residentsOnly
          excludeIds={caseData.complainant_id ? [caseData.complainant_id] : []}
          placeholder="Search by Name or Resident Number…"
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || chosen.length === 0}
          className="cursor-pointer rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving…" : "Set the respondent"}
        </button>
      </div>
    </div>
  );
}

/**
 * What the complaint is about, as filed.
 *
 * Read-only, and there is no "run the jurisdiction screening" button on it.
 *
 * The screening is not a thing the Lupon chooses to run — it runs when the
 * complaint is FILED, and it refuses rather than records: a matter that reads
 * as VAWC never becomes a case at all, and a respondent who lives outside the
 * barangay is rejected at the same moment. Neither input can change
 * afterwards, because nothing in the system edits a filed narrative or takes a
 * respondent off a case. So a button re-running those tests on a case that
 * exists could only ever confirm what the case already said.
 */
export function ComplaintCard({ caseData, onChanged }: { caseData: LuponCase; onChanged?: () => void }) {
  return (
    <Card title="Complaint">
      <dl className="space-y-2.5 text-sm">
        {[
          /*
            A complainant on the register is not asked for an address —
            theirs is already recorded, and the register is where it is
            kept current. Read from there rather than copied at filing
            time: a summons served six weeks later goes to where they
            live now, not where they lived when they complained.

            Somebody from another barangay has no record here, so their
            details were typed in and are shown as typed.
          */
          [
            "Complainant",
            caseData.complainant_is_resident === false
              ? `${caseData.complainant_display_name} (not a barangay resident)`
              : `${caseData.complainant_display_name ?? "—"}${
                  caseData.complainant_reference ? ` · ${caseData.complainant_reference}` : ""
                }`,
          ],
          ["Complainant address", caseData.complainant_display_address || "—"],
          ["Complainant contact", caseData.complainant_display_contact || "—"],
          [
            caseData.respondents && caseData.respondents.length > 1 ? "Respondents" : "Respondent",
            caseData.respondent_display_names || "—",
          ],
          ["Occurred", caseData.complaint ? new Date(caseData.complaint.date_of_occurrence).toLocaleDateString("en-PH") : "—"],
          ["Place", caseData.complaint?.place_of_occurrence ?? "—"],
          ["Relationship", caseData.complaint?.relationship_nature ?? "—"],
          ["Jurisdiction", caseData.jurisdiction_status],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-gray/60 pb-2 last:border-0">
            <dt className="text-gray-500">{label}</dt>
            <dd className="text-right font-medium text-dark">{value}</dd>
          </div>
        ))}
      </dl>
      {caseData.jurisdiction_status === "Accepted" && (caseData.respondents?.length ?? 0) === 0 && (
        <NameRespondent caseData={caseData} onChanged={onChanged} />
      )}
      {caseData.complaint && (
        <p className="mt-3 rounded-xl bg-secondary p-3 text-sm text-dark">
          {caseData.complaint.complaint_narrative}
        </p>
      )}
      {caseData.jurisdiction_status !== "Accepted" && caseData.rejection_reason && (
        <p className="mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">{caseData.rejection_reason}</p>
      )}
    </Card>
  );
}
