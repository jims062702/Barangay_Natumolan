import { Section } from "../Section";
import { progressOf, inBand, ageOf, maybeWoman, isOther } from "../../lib/rules";
import { Text } from "../fields/Text";
import { Coded } from "../fields/Coded";
import type { CensusFormState } from "../../hooks/useCensusForm";
import type { Member, Codes } from "../../types";

/**
 * Q22–Q25 — women ten to fifty-four.
 */
export function FamilyPlanningSection({ ctx, member, m, index }: {
  ctx: CensusFormState;
  member: Member;
  m: Codes;
  index: number;
}) {
  const { setMember } = ctx;

  return (
    <Section
      title="Q22–Q25 · Family planning"
      note="women 10 to 54"
      progress={progressOf(
        inBand(ageOf(member), 10, 54) && maybeWoman(member, m.sexes)
          ? [
              "q22_pregnancies",
              String(member.q22_pregnancies ?? "") !== "0" && "q22_living_children",
              "q23_fp_method",
              "q24_fp_source",
              isOther(member.q24_fp_source, m.fp_sources) && "q24_other",
              "q25_fp_intention", "q25_detail",
            ]
          : [],
        member
      )}
    >
      {/*
        One cell on the paper, split by a diagonal: pregnancies
        in the upper triangle, children still living in the
        lower. Two boxes here, because a triangle is not a
        thing a screen has.
      */}
      <Text
        label="Q22 Pregnancies"
        hint="Total she has had, ever. If none, write 0."
        digits={3}
        value={member.q22_pregnancies}
        onChange={(v) => setMember(index, "q22_pregnancies", v)}
      />
      <Text
        label="Q22 Children still living"
        hint="As of today, not at birth."
        digits={3}
        value={member.q22_living_children}
        onChange={(v) => setMember(index, "q22_living_children", v)}
        disabled={String(member.q22_pregnancies ?? "") === "0"}
        disabledNote="99 — no pregnancies, so none are living. SKIP TO Q23."
      />
      <Coded label="Q23 FP method in use" list={m.fp_methods} value={member.q23_fp_method} onChange={(v) => setMember(index, "q23_fp_method", v)} />
      <Coded label="Q24 Where obtained" list={m.fp_sources} value={member.q24_fp_source} onChange={(v) => setMember(index, "q24_fp_source", v)} />
      <Text
        label="Q24 If another source, specify"
        maxLength={80}
        value={member.q24_other}
        onChange={(v) => setMember(index, "q24_other", v)}
        disabled={!isOther(member.q24_fp_source, m.fp_sources)}
        disabledNote="Only when the source is not on the list."
      />
      {/*
        Also one split cell. The Yes or No goes in the upper
        triangle; what goes in the lower depends on it — the
        METHOD after a Yes, the REASON after a No. One box, and
        the label says which is wanted.
      */}
      <Coded label="Q25 Intend to use FP" list={m.yes_no} value={member.q25_fp_intention} onChange={(v) => setMember(index, "q25_fp_intention", v)} />
      <Text
        label={
          String(member.q25_fp_intention ?? "") === "1"
            ? "Q25 Which method"
            : String(member.q25_fp_intention ?? "") === "2"
              ? "Q25 Why not"
              : "Q25 Which method, or why not"
        }
        hint={
          String(member.q25_fp_intention ?? "") === "1"
            ? "The method they intend to use."
            : String(member.q25_fp_intention ?? "") === "2"
              ? "Their reason for not intending to."
              : "Answer Q25 and this asks for one or the other."
        }
        maxLength={80}
        value={member.q25_detail}
        onChange={(v) => setMember(index, "q25_detail", v)}
      />
    </Section>
  );
}
