import { Section } from "../Section";
import { progressOf, inBand, ageOf, skipsToQ19, outOfBand } from "../../lib/rules";
import { Text } from "../fields/Text";
import { Coded } from "../fields/Coded";
import type { CensusFormState } from "../../hooks/useCensusForm";
import type { Member, Codes } from "../../types";

/**
 * Q15–Q18 — work, for those fifteen and above.
 */
export function EconomicSection({ ctx, member, index, m }: {
  ctx: CensusFormState;
  member: Member;
  index: number;
  m: Codes;
}) {
  const { setMember } = ctx;

  return (
    <Section
      title="Q15–Q18 · Economic activity"
      note="15 and above"
      progress={progressOf(
        inBand(ageOf(member), 15)
          ? [
              "q15_monthly_income", "q16_income_source",
              // Remittance, investments and others SKIP TO Q19.
              !skipsToQ19(member) && "q17_work_status",
              !skipsToQ19(member) && "q18_work_place",
            ]
          : [],
        member
      )}
    >
      {/*
        A census answer about the resident, not barangay money.
        The form's own instruction: if none, write 0 — so zero
        is an answer and an empty box is not.
      */}
      <Text
        label="Q15 Average monthly income"
        money
        digits={12}
        prefix="₱"
        placeholder="0"
        hint="Per month. If none, write 0."
        value={member.q15_monthly_income}
        onChange={(v) => setMember(index, "q15_monthly_income", v)}
        disabled={outOfBand(ageOf(member), 15)}
        disabledNote="99 — under 15, so this is not asked."
      />
      {/*
        Two separate reasons to close these, and the age one
        comes first.

        Under fifteen the whole section is 99 — the paper says
        so for all four, and a twelve-year-old offered a status
        of business is a form inviting an answer to a question
        the census does not ask of a child.

        Above fifteen, Q17 and Q18 still close when the income
        is not from WORK: remittance, investments and "others"
        go straight to Q19.
      */}
      <Coded
        label="Q16 Source of income"
        list={m.income_sources}
        value={member.q16_income_source}
        onChange={(v) => setMember(index, "q16_income_source", v)}
        skipped={outOfBand(ageOf(member), 15)}
        skippedNote="99 — under 15, so this is not asked."
        hint={skipsToQ19(member) ? "Not from work — Q17 and Q18 are skipped." : undefined}
      />
      <Coded
        label="Q17 Status of work / business"
        list={m.work_statuses}
        value={member.q17_work_status}
        onChange={(v) => setMember(index, "q17_work_status", v)}
        skipped={outOfBand(ageOf(member), 15) || skipsToQ19(member)}
        skippedNote={
          outOfBand(ageOf(member), 15)
            ? "99 — under 15, so this is not asked."
            : "99 — the income is not from work. SKIP TO Q19."
        }
      />
      <Text
        label="Q18 Place of work"
        hint="Barangay and city/municipality"
        maxLength={80}
        value={member.q18_work_place}
        onChange={(v) => setMember(index, "q18_work_place", v)}
        disabled={outOfBand(ageOf(member), 15) || skipsToQ19(member)}
        disabledNote={
          outOfBand(ageOf(member), 15)
            ? "99 — under 15, so this is not asked."
            : "99 — the income is not from work. SKIP TO Q19."
        }
      />
    </Section>
  );
}
