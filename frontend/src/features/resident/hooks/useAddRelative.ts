import { useRelativeBatch } from "./useRelativeBatch";
import { useRelativeDraft } from "./useRelativeDraft";
import { useRelativeSave } from "./useRelativeSave";
import type { AddRelativeProps } from "../components/addRelative/types";

/**
 * The state and handlers of <AddRelativeModal>, so its sections can share them.
 */
export function useAddRelative({ open, relation, resident, onClose, onSaved }: AddRelativeProps) {
  const batch = useRelativeBatch({ open, relation, resident, onClose, onSaved });
  const draft = useRelativeDraft({ open, relation, resident, onClose, onSaved, ...batch });
  const saveFlow = useRelativeSave({ open, relation, resident, onClose, onSaved, ...batch, ...draft });

  return { ...batch, ...draft, ...saveFlow };
}

export type AddRelativeState = ReturnType<typeof useAddRelative>;
