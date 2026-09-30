import { useState, useRef } from "react";
import { useAuth } from "../../../shared/auth/AuthContext";
import { useSoundMuted } from "../../../shared/hooks/useSoundMuted";
import { WELCOME } from "../lib/widgetCopy";
import { EXPANDED_KEY, remember, remembered, takeReopen } from "../lib/widgetMemory";
import type { WidgetMessage } from "../types";

/**
 * The widget itself: open or closed, the thread, the box being typed in, and who is signed in.
 */
export function useWidgetShell() {

  /* Open on arrival only when somebody left the chat to sign in and has
     come back — see REOPEN_KEY. */
  const [open, setOpen] = useState(takeReopen);
  const [messages, setMessages] = useState<WidgetMessage[]>([WELCOME]);
  /* Counts the times the whole thread was replaced — read back from the
     device, or forgotten — which the scroll treats as a fresh start. */
  const [threadEpoch, setThreadEpoch] = useState(0);
  /* The bigger panel, for a screen with room for it — remembered, like the sound. */
  const [expanded, setExpandedState] = useState(() => remembered(EXPANDED_KEY) === "1");
  const setExpanded = (next: boolean) => {
    setExpandedState(next);
    remember(EXPANDED_KEY, next ? "1" : null);
  };
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  /*
   * The live desk is for registered residents. The BOT above it is not — a
   * stranger asking what an indigency certificate needs still gets an answer,
   * they just cannot take up the Clerk's only chair to ask it.
   */
  const { user, loading: sessionLoading } = useAuth();
  // Not yet known is not the same as "not a resident". Deciding while the
  // session is still being verified made the widget drop a running chat
  // back to the bot on every fresh page load.
  const isResident = !sessionLoading && user?.role === "Resident";
  /*
   * Nobody signed in: the guest question limit applies. A signed-in staff
   * member reading the public site is not a guest — the office is accountable
   * for its own accounts, and "log in as a resident" is not something they
   * can do.
   */
  const isGuest = !sessionLoading && !user;
  const [muted, toggleMuted] = useSoundMuted();
  const listRef = useRef<HTMLDivElement | null>(null);

  return {
    open, setOpen, expanded, setExpanded, messages, setMessages, threadEpoch, setThreadEpoch, input, setInput,
    typing, setTyping, user,
    sessionLoading, isResident, isGuest, muted, toggleMuted, listRef,
  };
}

export type WidgetShellState = ReturnType<typeof useWidgetShell>;
