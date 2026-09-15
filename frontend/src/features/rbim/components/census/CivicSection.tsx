import { Section } from "../Section";
import { progressOf, inBand, ageOf } from "../../lib/rules";
import { Coded } from "../fields/Coded";
import { VoterField } from "../fields/VoterField";
import type { CensusFormState } from "../../hooks/useCensusForm";
import type { Member, Codes } from "../../types";

/**
 * Q30–Q32 — socio-civic participation.
 */
export function CivicSection({ ctx, member, m, index }: {
  ctx: CensusFormState;
  member: Member;
  m: Codes;
  index: number;
}) {
  const { setMember } = ctx;

  return (
    <Section
      title="Q30–Q32 · Socio-civic participation"
      /*
        Three questions with three different age bands, so this
        one is counted question by question rather than as a
        block.
      */
      progress={progressOf([
        inBand(ageOf(member), 10) && "q30_solo_parent",
        inBand(ageOf(member), 60) && "q31_senior_registered",
        inBand(ageOf(member), 15) && "q32_voter_barangay",
      ], member)}
    >
      <Coded label="Q30 Solo parent" hint="10 and above" list={m.solo_parent} value={member.q30_solo_parent} onChange={(v) => setMember(index, "q30_solo_parent", v)} />
      <Coded label="Q31 Registered senior citizen" hint="60 and above" list={m.yes_no} value={member.q31_senior_registered} onChange={(v) => setMember(index, "q31_senior_registered", v)} />
      <VoterField
        value={member.q32_voter_barangay}
        onChange={(v) => setMember(index, "q32_voter_barangay", v)}
      />
    </Section>
  );
}
