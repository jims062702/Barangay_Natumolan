import { useEffect, useRef, useState } from "react";
import { WELCOME } from "../lib/widgetCopy";
import { forgetChatLog, loadChatLog, LOG_DAY_MS, saveChatLog } from "../lib/chatLog";
import { continueLineIdsAfter, nextLineId } from "../lib/widgetIds";
import type { WidgetShellState } from "./useWidgetShell";

/**
 * The conversation with the chatbot, kept across a reload until its day is
 * up — see lib/chatLog.ts for how long, whose, and what is never written.
 *
 * `guestResetAt` is the server's word on when a guest's limit starts again
 * (epoch ms, 0 before it has said): a guest's conversation goes with it.
 */
export function useChatLog(shell: WidgetShellState, guestResetAt: number) {
  const { messages, setMessages, setThreadEpoch, sessionLoading, user } = shell;

  /* Whose conversation this is — not known while the session is still being checked. */
  const owner = sessionLoading ? null : user ? `user:${user.id}` : "guest";
  /* Whose conversation has been read back, and when it is to go. */
  const readFor = useRef<string | null>(null);
  const expiresAt = useRef(0);
  const [expiry, setExpiry] = useState(0);

  /*
   * WRITTEN AFTER EVERY CHANGE — and declared before the read below, on
   * purpose: on the render the owner becomes known, this runs first and
   * finds nothing read back yet, rather than writing the empty thread over
   * the kept one.
   */
  useEffect(() => {
    if (owner === null || readFor.current !== owner) return;

    const lines = messages.filter((m) => m.id !== WELCOME.id);
    if (lines.length === 0) {
      forgetChatLog();
      expiresAt.current = 0;
      setExpiry(0);
      return;
    }

    const now = Date.now();
    if (owner === "guest" && guestResetAt > now) expiresAt.current = guestResetAt;
    else if (expiresAt.current <= now) expiresAt.current = now + LOG_DAY_MS;
    setExpiry(expiresAt.current);
    saveChatLog(owner, expiresAt.current, lines);
  }, [messages, owner, guestResetAt]);

  /* Read back once the owner is known — and forgotten, not read, when it changes. */
  useEffect(() => {
    if (owner === null || readFor.current === owner) return;
    const first = readFor.current === null;
    readFor.current = owner;

    if (!first) {
      /* Signed in or out on this page: that conversation was somebody else's. */
      forgetChatLog();
      expiresAt.current = 0;
      setExpiry(0);
      setMessages([WELCOME]);
      setThreadEpoch((n) => n + 1);
      return;
    }

    const kept = loadChatLog(owner);
    if (!kept) return;

    expiresAt.current = kept.expiresAt;
    setExpiry(kept.expiresAt);
    continueLineIdsAfter(kept.messages);
    /* Anything already said on this page, while the session was being
       checked, follows what was kept — with ids of its own. */
    setMessages((now) => [
      WELCOME,
      ...kept.messages,
      ...now.filter((m) => m.id !== WELCOME.id).map((m) => ({ ...m, id: nextLineId() })),
    ]);
    setThreadEpoch((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);

  /* The day is up while the page is still open: it goes now, not on the next reload. */
  useEffect(() => {
    if (!expiry) return;
    const id = window.setTimeout(() => {
      forgetChatLog();
      expiresAt.current = 0;
      setExpiry(0);
      setMessages([WELCOME]);
      setThreadEpoch((n) => n + 1);
    }, Math.max(0, expiry - Date.now()));

    return () => window.clearTimeout(id);
  }, [expiry, setMessages, setThreadEpoch]);
}
