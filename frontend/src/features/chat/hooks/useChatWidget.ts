import { useWidgetShell } from "./useWidgetShell";
import { useLauncherHint } from "./useLauncherHint";
import { useLiveDesk } from "./useLiveDesk";
import { useCertificateRequest } from "./useCertificateRequest";
import { usePastConversations } from "./usePastConversations";
import { useChatLog } from "./useChatLog";

/**
 * The state and handlers of <ChatWidget>, so its sections can share them.
 */
export function useChatWidget() {
  const shell = useWidgetShell();
  const launcher = useLauncherHint(shell);
  const live = useLiveDesk(shell);
  const request = useCertificateRequest({ ...shell, ...live });
  const history = usePastConversations(live);
  /* The conversation, kept across a reload for as long as the guest limit's day. */
  useChatLog(shell, live.guestResetAt);

  return { ...shell, ...launcher, ...live, ...request, ...history };
}

export type ChatWidgetState = ReturnType<typeof useChatWidget>;
