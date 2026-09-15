import Card from "../../../../shared/ui/Card";
import { luponApi } from "../../api";
import type { LuponCaseState } from "../../hooks/useLuponCase";
import type { LuponCase } from "../../types";

/**
 * What the complaint is about, as filed.
 */
export function ComplaintCard({ ctx, caseData }: { ctx: LuponCaseState; caseData: LuponCase }) {
  const { post, id } = ctx;

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
      {caseData.complaint && (
        <p className="mt-3 rounded-xl bg-secondary p-3 text-sm text-dark">
          {caseData.complaint.complaint_narrative}
        </p>
      )}
      {caseData.jurisdiction_status !== "Accepted" && caseData.rejection_reason && (
        <p className="mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">{caseData.rejection_reason}</p>
      )}
      <button
        type="button"
        onClick={() => post(() => luponApi.screenJurisdiction(id, {}), undefined)}
        className="mt-4 w-full cursor-pointer rounded-full border border-primary/30 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
      >
        Run jurisdiction screening
      </button>
    </Card>
  );
}
