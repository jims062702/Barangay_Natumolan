import { useState, useRef } from "react";
import { useAuth } from "../../../shared/auth/AuthContext";
import { useSoundMuted } from "../../../shared/hooks/useSoundMuted";
import { WELCOME } from "../lib/widgetCopy";
import type { WidgetMessage } from "../types";

/**
 * The widget itself: open or closed, the thread, the box being typed in, and who is signed in.
 */
export function useWidgetShell() {

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  /*
   * The live desk is for registered residents. The BOT above it is not — a
   * stranger asking what an indigency certificate needs still gets an answer,
   * they just cannot take up the Secretary's only chair to ask it.
   */
  const { user, loading: sessionLoading } = useAuth();
  // Not yet known is not the same as "not a resident". Deciding while the
  // session is still being verified made the widget drop a running chat
  // back to the bot on every fresh page load.
  const isResident = !sessionLoading && user?.role === "Resident";
  const [muted, toggleMuted] = useSoundMuted();
  const listRef = useRef<HTMLDivElement | null>(null);

  return {
    open, setOpen, messages, setMessages, input, setInput, typing, setTyping, user,
    sessionLoading, isResident, muted, toggleMuted, listRef,
  };
}

export type WidgetShellState = ReturnType<typeof useWidgetShell>;
