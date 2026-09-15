import { Section } from "../Section";
import { progressOf, inBand, ageOf, isOther, outOfBand } from "../../lib/rules";
import { Coded } from "../fields/Coded";
import { Text } from "../fields/Text";
import type { CensusFormState } from "../../hooks/useCensusForm";
import type { Member, Codes } from "../../types";

/**
 * Q42–Q44 — community tax certificate and skills.
 */
export function CommunityTaxSection({ ctx, member, m, index }: {
  ctx: CensusFormState;
  member: Member;
  m: Codes;
  index: number;
}) {
  const { setMember } = ctx;

  return (
    <Section
      title="Q42–Q44 · Community tax & skills"
      progress={progressOf([
        inBand(ageOf(member), 18) && "q42a_has_ctc",
        // No CTC, nothing to have been issued here. SKIP TO Q43.
        inBand(ageOf(member), 18) &&
          String(member.q42a_has_ctc ?? "") !== "2" &&
          "q42b_ctc_here",
        inBand(ageOf(member), 15) && "q43_training_interest",
        inBand(ageOf(member), 15) &&
          isOther(member.q43_training_interest, m.trainings) &&
          "q43_other",
        // NOTE on the paper: for Q43 and Q44, if 0–14, write 99.
        inBand(ageOf(member), 15) && "q44_skill",
        inBand(ageOf(member), 15) &&
          isOther(member.q44_skill, m.skills) &&
          "q44_other",
      ], member)}
    >
      <Coded
        label="Q42A Has a valid CTC"
        hint="18 and above"
        list={m.yes_no}
        value={member.q42a_has_ctc}
        onChange={(v) => setMember(index, "q42a_has_ctc", v)}
        skipped={outOfBand(ageOf(member), 18)}
        skippedNote="99 — under 18."
      />
      {/*
        "Was it issued here" has no answer when there is no
        CTC. The paper: if No, write the answer and SKIP TO Q43.
      */}
      <Coded
        label="Q42B Issued in this barangay"
        list={m.yes_no}
        value={member.q42b_ctc_here}
        onChange={(v) => setMember(index, "q42b_ctc_here", v)}
        skipped={
          outOfBand(ageOf(member), 18) || String(member.q42a_has_ctc ?? "") === "2"
        }
        skippedNote={
          outOfBand(ageOf(member), 18)
            ? "99 — under 18."
            : "99 — no CTC to have been issued. SKIP TO Q43."
        }
      />
      <Coded
        label="Q43 Training interested in"
        hint="15 and above"
        list={m.trainings}
        value={member.q43_training_interest}
        onChange={(v) => setMember(index, "q43_training_interest", v)}
        skipped={outOfBand(ageOf(member), 15)}
        skippedNote="99 — under 15."
      />
      <Text
        label="Q43 If another training, specify"
        maxLength={80}
        value={member.q43_other}
        onChange={(v) => setMember(index, "q43_other", v)}
        disabled={!isOther(member.q43_training_interest, m.trainings)}
        disabledNote="Only when the training is not on the list."
      />
      <Coded
        label="Q44 Most prominent skill"
        hint="15 and above"
        list={m.skills}
        value={member.q44_skill}
        onChange={(v) => setMember(index, "q44_skill", v)}
        skipped={outOfBand(ageOf(member), 15)}
        skippedNote="99 — under 15."
      />
      <Text
        label="Q44 If others, specify"
        maxLength={80}
        value={member.q44_other}
        onChange={(v) => setMember(index, "q44_other", v)}
        disabled={!isOther(member.q44_skill, m.skills)}
        disabledNote="Only when the skill is not on the list."
      />
    </Section>
  );
}
