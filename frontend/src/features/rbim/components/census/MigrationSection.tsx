import { Section } from "../Section";
import { progressOf, inBand, ageOf, isNonMigrant, isOther, residentTypeFrom, without } from "../../lib/rules";
import { Text } from "../fields/Text";
import { Coded } from "../fields/Coded";
import { MonthYear } from "../fields/MonthYear";
import { joinMonthYear, splitMonthYear } from "../../lib/format";
import type { CensusFormState } from "../../hooks/useCensusForm";
import type { Member, Codes } from "../../types";

/**
 * Q33–Q41 — migration, for those five and above.
 */
export function MigrationSection({ ctx, member, m, index }: {
  ctx: CensusFormState;
  member: Member;
  m: Codes;
  index: number;
}) {
  const { setMember } = ctx;

  return (
    <Section
      title="Q33–Q41 · Migration"
      note="5 and above"
      progress={progressOf(
        inBand(ageOf(member), 5)
          ? [
              "q33_residence_5yrs", "q34_residence_6mos",
              "q35_stay_years", "q35_stay_months", "q36_resident_type",
              /*
                The paper: for Q37 to Q41, if non-migrant,
                write 99. Somebody who has always lived here
                has no transfer date and no reason for leaving
                anywhere, so none of these nine are asked.
              */
              ...(isNonMigrant(member)
                ? []
                : [
                    "q37_transfer_month", "q37_transfer_year",
                    "q38a_leave_reason",
                    // B and C close once A is Others.
                    !isOther(member.q38a_leave_reason, m.leave_reasons) &&
                      "q38b_leave_reason",
                    !isOther(member.q38a_leave_reason, m.leave_reasons) &&
                      "q38c_leave_reason",
                    (isOther(member.q38a_leave_reason, m.leave_reasons) ||
                      isOther(member.q38b_leave_reason, m.leave_reasons) ||
                      isOther(member.q38c_leave_reason, m.leave_reasons)) &&
                      "q38_other",
                    "q39_will_return", "q39_when",
                    "q40a_transfer_reason", "q40b_transfer_reason",
                    "q40c_transfer_reason", "q40_other",
                    "q41_intends_to_stay",
                    // No date after a No, and none before an answer.
                    String(member.q41_intends_to_stay ?? "") === "1" && "q41_until",
                  ]),
            ]
          : [],
        member
      )}
    >
      <Text label="Q33 Residence 5 years ago" maxLength={80} value={member.q33_residence_5yrs} onChange={(v) => setMember(index, "q33_residence_5yrs", v)} />
      <Text label="Q34 Residence 6 months ago" maxLength={80} value={member.q34_residence_6mos} onChange={(v) => setMember(index, "q34_residence_6mos", v)} />
      {/*
        The paper heads this pair "LENGTH OF STAY IN THE
        BARANGAY". "…and months" on its own said nothing —
        months of what, next to a box that had scrolled out of
        sight — so each box carries the question.
      */}
      <Text
        label="Q35 Length of stay — years"
        hint="How long they have lived in this barangay."
        digits={3}
        value={member.q35_stay_years}
        onChange={(v) => setMember(index, "q35_stay_years", v)}
      />
      <Text
        label="Q35 Length of stay — months"
        hint="The part-year on top of the years above. 0 to 11 — twelve months is a year."
        digits={2}
        max={11}
        value={member.q35_stay_months}
        onChange={(v) => setMember(index, "q35_stay_months", v)}
      />
      {/*
        Q36 is worked out, not asked — the paper is explicit:
        non-migrant when both previous residences are this
        barangay; migrant when one of them is not and the stay
        is over six months; transient when it is under. Left
        open when Q33 to Q35 do not yet say, because a guess
        here sends eight questions to 99 for somebody who
        should have answered them.
      */}
      <Coded
        label="Q36 Type of resident"
        list={m.resident_types}
        value={member.q36_resident_type ?? residentTypeFrom(member) ?? ""}
        onChange={(v) => setMember(index, "q36_resident_type", v)}
        hint={
          residentTypeFrom(member)
            ? "Worked out from Q33–Q35. Change it if the household says otherwise."
            : "Answer Q33–Q35 and this fills itself."
        }
      />

      {/*
        NOTE on the paper: for Q37 to Q41, if non-migrant,
        write 99. Somebody who has always lived here did not
        transfer, has no reason for leaving anywhere, and has
        no date to give.
      */}
      <MonthYear
        label="Q37 Transfer month and year"
        hint="When they moved into this barangay."
        value={joinMonthYear(member.q37_transfer_month, member.q37_transfer_year)}
        onChange={(v) => {
          const { month, year } = splitMonthYear(v);
          setMember(index, "q37_transfer_month", month);
          setMember(index, "q37_transfer_year", year);
        }}
        skipped={isNonMigrant(member)}
        skippedNote="99 — non-migrant, so there was no transfer."
      />

      {/*
        Three DIFFERENT reasons, so each box drops what the one
        before it took. And "Others" in the A box ends the
        question: what the other reason was goes in the box
        below, not into two more dropdowns.
      */}
      <Coded
        label="Q38A Reason for leaving"
        list={m.leave_reasons}
        value={member.q38a_leave_reason}
        onChange={(v) => setMember(index, "q38a_leave_reason", v)}
        skipped={isNonMigrant(member)}
        skippedNote="99 — non-migrant, so nowhere was left."
      />
      <Coded
        label="Q38B Reason for leaving"
        list={without(m.leave_reasons, [member.q38a_leave_reason])}
        value={member.q38b_leave_reason}
        onChange={(v) => setMember(index, "q38b_leave_reason", v)}
        skipped={isNonMigrant(member) || isOther(member.q38a_leave_reason, m.leave_reasons)}
        skippedNote={
          isNonMigrant(member)
            ? "99 — non-migrant, so nowhere was left."
            : "Q38A is Others — say what it was in the box below."
        }
      />
      <Coded
        label="Q38C Reason for leaving"
        list={without(m.leave_reasons, [member.q38a_leave_reason, member.q38b_leave_reason])}
        value={member.q38c_leave_reason}
        onChange={(v) => setMember(index, "q38c_leave_reason", v)}
        skipped={isNonMigrant(member) || isOther(member.q38a_leave_reason, m.leave_reasons)}
        skippedNote={
          isNonMigrant(member)
            ? "99 — non-migrant, so nowhere was left."
            : "Q38A is Others — say what it was in the box below."
        }
      />
      <Text
        label="Q38 If another reason, specify"
        maxLength={80}
        value={member.q38_other}
        onChange={(v) => setMember(index, "q38_other", v)}
        disabled={
          !isOther(member.q38a_leave_reason, m.leave_reasons) &&
          !isOther(member.q38b_leave_reason, m.leave_reasons) &&
          !isOther(member.q38c_leave_reason, m.leave_reasons)
        }
        disabledNote="Only when one of Q38A–C is Others."
      />
      <Coded
        label="Q39 Will return"
        list={m.yes_no}
        value={member.q39_will_return}
        onChange={(v) => setMember(index, "q39_will_return", v)}
        skipped={isNonMigrant(member)}
        skippedNote="99 — non-migrant, so there is nowhere to return to."
      />
      <MonthYear
        label="Q39 When"
        value={String(member.q39_when ?? "")}
        onChange={(v) => setMember(index, "q39_when", v)}
        skipped={isNonMigrant(member)}
        skippedNote="99 — non-migrant, so there is nowhere to return to."
      />
      <Coded
        label="Q40A Reason for transferring here"
        list={m.transfer_reasons}
        value={member.q40a_transfer_reason}
        onChange={(v) => setMember(index, "q40a_transfer_reason", v)}
        skipped={isNonMigrant(member)}
        skippedNote="99 — non-migrant, so there was no transfer."
      />
      <Coded
        label="Q40B Reason for transferring here"
        list={without(m.transfer_reasons, [member.q40a_transfer_reason])}
        value={member.q40b_transfer_reason}
        onChange={(v) => setMember(index, "q40b_transfer_reason", v)}
        skipped={isNonMigrant(member)}
        skippedNote="99 — non-migrant, so there was no transfer."
      />
      <Coded
        label="Q40C Reason for transferring here"
        list={without(m.transfer_reasons, [member.q40a_transfer_reason, member.q40b_transfer_reason])}
        value={member.q40c_transfer_reason}
        onChange={(v) => setMember(index, "q40c_transfer_reason", v)}
        skipped={isNonMigrant(member)}
        skippedNote="99 — non-migrant, so there was no transfer."
      />
      {/*
        Q40 has no "Others" code on the paper — the note says
        "if other reason/s, write the response", so the box is
        always open.
      */}
      <Text label="Q40 Any other reason" maxLength={80} value={member.q40_other} onChange={(v) => setMember(index, "q40_other", v)} />
      <Coded
        label="Q41 Intends to stay"
        list={m.yes_no}
        value={member.q41_intends_to_stay}
        onChange={(v) => setMember(index, "q41_intends_to_stay", v)}
        skipped={isNonMigrant(member)}
        skippedNote="99 — non-migrant, and already staying."
      />
      {/*
        "Until when" only means something after a Yes. After a
        No there is no date to give, and the paper says 99.
      */}
      <MonthYear
        label="Q41 Until when"
        value={String(member.q41_until ?? "")}
        onChange={(v) => setMember(index, "q41_until", v)}
        skipped={
          isNonMigrant(member) || String(member.q41_intends_to_stay ?? "") === "2"
        }
        skippedNote={
          isNonMigrant(member)
            ? "99 — non-migrant, and already staying."
            : "99 — they do not intend to stay, so there is no date."
        }
        disabled={!member.q41_intends_to_stay}
        disabledNote="Answer Q41 first."
      />
    </Section>
  );
}
