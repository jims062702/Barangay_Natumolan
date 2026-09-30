import { useState, useRef, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { playChatSound } from "../../../shared/lib/sound";
import { showDesktopNotification } from "../../../shared/lib/desktopNotify";
import { remembered, LIVE_KEY, remember, REOPEN_KEY, rememberPending, takePending } from "../lib/widgetMemory";
import { chatApi } from "../api";
import { nextLineId } from "../lib/widgetIds";
import { CHAT_CONFIG } from "../lib/chatConfig";
import { describeLongWait, describeWhen, looksLikeGibberish } from "../lib/chatGuard";
import { askAssistant, OFFLINE_REPLY } from "../lib/assistant";
import { EMERGENCY_NOTE, looksLikeEmergency } from "../lib/emergency";
import { isSensitive } from "../lib/chatLog";
import { useChatGuard, type Outcome } from "./useChatGuard";
import { asksAboutComplaint, complaintAnswer, complaintFormPath } from "../lib/complaintIntent";
import type { WidgetShellState } from "./useWidgetShell";
import type { ChatMessage as LiveMessage, PastConversation, WidgetMessage } from "../types";

/**
 * Talking to the assistant, and handing over to the Clerk: the queue, the live thread, ending it.
 */
export function useLiveDesk(ctx: WidgetShellState) {
  const {
    input, isResident, isGuest, listRef, messages, open, sessionLoading, setInput, setMessages,
    setTyping, typing, setOpen, threadEpoch,
  } = ctx;
  const navigate = useNavigate();

  /* ---- live agent ---- */
  // "form" is the short intro step; "live" is the running conversation.
  const [mode, setMode] = useState<"bot" | "form" | "live" | "signin">("bot");
  const [token, setToken] = useState<string | null>(() => remembered(LIVE_KEY));
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [liveStatus, setLiveStatus] = useState<"Waiting" | "Active" | "Closed">("Waiting");
  const [agentName, setAgentName] = useState<string | null>(null);
  const [firstMessage, setFirstMessage] = useState("");
  /*
   * Where they are in the line. The Clerk takes people in the order they
   * came, so anyone not yet answered is waiting behind somebody — and a wait
   * with no number on it is indistinguishable from a broken page.
   */
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [queueTotal, setQueueTotal] = useState(0);
  /* When the conversation closes by itself if they do not reply to the Clerk. */
  const [closesAt, setClosesAt] = useState<string | null>(null);
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
  /* Every limit the chatbot keeps — see useChatGuard. */
  const guard = useChatGuard(isGuest);

  /**
   * The complaint form, for whoever is asking: the portal's own page for a
   * signed-in resident (it does not ask who they are), the public one for
   * anybody else. The panel closes so the form is not behind it.
   */
  const openComplaintForm = () => {
    setOpen(false);
    navigate(complaintFormPath(isResident));
  };
  /* The VAWC Online Complaint — the portal's for a signed-in resident, the public one otherwise. */
  const openVawcForm = () => {
    setOpen(false);
    navigate(isResident ? "/resident/vawc-report" : "/vawc-complaint");
  };
  /* A guest asks for a certificate with their Resident ID, on its own page. */
  const openCertificatePage = () => {
    setOpen(false);
    navigate("/request-certificate");
  };
  /*
   * WHERE THE THREAD IS SCROLLED TO (2026-09-29).
   *
   * Opened, it starts at the TOP — the welcome, and the conversation from
   * its beginning. It used to jump to the bottom every time the panel
   * opened, so the first thing anybody saw was the end of the last answer,
   * and they had to scroll up to find where it began.
   *
   * A new message brings the newest turn into view from its START — the
   * question just asked and as much of the answer under it as fits —
   * rather than the bottom of the answer, which on a long one is its last
   * line. Nothing new, nothing moves: the live thread is refreshed every few
   * seconds, and a refresh must not pull away somebody reading further up.
   */
  const scrolled = useRef({ view: "", lines: 0, anchor: -1, typing: false });
  useEffect(() => {
    const list = listRef.current;
    const at = scrolled.current;
    if (!open || !list) {
      at.view = "";
      return;
    }
    const lines = list.querySelectorAll<HTMLElement>("[data-chat-line]");
    const toLine = (index: number) => {
      const line = lines[index];
      if (!line) return;
      const top = list.scrollTop + line.getBoundingClientRect().top - list.getBoundingClientRect().top - 12;
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      list.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
    };

    const view = `${mode}:${threadEpoch}`;
    if (at.view !== view) {
      /* Just opened, another conversation, or the kept one read back: from the top. */
      Object.assign(at, { view, lines: lines.length, anchor: -1, typing });
      list.scrollTop = 0;
      return;
    }

    if (lines.length > at.lines) {
      /* The first new line — or, when it answers the person's own message just above it, that message. */
      let first = at.lines;
      const before = lines[first - 1]?.dataset.from;
      if (first > 0 && (before === "user" || before === "visitor")) first -= 1;
      Object.assign(at, { lines: lines.length, anchor: first, typing });
      toLine(first);
      return;
    }

    at.lines = lines.length;
    /* "Typing…" came or went under the turn in view: keep that turn where it was, with the dots under it. */
    if (typing !== at.typing) {
      at.typing = typing;
      if (at.anchor >= 0) toLine(at.anchor);
    }
  }, [messages, liveMessages, typing, open, mode, threadEpoch]);
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
      setClosesAt(conversation.closes_at ?? null);

      // Ring (and pop up, if tabbed away) for a reply that is actually new.
      const newest = [...thread].reverse().find((m: LiveMessage) => m.sender === "agent");
      if (newest && newest.id > lastSeenId.current) {
        if (lastSeenId.current !== 0) {
          playChatSound();
          if (document.hidden) {
            showDesktopNotification(
              newest.sender_name ?? "Barangay Clerk",
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
   * phone used to lose the thread, and with it whatever the Clerk had
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
      setClosesAt(conversation.closes_at ?? null);
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
    const id = setInterval(() => void refreshLive(token), CHAT_CONFIG.livePollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token, open, liveStatus]);
  /** Kept for callers that only want the replies. */
  const askBot = async (text: string): Promise<WidgetMessage[]> => (await askAssistant(text)).replies;

  /* Sending is held while a question is in flight. A ref and not the
     `typing` state: two Enters in the same instant both read the old state,
     and both would have gone. The ref is set before the first await. */
  const inFlight = useRef(false);

  /** A line from the chatbot about the chat itself, not an answer. */
  const note = (text: string, buttons?: WidgetMessage["buttons"]): WidgetMessage => ({
    id: nextLineId(), from: "bot", text, buttons,
  });

  /* Says when the limit lifts — like "Try again in 15 seconds" does for a
     cooldown — as well as the way round it now. */
  const guestLimitNote = (resetAt: number) => note(
    `You’ve reached today’s guest chat limit (${guard.guestLimit} messages). Please log in as a `
      + "registered resident to continue chatting with the Barangay Natumolan chatbot."
      + (resetAt > Date.now()
        ? `\n\nAs a guest, you can chat again in ${describeLongWait(resetAt - Date.now())} `
          + `(${describeWhen(resetAt)}).`
        : ""),
    [{ title: "Login as Resident", payload: "__login__" }],
  );

  /** The question, said back with the way to get its answer: signing in. */
  const loginToAsk = (shown: string) => note(
    `To get an answer to “${shown}”, please log in as a registered resident — `
      + "I’ll answer it as soon as you’re back.",
    [{ title: "Login as Resident", payload: "__login__" }],
  );

  /**
   * Sign in as a resident, and come back to the chatbot afterwards.
   *
   * The existing sign-in page, not a second one. It lands a resident on
   * their portal, where the chat is mounted too; a flag — never the
   * conversation itself — asks it to open again when they get there.
   */
  const goSignIn = () => {
    remember(REOPEN_KEY, "1");
    setOpen(false);
    navigate("/login");
  };

  /**
   * THE ONE WAY A QUESTION IS ASKED.
   *
   * The box, Enter, a suggested question, a button under an answer — every
   * one of them ends here, so each passes the same checks in the same order:
   * the lock, the holds, the rate limit, the unclear check, the repeat check,
   * the guest count (the server's), and only then the chatbot. See
   * useChatGuard.
   */
  const send = async (text: string, display?: string) => {
    /* The box stops at the limit already; this is for a payload or anything
       else that reaches here without passing through it. */
    const clean = text.trim().slice(0, CHAT_CONFIG.maxMessageLength);
    if (!clean) return;

    /* Going somewhere is not asking anything, and none of these waits: a
       person the chatbot cannot help is exactly who should reach the Clerk,
       the complaint form, or the sign-in page. */
    if (clean === "__live__") { startHandoff(); return; }
    if (clean === "__complaint__") { openComplaintForm(); return; }
    if (clean === "__vawc__") { openVawcForm(); return; }
    if (clean === "__certificate__") { openCertificatePage(); return; }
    if (clean === "__login__") { goSignIn(); return; }

    if (inFlight.current) return;

    const held = guard.hold(isGuest);
    if (held.reason === "guest") {
      /*
       * A suggestion pressed after the limit.
       *
       * It used to do nothing at all once the limit's note was on screen —
       * the note was not repeated, so nothing appeared, and the buttons
       * looked broken. Now the question is said back with the way to get
       * its answer, and it is answered as soon as they are signed in.
       * Nothing is asked of the chatbot here: the limit still holds.
       *
       * The same one pressed twice in a row is not said twice.
       */
      const shown = display ?? clean;
      rememberPending({ question: clean, display: shown });
      const unsaved = isSensitive(clean, shown) || undefined;
      setMessages((prev) => {
        const lastUser = [...prev].reverse().find((m) => m.from === "user");
        if (lastUser?.text === shown && prev[prev.length - 1]?.from === "bot") return prev;

        return [
          ...prev,
          ...[
            { id: nextLineId(), from: "user" as const, text: shown },
            /* A limit is for spam. Somebody in danger is told where help is first. */
            ...(looksLikeEmergency(clean) ? [note(EMERGENCY_NOTE, [{ title: "Talk to Clerk", payload: "__live__" }])] : []),
            loginToAsk(shown),
          ].map((line) => ({ ...line, unsaved })),
        ];
      });
      return;
    }
    if (held.reason) return;

    inFlight.current = true;
    /*
     * About violence or danger: the question and every answer to it are
     * shown, and never written to the device — see lib/chatLog.ts.
     */
    const unsaved = isSensitive(clean, display) || undefined;
    setMessages((prev) => [...prev, { id: nextLineId(), from: "user", text: display ?? clean, unsaved }]);
    setInput("");

    let replies: WidgetMessage[];
    let outcome: Outcome;
    /* The server's receipt for a guest's counted message, to hand it back if
       the chatbot turns out to be unreachable. */
    let receipt = "";

    try {
      const admission = guard.admit(clean);

      /*
       * A GUEST'S MESSAGE IS COUNTED BY THE SERVER FIRST — a question, and
       * spam alike. Refused there, it goes nowhere: today's are used up
       * (whatever this page thought), or the count could not be asked.
       */
      let guestRefused: "limit" | "unreachable" | null = null;
      let guestResetsAt = 0;
      if (isGuest && (admission === "ok" || admission === "unclear")) {
        setTyping(true);
        const taken = await guard.takeGuest();
        if (taken.ok) receipt = taken.receipt;
        else {
          guestRefused = taken.reason;
          if (taken.reason === "limit") guestResetsAt = taken.resetsAt;
        }
      }

      switch (guestRefused ?? admission) {
        case "limit":
          /* Words, not spam: asked again as soon as they are signed in. */
          if (!looksLikeGibberish(clean)) rememberPending({ question: clean, display: display ?? clean });
          replies = [looksLikeGibberish(clean)
            ? guestLimitNote(guestResetsAt)
            : loginToAsk(display ?? clean)];
          outcome = "rejected";
          break;
        case "unreachable":
          replies = [note(OFFLINE_REPLY)];
          outcome = "failed";
          break;
        case "too-fast":
          replies = [note("You’re sending messages too quickly. Please wait a moment before sending another message.")];
          outcome = "rejected";
          break;
        case "duplicate":
          replies = [note("It looks like you already asked this question. Please check the previous answer above "
            + "or choose one of the suggested questions below.")];
          outcome = "rejected";
          break;
        case "duplicate-final":
          replies = [note("You’ve sent several similar messages. Please wait a moment before sending another "
            + "message or choose one of the suggested questions below.")];
          outcome = "rejected";
          break;
        case "unclear":
          /* Answered here: Rasa would only say the same, a request later. */
          replies = [note("I’m sorry, I could not understand your question. Please try asking about a Barangay "
            + "service, office, certificate, clearance, health service, VAWC concern, or Katarungang Pambarangay.")];
          outcome = "unclear";
          break;
        default:
          if (asksAboutComplaint(clean)) {
            /* The same answer whether Rasa is up or not — see
               lib/complaintIntent.ts. The VAWC check is inside it. */
            const answer = complaintAnswer(clean, isResident);
            replies = [note(answer.text, answer.buttons)];
            outcome = "answered";
          } else {
            setTyping(true);
            const asked = await askAssistant(clean);
            replies = asked.replies;
            outcome = asked.outcome;
          }
      }
    } catch {
      /* Nothing above should throw; if something does, the person still gets
         a sentence and a working chat rather than a frozen one. */
      replies = [note(OFFLINE_REPLY)];
      outcome = "failed";
    } finally {
      setTyping(false);
    }

    /* Counted, and then nothing could answer it: not the person's fault, so
       it is not theirs to lose. */
    if (outcome === "failed" && receipt) await guard.returnGuest(receipt);

    /* Danger comes first, whatever else was said — see lib/emergency.ts.
       Even a message refused as a repeat or as too fast gets it: the limits
       are for spam, and somebody in danger may well type the same thing
       twice. */
    if (looksLikeEmergency(clean)) {
      replies = [note(EMERGENCY_NOTE, [{ title: "Talk to Clerk", payload: "__live__" }]), ...replies];
    }

    const after = guard.settle(clean, outcome, isGuest);
    const { pauseMs, strikesAllowed } = CHAT_CONFIG.unclear;

    /* A guest whose day just ran out is told that, and only that: a
       two-minute break is beside the point until tomorrow. */
    if (after.guestLimitReached) {
      replies = [...replies, guestLimitNote(after.guestResetAt)];
    } else if (after.paused) {
      replies = [...replies, note(
        `I could not understand the last ${strikesAllowed} messages, so the chat is taking a short break. `
          + `You can ask again in ${pauseMs / 60000} minutes.\n\n`
          + "If you need help now, the Barangay Clerk can take it from here.",
        [{ title: "Talk to Clerk", payload: "__live__" }],
      )];
    } else if (after.warnLeft > 0) {
      replies = [...replies, note(
        `I am having trouble understanding. ${after.warnLeft} more unclear `
          + `${after.warnLeft === 1 ? "message" : "messages"} and the chat will pause for `
          + `${pauseMs / 60000} minutes.`,
      )];
    }

    setMessages((prev) => [...prev, ...(unsaved ? replies.map((reply) => ({ ...reply, unsaved })) : replies)]);
    inFlight.current = false;

    // Soft pop when the assistant replies (like an incoming message).
    playChatSound();
    // If the user tabbed away while waiting, show a desktop popup so they
    // know the assistant answered.
    if (document.hidden) {
      const reply = replies.find((r) => r.text)?.text ?? "The assistant replied to your message.";
      showDesktopNotification("Natumolan Assistant", reply, "bn-chat");
    }
  };
  /*
   * The question a guest pressed after their limit, answered now that they
   * are back as a resident — once, and only once the session is known, so a
   * page still checking who is signed in does not ask it as a guest.
   */
  useEffect(() => {
    if (sessionLoading || !isResident || !open || mode !== "bot") return;
    const pending = takePending();
    if (pending) void send(pending.question, pending.display);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, isResident, open, mode]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "live") {
      void sendLive();
      return;
    }
    void send(input);
  };
  /**
   * Opens the step before queueing for the Clerk.
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
      setClosesAt(conversation.closes_at ?? null);
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
          : "Waiting for the Barangay Clerk…"
      : mode === "form"
        ? "Connecting you to a person"
        : mode === "signin"
          ? "Sign in to reach the Clerk"
          : "Online — ask me anything";

  return {
    mode, setMode, token, setToken, liveMessages, setLiveMessages, liveStatus, setLiveStatus,
    agentName, setAgentName, firstMessage, setFirstMessage, queuePosition, setQueuePosition,
    queueTotal, setQueueTotal, closesAt, liveError, setLiveError, starting, setStarting, past, setPast,
    pastCount, setPastCount, lastSeenId, refreshLive, askBot, send, handleSubmit, startHandoff,
    startLive, sendLive, endLive, headerSubtitle,
    /** Why the chatbot is not taking a question right now, if it is not. */
    hold: guard.hold(isGuest),
    guestResetAt: guard.guestResetAt,
    cooldownWhy: guard.cooldownWhy,
    guestLeft: guard.guestLeft,
    openComplaintForm,
    openVawcForm,
    openCertificatePage,
    goSignIn,
  };
}

export type LiveDeskState = ReturnType<typeof useLiveDesk>;
