import { Section } from "../Section";
import { progressOf, isOther } from "../../lib/rules";
import { Coded } from "../fields/Coded";
import { Text } from "../fields/Text";
import type { CensusFormState } from "../../hooks/useCensusForm";
import type { Member, Codes } from "../../types";

/**
 * Q26–Q29 — health, asked of everybody.
 */
export function HealthSection({ ctx, member, m, index }: {
  ctx: CensusFormState;
  member: Member;
  m: Codes;
  index: number;
}) {
  const { setMember } = ctx;

  return (
    <Section
      title="Q26–Q29 · Health"
      note="all members"
      progress={progressOf([
        "q26_health_insurance",
        isOther(member.q26_health_insurance, m.health_insurance) && "q26_other",
        "q27_facility_visited",
        isOther(member.q27_facility_visited, m.facilities) && "q27_other",
        "q28_visit_reason",
        isOther(member.q28_visit_reason, m.visit_reasons) && "q28_other",
        "q29_disability",
      ], member)}
    >
      <Coded label="Q26 Health insurance" list={m.health_insurance} value={member.q26_health_insurance} onChange={(v) => setMember(index, "q26_health_insurance", v)} />
      <Text
        label="Q26 If others, specify"
        maxLength={80}
        value={member.q26_other}
        onChange={(v) => setMember(index, "q26_other", v)}
        disabled={!isOther(member.q26_health_insurance, m.health_insurance)}
        disabledNote="Only when the insurer is not on the list."
      />
      <Coded label="Q27 Facility visited (12 months)" list={m.facilities} value={member.q27_facility_visited} onChange={(v) => setMember(index, "q27_facility_visited", v)} />
      <Text
        label="Q27 If another facility, specify"
        maxLength={80}
        value={member.q27_other}
        onChange={(v) => setMember(index, "q27_other", v)}
        disabled={!isOther(member.q27_facility_visited, m.facilities)}
        disabledNote="Only when the facility is not on the list."
      />
      <Coded label="Q28 Reason for the visit" list={m.visit_reasons} value={member.q28_visit_reason} onChange={(v) => setMember(index, "q28_visit_reason", v)} />
      <Text
        label="Q28 If another reason, specify"
        maxLength={80}
        value={member.q28_other}
        onChange={(v) => setMember(index, "q28_other", v)}
        disabled={!isOther(member.q28_visit_reason, m.visit_reasons)}
        disabledNote="Only when the reason is not on the list."
      />
      <Coded label="Q29 Disability" list={m.disabilities} value={member.q29_disability} onChange={(v) => setMember(index, "q29_disability", v)} />
    </Section>
  );
}
