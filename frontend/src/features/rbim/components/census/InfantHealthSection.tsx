import { Section } from "../Section";
import { progressOf, inBand, ageOf, isOther } from "../../lib/rules";
import { Coded } from "../fields/Coded";
import { Text } from "../fields/Text";
import type { CensusFormState } from "../../hooks/useCensusForm";
import type { Member, Codes } from "../../types";

/**
 * Q19–Q21 — infants up to eleven months.
 */
export function InfantHealthSection({ ctx, member, m, index }: {
  ctx: CensusFormState;
  member: Member;
  m: Codes;
  index: number;
}) {
  const { setMember } = ctx;

  return (
    <Section
      title="Q19–Q21 · Infant health"
      note="0 to 11 months"
      progress={progressOf(
        // Under one year old: an age in whole years of 0.
        inBand(ageOf(member), 0, 0)
          ? [
              "q19_delivery_place",
              isOther(member.q19_delivery_place, m.delivery_places) && "q19_other",
              "q20_birth_attendant",
              isOther(member.q20_birth_attendant, m.birth_attendants) && "q20_other",
              "q21_immunization",
            ]
          : [],
        member
      )}
    >
      <Coded label="Q19 Place of delivery" list={m.delivery_places} value={member.q19_delivery_place} onChange={(v) => setMember(index, "q19_delivery_place", v)} />
      <Text
        label="Q19 If others, specify"
        maxLength={80}
        value={member.q19_other}
        onChange={(v) => setMember(index, "q19_other", v)}
        disabled={!isOther(member.q19_delivery_place, m.delivery_places)}
        disabledNote="Only when the place is not on the list."
      />
      <Coded label="Q20 Birth attendant" list={m.birth_attendants} value={member.q20_birth_attendant} onChange={(v) => setMember(index, "q20_birth_attendant", v)} />
      <Text
        label="Q20 If others, specify"
        maxLength={80}
        value={member.q20_other}
        onChange={(v) => setMember(index, "q20_other", v)}
        disabled={!isOther(member.q20_birth_attendant, m.birth_attendants)}
        disabledNote="Only when the attendant is not on the list."
      />
      <Text label="Q21 Last vaccine received" hint="From the baby book or immunisation card." maxLength={80} value={member.q21_immunization} onChange={(v) => setMember(index, "q21_immunization", v)} />
    </Section>
  );
}
