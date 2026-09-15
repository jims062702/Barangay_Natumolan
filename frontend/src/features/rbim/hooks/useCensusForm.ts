import { useCensusAnswers } from "./useCensusAnswers";
import { useCensusLoad } from "./useCensusLoad";
import { useCensusSubmit } from "./useCensusSubmit";
import { useHouseholdMatch } from "./useHouseholdMatch";

/**
 * The state and handlers of <CensusForm>, so its sections can share them.
 */
export function useCensusForm() {
  const answers = useCensusAnswers();
  useCensusLoad(answers);
  const submitting = useCensusSubmit(answers);
  const matching = useHouseholdMatch({ ...answers, ...submitting });

  return { ...answers, ...submitting, ...matching };
}

export type CensusFormState = ReturnType<typeof useCensusForm>;
