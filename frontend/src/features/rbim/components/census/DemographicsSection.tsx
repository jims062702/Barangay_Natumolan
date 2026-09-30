import { Section } from "../Section";
import { progressOf, inBand, ageOf, schoolDetailsApply, asInitial, ageFromBirth, outOfBand } from "../../lib/rules";
import { Text } from "../fields/Text";
import { Coded } from "../fields/Coded";
import { MONTHS } from "../../lib/constants";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import type { CensusFormState } from "../../hooks/useCensusForm";
import type { Member, Codes } from "../../types";

/**
 * Q1–Q14 — who the person is.
 */
export function DemographicsSection({ ctx, member, index, m }: {
  ctx: CensusFormState;
  member: Member;
  index: number;
  m: Codes;
}) {
  const { setMember } = ctx;

  return (
    <Section
      title="Q1–Q14 · Demographics"
      openByDefault
      progress={progressOf([
        "last_name", "first_name", "middle_name", "q2_relationship",
        "q3_sex", "q4_age", "q5_birthdate",
        "q6_birthplace", "q7_nationality",
        // Only a non-Filipino is asked which nationality.
        String(member.q7_nationality ?? "") === "2" && "q7_nationality_other",
        "q8_marital_status", "q9_religion", "q10_ethnicity",
        /*
          A locked box is not a question this line is being
          asked, so it is not counted — in the numerator or the
          denominator. Counting them is what left a
          twenty-five-year-old stuck at 14/16 with two boxes
          nobody could ever fill.
        */
        inBand(ageOf(member), 5) && "q11_education",
        inBand(ageOf(member), 3) && "q12_enrolled",
        schoolDetailsApply(member) && "q13_school_level",
        schoolDetailsApply(member) && "q14_school_place",
      ], member)}
    >
      {/*
        On line 1 these are the head's name, typed once in
        Identification. Read-only here rather than hidden, so
        the encoder can see what the grid will carry — and
        cannot make it say something else.
      */}
      <Text
        label="Q1 Surname"
        required
        value={member.last_name}
        onChange={(v) => setMember(index, "last_name", v)}
        readOnly={index === 0}
        hint={index === 0 ? "From the household head above." : undefined}
      />
      <Text
        label="Q1 First name"
        required
        value={member.first_name}
        onChange={(v) => setMember(index, "first_name", v)}
        readOnly={index === 0}
        hint={index === 0 ? "From the household head above." : undefined}
      />
      {/*
        An initial, not a name. The paper will take either, and
        the office asks for the initial — so the box holds one
        letter and says so, rather than accepting a full middle
        name that the register would then carry differently
        from every other record.

        On line 1 it comes from the head's name above, like the
        other two. It was the one box of the three left open,
        which meant line 1 could be made to disagree with the
        name it is supposed to be.
      */}
      {/*
        Typed as a letter, stored as an initial.

        "L" and "L." are the same answer, and which one the
        register ends up holding should not depend on whether
        the encoder happened to reach for the full stop. So the
        box takes either and keeps one.
      */}
      <Text
        label="Q1 Middle initial"
        value={member.middle_name}
        maxLength={2}
        onChange={(v) => setMember(index, "middle_name", asInitial(v))}
        readOnly={index === 0}
        hint={index === 0 ? "From the household head above." : "One letter, e.g. L."}
      />
      <Coded
        label="Q2 Relationship to head"
        list={m.relationships}
        value={member.q2_relationship}
        onChange={(v) => setMember(index, "q2_relationship", v)}
        lockedTo={index === 0 ? 1 : undefined}
        lockedNote="Line 1 is the head — that is what code 01 means."
      />
      <Coded label="Q3 Sex" neededToRegister list={m.sexes} value={member.q3_sex} onChange={(v) => setMember(index, "q3_sex", v)} />
      {/*
        Read-only once Q5 is answered, because then it is not a
        separate fact: it is today minus the date of birth. A typed
        age is only true on the day it was typed, and a census
        form outlives the day it was filled in.
      */}
      <Text
        label="Q4 Age at last birthday"
        digits={3}
        value={ageFromBirth(member) ?? member.q4_age}
        onChange={(v) => setMember(index, "q4_age", v)}
        readOnly={ageFromBirth(member) !== null}
        hint={
          ageFromBirth(member) !== null
            ? "Counted from Q5, and it keeps counting."
            : "Or answer Q5 and this fills itself."
        }
      />
      {/*
        Q5 — the DATE of birth, as the office asked: the register prints it
        on certificates and counts senior citizens by it, and a month and a
        year left it a month out. The month and year the RBIM codebook
        speaks in are filled in from it, never typed beside it.

        A form saved before this asked only for the month and year; that
        answer is shown under the box until the full date replaces it.
      */}
      <FormField
        label="Q5 Date of birth"
        required
        hint={
          !member.q5_birthdate && Number(member.q5_birth_month) && Number(member.q5_birth_year)
            ? `Saved before as ${MONTHS[Number(member.q5_birth_month) - 1]} ${member.q5_birth_year} — enter the full date.`
            : undefined
        }
      >
        <input
          type="date"
          value={String(member.q5_birthdate ?? "")}
          min="1900-01-01"
          max={new Date().toLocaleDateString("en-CA")}
          onChange={(e) => {
            const date = e.target.value;
            setMember(index, "q5_birthdate", date);
            setMember(index, "q5_birth_month", date ? String(Number(date.slice(5, 7))) : "");
            setMember(index, "q5_birth_year", date ? date.slice(0, 4) : "");
          }}
          aria-label={`Q5 Date of birth, line ${index + 1}`}
          className={inputClasses}
        />
      </FormField>
      <Text label="Q6 Place of birth" hint="City/Municipality and Province" maxLength={80} value={member.q6_birthplace} onChange={(v) => setMember(index, "q6_birthplace", v)} />
      <Coded label="Q7 Nationality" list={m.nationalities} value={member.q7_nationality} onChange={(v) => setMember(index, "q7_nationality", v)} />
      {/*
        Dead while the answer is Filipino. A country typed
        beside "1 · Filipino" contradicts the box next to it,
        and one of the two is going to be believed.
      */}
      <Text
        label="Q7 If not Filipino"
        placeholder="Which country?"
        value={member.q7_nationality_other}
        onChange={(v) => setMember(index, "q7_nationality_other", v)}
        disabled={String(member.q7_nationality ?? "") !== "2"}
        disabledNote="Only for a non-Filipino."
      />
      <Coded label="Q8 Marital status" list={m.marital_statuses} value={member.q8_marital_status} onChange={(v) => setMember(index, "q8_marital_status", v)} />
      <Text label="Q9 Religion" maxLength={20} value={member.q9_religion} onChange={(v) => setMember(index, "q9_religion", v)} />
      {/*
        The examples are printed in the question on the paper,
        where the BHW reads them aloud. An encoder working from
        a filled sheet never sees that wording, so it is
        repeated here.
      */}
      <Text
        label="Q10 Ethnicity"
        maxLength={30}
        hint="Tagalog, Bicolano, Bisaya, etc."
        value={member.q10_ethnicity}
        onChange={(v) => setMember(index, "q10_ethnicity", v)}
      />
      {/*
        Q11 keeps its age band: below five there is no level
        completed yet, which is true of every five-year-old
        there has ever been. The paper says write 99, so 99 is
        what goes in.

        Q12 keeps only the lower half of its band. Nobody under
        three is enrolled anywhere — but plenty of people are
        enrolled at forty, and the paper's "25 and above, write
        99" would have the form deny it. See schoolDetailsApply.
      */}
      {/*
        Q11 and Q13 look alike and are not.

        Q11 is what they have finished — fourteen codes, and
        the graduate ones are the point of it. Q13 is what they
        are sitting in right now, six codes, and only if Q12
        says they are enrolled. A college graduate of thirty
        taking a vocational course answers 12 to one and 4 to
        the other.

        Both labels say which is which, because "school level"
        on its own reads as a repeat of the box above it.
      */}
      <Coded
        label="Q11 Highest level completed"
        hint="What they have already finished. 5 and above."
        list={m.education_levels}
        value={member.q11_education}
        onChange={(v) => setMember(index, "q11_education", v)}
        skipped={outOfBand(ageOf(member), 5)}
        skippedNote="99 — under 5, so there is no level completed."
      />
      <Coded
        label="Q12 Currently enrolled"
        hint="3 and above — at any age."
        list={m.enrollment}
        value={member.q12_enrolled}
        onChange={(v) => setMember(index, "q12_enrolled", v)}
        skipped={outOfBand(ageOf(member), 3)}
        skippedNote="99 — under 3, so there is nothing to be enrolled in."
      />
      <Coded
        label="Q13 Level now attending"
        hint="What they are enrolled in now, not what they finished."
        list={m.school_levels}
        value={member.q13_school_level}
        onChange={(v) => setMember(index, "q13_school_level", v)}
        skipped={!schoolDetailsApply(member)}
        skippedNote={
          outOfBand(ageOf(member), 3)
            ? "99 — under 3, so there is no schooling to record."
            : "99 — Q12 is No, and the paper skips from there to Q15."
        }
      />
      <Text
        label="Q14 Place of school"
        maxLength={80}
        hint="Only when Q12 is Yes."
        value={member.q14_school_place}
        onChange={(v) => setMember(index, "q14_school_place", v)}
        disabled={!schoolDetailsApply(member)}
        disabledNote={
          outOfBand(ageOf(member), 3)
            ? "Under 3 — nothing to record."
            : "Q12 is No, so there is no school to name."
        }
      />
    </Section>
  );
}
