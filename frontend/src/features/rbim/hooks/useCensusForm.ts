import { useCensusAnswers } from "./useCensusAnswers";
import { useCensusAutosave } from "./useCensusAutosave";
import { useCensusLoad } from "./useCensusLoad";
import { useCensusSubmit } from "./useCensusSubmit";
import { useHouseholdMatch } from "./useHouseholdMatch";

/**
 * The state and handlers of <CensusForm>, so its sections can share them.
 */
export function useCensusForm() {
  const answers = useCensusAnswers();
  const loading = useCensusLoad(answers);
  const submitting = useCensusSubmit(answers);
  const matching = useHouseholdMatch({ ...answers, ...submitting });
  /* The form saves itself as a draft while it is typed. */
  useCensusAutosave({ ...answers, ...submitting, ...loading });

  return { ...answers, ...submitting, ...matching, ...loading };
}

export type CensusFormState = ReturnType<typeof useCensusForm>;
