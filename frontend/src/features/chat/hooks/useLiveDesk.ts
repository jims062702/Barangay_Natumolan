import { useState, useRef, useEffect, type FormEvent } from "react";
import { playChatSound } from "../../../shared/lib/sound";
import { showDesktopNotification } from "../../../shared/lib/desktopNotify";
import { remembered, LIVE_KEY, remember, senderId } from "../lib/widgetMemory";
import { chatApi } from "../api";
import { LIVE_POLL_MS, RASA_URL } from "../lib/widgetCopy";
import { nextLineId } from "../lib/widgetIds";
import { publicApi } from "../../public/api";
import type { WidgetShellState } from "./useWidgetShell";
import type { ChatMessage as LiveMessage, PastConversation, WidgetMessage, RasaReply } from "../types";

/**
 * Talking to the assistant, and handing over to the Secretary: the queue, the live thread, ending it.
 */
export function useLiveDesk(ctx: WidgetShellState) {
  const {
    input, isResident, listRef, messages, open, sessionLoading, setInput, setMessages,
    setTyping, typing,
  } = ctx;

  /* ---- live agent ---- */
  // "form" is the short intro step; "live" is the running conversation.
  const [mode, setMode] = useState<"bot" | "form" | "live" | "signin">("bot");
  const [token, setToken] = useState<string | null>(() => remembered(LIVE_KEY));
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [liveStatus, setLiveStatus] = useState<"Waiting" | "Active" | "Closed">("Waiting");
  const [agentName, setAgentName] = useState<string | null>(null);
  const [firstMessage, setFirstMessage] = useState("");
  /*
   * Where they are in the line. One Secretary answers one person at a time,
   * so anyone who is not first is waiting behind somebody — and a wait with
   * no number on it is indistinguishable from a broken page.
   */
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [queueTotal, setQueueTotal] = useState(0);
  const [liveError, setLiveError] = useState("");
  const [starting, setStarting] = useState(false);
  /*
   * Conversations the desk has already resolved.
   *
   * Resolving one never deleted anything — but it dropped out of the
   * resident's view, and with it whatever they had been told: which office,
   * which day, what to bring. The desk can look a thread up whenever it
   * likes; the resident could not. So they are kept, and reachable.
   */
  const [past, setPast] = useState<PastConversation[]>([]);
  const [pastCount, setPastCount] = useState(0);
  // Used to ring only for genuinely new agent replies.
  const lastSeenId = useRef(0);
  useEffect(() => {
    // Keep the newest message in view.
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, liveMessages, typing, open, mode]);
  /** Pulls the live thread. Also runs once on mount to restore a session. */
  const refreshLive = async (activeToken: string) => {
    try {
      const response = await chatApi.conversation(activeToken);
      const { conversation, messages: thread } = response.data.data;
      setLiveMessages(thread);
      setLiveStatus(conversation.status);
      setAgentName(conversation.agent_name ?? null);
      setQueuePosition(conversation.queue_position ?? null);
      setQueueTotal(conversation.queue_total ?? 0);

      // Ring (and pop up, if tabbed away) for a reply that is actually new.
      const newest = [...thread].reverse().find((m: LiveMessage) => m.sender === "agent");
      if (newest && newest.id > lastSeenId.current) {
        if (lastSeenId.current !== 0) {
          playChatSound();
          if (document.hidden) {
            showDesktopNotification(
              newest.sender_name ?? "Barangay Secretary",
              newest.body,
              "bn-live-chat"
            );
          }
        }
        lastSeenId.current = newest.id;
      }
    } catch {
      // A token for a conversation that no longer exists — drop it and fall
      // back to the bot rather than polling a dead endpoint forever.
      remember(LIVE_KEY, null);
      setToken(null);
      setMode("bot");
    }
  };
  /*
   * Restore an unfinished conversation — from the ACCOUNT first.
   *
   * The token lives in one browser. Starting on a laptop and opening the
   * phone used to lose the thread, and with it whatever the Secretary had
   * already answered. The account is the durable handle now.
   */
  useEffect(() => {
    // Wait for the answer before acting on it.
    if (sessionLoading) return;

    if (!isResident) {
      // Signed out: nothing of theirs to restore, and the desk is closed to
      // them until they sign back in.
      if (mode === "live") setMode("bot");
      return;
    }

    void chatApi.mine()
      .then((response) => {
        const { session_token, conversation, messages: thread, past_conversations }
          = response.data.data;

        setPastCount(past_conversations ?? 0);

        if (!conversation) return;

        remember(LIVE_KEY, session_token);
        setToken(session_token);
        setLiveMessages(thread ?? []);
        setLiveStatus(conversation.status);
        setAgentName(conversation.agent_name ?? null);
        setQueuePosition(conversation.queue_position ?? null);
        setQueueTotal(conversation.queue_total ?? 0);
        setMode("live");
      })
      .catch(() => {
        // No conversation, or the desk is unreachable — the bot still works.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResident, sessionLoading]);
  // Poll while the panel is open and the conversation is still running.
  useEffect(() => {
    if (mode !== "live" || !token || !open || liveStatus === "Closed") return;
    const id = setInterval(() => void refreshLive(token), LIVE_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token, open, liveStatus]);
  /** Ask Rasa first; if it is unreachable, use the built-in assistant. */
  const askBot = async (text: string): Promise<WidgetMessage[]> => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(`${RASA_URL}/webhooks/rest/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: senderId(), message: text }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) throw new Error("Rasa unavailable");
      const replies: RasaReply[] = await response.json();
      if (replies.length === 0) {
        return [
          {
            id: nextLineId(),
            from: "bot",
            text: "Sorry, I did not catch that. Could you say it another way?",
            // A bot that cannot answer should offer the person who can.
            buttons: [{ title: "Talk to the Secretary", payload: "__live__" }],
          },
        ];
      }
      return replies.map((reply) => ({
        id: nextLineId(),
        from: "bot" as const,
        text: reply.text ?? "",
        buttons: reply.buttons,
      }));
    } catch {
      // Rasa offline — fall back to the built-in service-guide assistant.
      try {
        const response = await publicApi.askAssistant({ message: text });
        return [{ id: nextLineId(), from: "bot", text: response.data.data.answer }];
      } catch {
        return [
          {
            id: nextLineId(),
            from: "bot",
            text:
              "I cannot reach the assistant right now. Please try again in a moment, " +
              "or visit the Barangay Main Office (Mon–Fri, 8:00 AM–5:00 PM).",
            buttons: [{ title: "Talk to the Secretary", payload: "__live__" }],
          },
        ];
      }
    }
  };
  const send = async (text: string, display?: string) => {
    const clean = text.trim();
    if (!clean || typing) return;

    // The handoff button is a payload, not a question for the bot.
    if (clean === "__live__") {
      startHandoff();
      return;
    }

    setMessages((prev) => [...prev, { id: nextLineId(), from: "user", text: display ?? clean }]);
    setInput("");
    setTyping(true);
    const replies = await askBot(clean);
    setTyping(false);
    setMessages((prev) => [...prev, ...replies]);
    // Soft pop when the assistant replies (like an incoming message).
    playChatSound();
    // If the user tabbed away while waiting, show a desktop popup so they
    // know the assistant answered.
    if (document.hidden) {
      const reply = replies.find((r) => r.text)?.text ?? "The assistant replied to your message.";
      showDesktopNotification("Natumolan Assistant", reply, "bn-chat");
    }
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "live") {
      void sendLive();
      return;
    }
    void send(input);
  };
  /**
   * Opens the step before queueing for the Secretary.
   *
   * A signed-out visitor is stopped here rather than at the end: filling in a
   * message and only then being told to sign in is how a person gives up.
   */
  const startHandoff = () => {
    setLiveError("");

    if (!isResident) {
      setMode("signin");
      return;
    }

    // Carry the last thing they typed into the form — it is usually the thing
    // they wanted a human for, and retyping it is a small insult.
    const lastUser = [...messages].reverse().find((m) => m.from === "user");
    setFirstMessage(lastUser?.text ?? "");
    setMode("form");
  };
  const startLive = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firstMessage.trim()) return;
    setStarting(true);
    setLiveError("");
    try {
      // No name, no email: the account already carries both, and asking a
      // resident to retype what the barangay registered them with is the
      // kind of small insult that makes people give up on a form.
      const response = await chatApi.start({
        message: firstMessage.trim(),
      });
      const { session_token, conversation } = response.data.data;
      remember(LIVE_KEY, session_token);
      setToken(session_token);
      setLiveStatus(conversation.status);
      setQueuePosition(conversation.queue_position ?? null);
      setQueueTotal(conversation.queue_total ?? 0);
      setMode("live");
      lastSeenId.current = 0;
      await refreshLive(session_token);
    } catch {
      setLiveError("We could not reach the barangay just now. Please try again in a moment.");
    } finally {
      setStarting(false);
    }
  };
  const sendLive = async () => {
    const body = input.trim();
    if (!body || !token) return;
    setInput("");
    // Show it straight away; the poll will replace it with the stored row.
    setLiveMessages((prev) => [
      ...prev,
      { id: -Date.now(), sender: "visitor", body, created_at: new Date().toISOString() },
    ]);
    try {
      await chatApi.sendMessage(token, { body });
      await refreshLive(token);
    } catch {
      setLiveError("That message did not send. Check your connection and try again.");
    }
  };
  const endLive = async () => {
    if (token) {
      try {
        await chatApi.endConversation(token);
      } catch {
        /* closing is best-effort — the local session ends either way */
      }
    }
    remember(LIVE_KEY, null);
    setToken(null);
    setLiveMessages([]);
    setAgentName(null);
    setLiveStatus("Waiting");
    lastSeenId.current = 0;
    setMode("bot");
  };
  const headerSubtitle =
    mode === "live"
      ? liveStatus === "Closed"
        ? "Conversation ended"
        : agentName
          ? `${agentName} is with you`
          : "Waiting for the Barangay Secretary…"
      : mode === "form"
        ? "Connecting you to a person"
        : mode === "signin"
          ? "Sign in to reach the Secretary"
          : "Online — ask me anything";

  return {
    mode, setMode, token, setToken, liveMessages, setLiveMessages, liveStatus, setLiveStatus,
    agentName, setAgentName, firstMessage, setFirstMessage, queuePosition, setQueuePosition,
    queueTotal, setQueueTotal, liveError, setLiveError, starting, setStarting, past, setPast,
    pastCount, setPastCount, lastSeenId, refreshLive, askBot, send, handleSubmit, startHandoff,
    startLive, sendLive, endLive, headerSubtitle,
  };
}

export type LiveDeskState = ReturnType<typeof useLiveDesk>;
