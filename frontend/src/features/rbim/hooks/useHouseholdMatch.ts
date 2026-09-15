import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { errorMessage } from "../../../shared/lib/api";
import { rbimApi } from "../api";
import { ageFrom } from "../lib/rules";
import { BLANK_MEMBER } from "../lib/constants";
import type { CensusAnswersState } from "./useCensusAnswers";
import type { CensusSubmitState } from "./useCensusSubmit";
import type { HouseCheck, Member } from "../types";

/**
 * Matching the household number to the register, and bringing the people it already holds onto the form.
 */
export function useHouseholdMatch(ctx: CensusAnswersState & CensusSubmitState) {
  const {
    fillLineOneFrom, form, houseCheck, id, isDirty, members, notOnSheet, resetForm, save, set,
    setChecking, setHouseCheck, setMembers,
  } = ctx;

  /**
   * Asks whether this house is already on the register.
   *
   * It only asks. Joining the existing household, correcting a mistyped
   * number, or stopping to go back and ask the respondent are three
   * different decisions, and none of them is safe to make automatically.
   */
  const verifyHouse = async () => {
    const number = String(form.census_no ?? "").trim();
    if (!number) return;

    /*
     * Checking a number means starting that household's sheet — so anything
     * already typed is about to go. Asked before the check runs, not after:
     * by then the clerk has read an answer and is deciding on it, and a
     * dialogue about the previous household is an interruption in the wrong
     * place.
     */
    if (isDirty()) {
      const keep = await confirmAction({
        title: "Save what is on this form first?",
        text:
          "Checking another number starts that household's sheet, and what is typed here "
          + "has not been saved.",
        confirmText: "Save first",
        cancelText: "Discard it",
      });

      if (keep) {
        // Stay put: they pressed Verify, not Save. Bouncing them to the list
        // would take away the number they were in the middle of checking.
        await save(undefined, false);
        return;
      }
    }

    setChecking(true);
    setHouseCheck(null);
    try {
      const r = await rbimApi.verifyHousehold({
        // Not this form. Otherwise verifying the number already on it
        // reported the form itself as a clash and offered a link back to
        // the page the office was already on.
        params: { household_number: number, census_id: id },
      });
      setHouseCheck(r.data.data);

      if (!r.data.data.exists) {
        /*
         * A free number is a new household, so the sheet starts empty. The
         * number itself is kept — it is what the clerk just typed and just
         * checked.
         */
        resetForm(number);
      }
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setChecking(false);
    }
  };
  /**
   * Carries who the register already says lives here onto the grid.
   *
   * The office is not starting from nothing: the household exists and its
   * people are on the register. Making the encoder retype names the system
   * already holds is how a household ends up with two spellings of the same
   * person — so the lines are laid out first, and the visit fills in what
   * the census asks that the register does not.
   *
   * Lines already typed are kept. Anyone matching one by name is not added
   * again.
   */
  const continueHousehold = () => {
    const house = houseCheck?.household;
    if (!house) return;

    bringOntoForm(house, houseCheck?.residents ?? []);
    setHouseCheck(null);
  };
  /*
   * The merge itself, shared by both ways in: verifying a number before the
   * form is started, and opening a census that already exists. The second
   * had no way to do this at all — "Continue editing" opened the form and
   * left the household's registered people behind, which is the one thing
   * the button is for.
   */
  const bringOntoForm = (
    house: NonNullable<HouseCheck["household"]>,
    people: NonNullable<HouseCheck["residents"]>
  ) => {
    set("household_id", house.id);

    const typed = members.filter((mem) => mem.first_name || mem.last_name);

    const already = new Set(
      typed.map((mem) =>
        `${String(mem.first_name).trim()}|${String(mem.last_name).trim()}`.toLowerCase()
      )
    );

    const carried: Member[] = people
      .filter(
        (r) => !already.has(`${r.first_name.trim()}|${r.last_name.trim()}`.toLowerCase())
      )
      .map((r) => ({
        last_name: r.last_name,
        first_name: r.first_name,
        // One letter: the grid asks for an initial.
        middle_name: (r.middle_name ?? "").trim().charAt(0).toUpperCase(),
        q3_sex: r.gender === "Male" ? 1 : r.gender === "Female" ? 2 : null,
        q4_age: ageFrom(r.birthdate),
        q5_birth_month: r.birthdate ? Number(r.birthdate.slice(5, 7)) : null,
        q5_birth_year: r.birthdate ? Number(r.birthdate.slice(0, 4)) : null,
      }));

    /*
     * The head goes to line 1, and everybody else follows in the order the
     * form asks for. Whoever the register calls the head of this house is
     * the head on this sheet — dropping them into line 4 because that is
     * where the alphabet put them would contradict Q2 on their own line.
     */
    const headId = house.head?.id;
    const rest = [...typed, ...carried].filter(
      (mem) =>
        !headId ||
        `${mem.first_name}|${mem.last_name}`.toLowerCase() !==
          `${house.head!.first_name}|${house.head!.last_name}`.toLowerCase()
    );

    if (house.head) {
      const headName = `${house.head.last_name}, ${house.head.first_name}`;
      set("household_head_name", headName);

      // fillLineOneFrom owns line 1, so it is written the same way here as
      // it is when somebody types the name by hand.
      setMembers([{ ...BLANK_MEMBER }, ...rest]);
      fillLineOneFrom(headName);
    } else {
      setMembers(rest.length ? rest : [{ ...BLANK_MEMBER }]);
    }

    toast(
      carried.length
        ? `${carried.length} person(s) already on the register were carried onto the form.`
        : "Everyone on the register for this household is already on the form."
    );
  };
  /**
   * Which of the household's registered people are missing from the grid.
   *
   * By name, the same comparison the merge uses — a line typed by hand and a
   * resident record are the same person if the names match, and offering to
   * add somebody already on the sheet is how a household ends up on it
   * twice.
   */
  const missingFromSheet = (): NonNullable<HouseCheck["residents"]> => {
    const people = notOnSheet?.residents ?? [];

    const typed = new Set(
      members
        .filter((mem) => mem.first_name || mem.last_name)
        .map((mem) =>
          `${String(mem.first_name ?? "").trim()}|${String(mem.last_name ?? "").trim()}`.toLowerCase()
        )
    );

    return people.filter(
      (r) => !typed.has(`${r.first_name.trim()}|${r.last_name.trim()}`.toLowerCase())
    );
  };

  return {
    verifyHouse, continueHousehold, bringOntoForm, missingFromSheet,
  };
}

export type HouseholdMatchState = ReturnType<typeof useHouseholdMatch>;
