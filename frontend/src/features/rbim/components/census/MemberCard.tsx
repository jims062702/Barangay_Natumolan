import { FiX, FiCheck } from "react-icons/fi";
import { Link } from "react-router-dom";
import { DemographicsSection } from "./DemographicsSection";
import { SystemSection } from "./SystemSection";
import { EconomicSection } from "./EconomicSection";
import { InfantHealthSection } from "./InfantHealthSection";
import { FamilyPlanningSection } from "./FamilyPlanningSection";
import { HealthSection } from "./HealthSection";
import { CivicSection } from "./CivicSection";
import { MigrationSection } from "./MigrationSection";
import { CommunityTaxSection } from "./CommunityTaxSection";
import type { CensusFormState } from "../../hooks/useCensusForm";
import type { Member, Codes } from "../../types";

/**
 * One line of the paper form: one person, divided the way the paper divides them.
 */
export function MemberCard({ ctx, index, member, m }: {
  ctx: CensusFormState;
  index: number;
  member: Member;
  m: Codes;
}) {
  const {
    setMembers, matches, setMemberFlag,
  } = ctx;

  return (
    <div className="rounded-2xl border border-gray bg-secondary/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-dark">
          Line {index + 1}
          {(member.first_name || member.last_name) && (
            <span className="ml-2 font-normal text-gray-600">
              {member.first_name} {member.last_name}
            </span>
          )}
        </p>
        {/* Line 1 is the head — there is no household without one. */}
        {index > 0 && (
          <button
            type="button"
            onClick={() => setMembers((p) => p.filter((_, i) => i !== index))}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray bg-white px-3 py-1 text-xs font-semibold text-gray-500 transition-colors hover:border-danger hover:text-danger"
          >
            <FiX className="h-3.5 w-3.5" aria-hidden="true" /> Remove
          </button>
        )}
      </div>

      <fieldset className="space-y-3">
        <DemographicsSection ctx={ctx} member={member} index={index} m={m} />

        {/*
          Not on the paper form, and the form cannot do without it.

          A portal account is issued against an email address and
          nothing else, so a household typed in entirely from a
          census would come out with nobody able to sign in. Its
          own section, and labelled as the system's question rather
          than the census's — an encoder comparing screen to paper
          should not spend a minute looking for it there.
        */}
        <SystemSection ctx={ctx} member={member} index={index} />

        <EconomicSection ctx={ctx} member={member} index={index} m={m} />

        <InfantHealthSection ctx={ctx} member={member} m={m} index={index} />

        <FamilyPlanningSection ctx={ctx} member={member} m={m} index={index} />

        <HealthSection ctx={ctx} member={member} m={m} index={index} />

        <CivicSection ctx={ctx} member={member} m={m} index={index} />

        <MigrationSection ctx={ctx} member={member} m={m} index={index} />

        <CommunityTaxSection ctx={ctx} member={member} m={m} index={index} />
      </fieldset>

      {/*
        Whether this line becomes a resident record when the form is
        submitted.

        Line 1 has no switch: it is the household head, and there is
        no household without one. The rest are on by default and can
        be turned off, because a census records who was in the house
        that evening — a visiting cousin from the next barangay
        belongs on the sheet without belonging on this register.
      */}
      {(member.first_name || member.last_name) && (
        <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          {index === 0 ? (
            <p className="flex items-center gap-2 text-xs font-semibold text-primary">
              <FiCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              Registered as a resident — the household head always is.
            </p>
          ) : (
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                // Absent means yes: a line the office has not
                // touched is one they mean to register.
                checked={Number(member.register_as_resident ?? 1) === 1}
                onChange={(e) =>
                  setMemberFlag(index, "register_as_resident", e.target.checked)
                }
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--color-primary)]"
              />
              <span>
                <span className="block text-xs font-semibold text-dark">
                  Register as a resident
                </span>
                <span className="block text-xs text-gray-500">
                  Submitting the form puts them on the barangay register. Turn this
                  off for somebody who was in the house but lives elsewhere.
                </span>
              </span>
            </label>
          )}

          {matches[index] && (
            <p className="mt-2 text-xs text-gray-500">
              On the register as{" "}
              <Link
                to={`/residents/${matches[index]!.id}`}
                className="font-semibold text-primary hover:underline"
              >
                {matches[index]!.resident_number}
              </Link>
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}
