import NeedsConnection, { useNeedsConnection } from "../../../shared/offline/NeedsConnection";
import { useEffect, useRef, useState } from "react";
import { FiCheckCircle, FiCornerUpLeft, FiUser } from "react-icons/fi";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { useAuth } from "../../../shared/auth/AuthContext";
import { confirmAction } from "../../../shared/lib/confirm";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { playNotificationSound } from "../../../shared/lib/sound";
import Card from "../../../shared/ui/Card";
import PageHeader from "../../../shared/ui/PageHeader";
import StatusBadge from "../../../shared/ui/StatusBadge";
import { RowsSkeleton } from "../../../shared/ui/Skeleton";
import ShortcutComposer, { type Shortcut } from "../components/ShortcutComposer";
import { chatApi } from "../api";
import type { ChatConversation, ChatMessage } from "../types";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

/**
 * The live chat desk — the Barangay Clerk's page.
 *
 * A two-pane inbox: everyone waiting on the left, the open conversation on the
 * right. It refreshes on a timer rather than a socket, matching the widget on
 * the public site.
 *
 * AS MANY CONVERSATIONS AT ONCE AS COME IN (2026-09-30). The Clerk takes
 * whoever is waiting and moves between them; each keeps its own half-written
 * reply, so switching never sends one resident's answer to another. A
 * conversation the resident stopped answering closes by itself a day after
 * the last reply — the thread says when.
 */

/** Faster than the usual staff cadence: someone is sitting there waiting. */
const THREAD_POLL_MS = 4000;

const timeOf = (value?: string | null) =>
  value ? new Date(value).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) : "";

/** "Oct 1, 3:15 PM" — when, in the barangay's own time. */
const whenOf = (value: string) =>
  new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

/** "3m ago" — how long this person has been waiting, at a glance. */
function waitedFor(since?: string | null): string {
  if (!since) return "";
  const minutes = Math.floor((Date.now() - new Date(since).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function LiveChat() {
  const { offline, noteOffline } = useNeedsConnection();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [filter, setFilter] = useState<"open" | "mine" | "Waiting" | "Closed">("open");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [active, setActive] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  /*
   * A half-written reply PER CONVERSATION. With one box shared by every
   * thread, a reply started for one resident and a click on another sent
   * the first resident's answer to the second.
   */
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  /* The thread on screen, for answers that arrive after the Clerk has moved on. */
  const shownId = useRef<number | null>(null);
  /*
   * The canned answers behind @certificate/… and @officials/…. Fetched once
   * per visit rather than per keystroke: the roster and the service guides
   * change a few times a year, and the desk needs the menu to open instantly.
   */
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();
  const threadRef = useRef<HTMLDivElement | null>(null);
  // Rings only when the number of people waiting goes UP.
  const waitingRef = useRef<number | null>(null);
  // …or when a resident this Clerk is with writes in a thread not on screen.
  const unreadRef = useRef<number | null>(null);

  const loadList = async () => {
    try {
      const response = await chatApi.deskConversations({ params: { status: filter } });
      const rows: ChatConversation[] = response.data.data.data ?? [];
      setConversations(rows);

      const waiting = rows.filter((c) => c.status === "Waiting").length;
      const unread = rows
        .filter((c) => c.status === "Active" && c.assigned_to === user?.id && c.id !== shownId.current)
        .reduce((sum, c) => sum + (c.unread ?? 0), 0);
      if (
        (waitingRef.current !== null && waiting > waitingRef.current)
        || (unreadRef.current !== null && unread > unreadRef.current)
      ) {
        playNotificationSound();
      }
      waitingRef.current = waiting;
      unreadRef.current = unread;
      pageLoad.done();
    } catch (err) {
      /* The desk is never read from a copy on this device — see NeedsConnection. */
      noteOffline(err);
      /* No line: the desk, with the notice that says why it is empty. Any
         other failure ends the skeleton with the reason. */
      if (!(err as { response?: unknown })?.response) pageLoad.done();
      else pageLoad.fail(err);
    } finally {
      setLoading(false);
    }
  };

  /*
   * Loaded once, not per keystroke. A menu that waits on the network
   * every time the Clerk presses @ is slower than typing the answer,
   * which would defeat the whole point of having it.
   */
  useEffect(() => {
    void chatApi.shortcuts()
      .then((response) => setShortcuts(response.data.data ?? []))
      // A desk that cannot reach the guides can still reply by hand.
      .catch(() => setShortcuts([]));
  }, []);

  const loadThread = async (id: number) => {
    try {
      const response = await chatApi.deskConversation(id);
      /* The Clerk may have opened another thread while this was on its way:
         an answer for the old one must not fill the new one's pane — the
         reply box sends to whichever conversation is on screen. */
      if (shownId.current !== id) return;
      setActive(response.data.data.conversation);
      setMessages(response.data.data.messages);
    } catch (err) {
      if (shownId.current === id) toast(errorMessage(err), "error");
    }
  };

  useEffect(() => {
    setLoading(true);
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  /* The ones this staff member is in the middle of. */
  const isMine = (c: ChatConversation) => c.status === "Active" && c.assigned_to === user?.id;
  const handling = conversations.filter(isMine).length;

  // The list keeps up on its own so a new visitor appears without a refresh —
  // as fast as the open thread while the Clerk is with people, since a reply
  // in any of their other threads shows up here first.
  useAutoRefresh(() => void loadList(), handling > 0 ? THREAD_POLL_MS : REFRESH.staff, { evenWhenHidden: true });

  // The open conversation refreshes faster — someone is waiting on the reply.
  useEffect(() => {
    if (!activeId) return;
    void loadThread(activeId);
    const id = setInterval(() => void loadThread(activeId), THREAD_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  /* To the newest line when there IS a newer line, or another thread — not on
     every refresh, which pulled the Clerk down from whatever they were reading. */
  const lastLine = messages[messages.length - 1]?.id ?? null;
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [lastLine, activeId]);

  const open = (conversation: ChatConversation) => {
    shownId.current = conversation.id;
    setActiveId(conversation.id);
    setActive(conversation);
    setMessages([]);
  };

  const reply = active ? drafts[active.id] ?? "" : "";
  const setReply = (id: number, value: string) => setDrafts((all) => ({ ...all, [id]: value }));

  const claim = async () => {
    if (!active) return;
    try {
      const response = await chatApi.claimConversation(active.id);
      setActive(response.data.data);
      toast(response.data.message);
      await Promise.all([loadList(), loadThread(active.id)]);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const send = async () => {
    if (!active) return;
    const to = active.id;
    const body = (drafts[to] ?? "").trim();
    if (!body) return;
    setSending(true);
    try {
      await chatApi.reply(to, { body });
      setReply(to, "");
      await Promise.all([loadThread(to), loadList()]);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    if (!active) return;
    if (
      !(await confirmAction({
        title: "Close this conversation?",
        text: `${active.visitor_name} will be told it has been resolved.`,
        confirmText: "Yes, close it",
      }))
    )
      return;
    try {
      const response = await chatApi.closeConversation(active.id);
      setActive(response.data.data);
      toast(response.data.message);
      await Promise.all([loadList(), loadThread(active.id)]);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const waiting = conversations.filter((c) => c.status === "Waiting").length;
  const closed = active?.status === "Closed";
  /* Somebody else on the desk has this one: it is theirs to answer. */
  const someoneElses = !!active?.assigned_to && active.assigned_to !== user?.id;

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => void loadList()} />;

  return (
    <div>
      <PageHeader
        title="Live Chat"
        subtitle="Residents and visitors who asked to speak to a person — the Clerk's desk"
      />

      {offline && (
        <NeedsConnection what="the chat desk" why="A conversation only works while both sides can hear each other." />
      )}

      {(waiting > 0 || handling > 0) && (
        <p className="mb-4 rounded-2xl bg-warning/10 px-4 py-3 text-sm font-medium text-dark">
          {waiting > 0 && `${waiting} ${waiting === 1 ? "person is" : "people are"} waiting for a reply. `}
          {handling > 0 && `You are in ${handling} ${handling === 1 ? "conversation" : "conversations"}.`}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        {/* Queue */}
        <Card title="Conversations">
          <div className="mb-3 flex gap-2">
            {(
              [
                ["open", "Open"],
                ["mine", "Mine"],
                ["Waiting", "Waiting"],
                ["Closed", "Closed"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  filter === value ? "bg-primary text-white" : "bg-secondary text-dark hover:bg-primary/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <RowsSkeleton rows={5} what="the conversations" />
          ) : conversations.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Nobody is waiting. New conversations appear here on their own.
            </p>
          ) : (
            <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => open(conversation)}
                    className={`w-full cursor-pointer rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                      activeId === conversation.id
                        ? "border-primary bg-primary/5"
                        : "border-gray hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-dark">
                        {conversation.visitor_name}
                      </span>
                      {conversation.unread > 0 && (
                        <span className="shrink-0 rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">
                          {conversation.unread}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <StatusBadge status={conversation.status} />
                      <span className="text-[11px] text-gray-400">
                        {waitedFor(conversation.last_message_at ?? conversation.created_at)}
                      </span>
                    </div>
                    {conversation.is_resident && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                        <FiUser className="h-3 w-3" aria-hidden="true" /> Registered resident
                      </span>
                    )}
                    {/* Whose it is, once somebody has it. */}
                    {conversation.status === "Active" && (
                      <span className="mt-1 block text-[11px] font-medium text-gray-500">
                        {conversation.assigned_to === user?.id ? "Yours" : `With ${conversation.agent_name ?? "another staff member"}`}
                      </span>
                    )}

                    {/*
                      Marked before it is opened, not after. The whole cost of
                      missing this is paid in the first reply.
                    */}
                    {(conversation.follow_up_count ?? 0) > 0 && (
                      <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        <FiCornerUpLeft className="h-3 w-3" aria-hidden="true" />
                        {conversation.follow_up_count === 1
                          ? "Follow-up"
                          : `Follow-up ×${conversation.follow_up_count}`}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Thread */}
        <Card
          title={active ? active.visitor_name : "Conversation"}
          action={
            active && !closed ? (
              <div className="flex gap-2">
                {!active.assigned_to && (
                  <button
                    type="button"
                    onClick={claim}
                    className="cursor-pointer rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
                  >
                    Take this chat
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray px-4 py-1.5 text-xs font-semibold text-dark hover:border-primary hover:text-primary"
                >
                  <FiCheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> Resolve
                </button>
              </div>
            ) : undefined
          }
        >
          {!active ? (
            <p className="py-16 text-center text-sm text-gray-400">
              Choose a conversation on the left to read and reply.
            </p>
          ) : (
            <>
              {/* Who you are talking to */}
              <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 rounded-xl bg-secondary/60 px-4 py-2.5 text-xs text-gray-500">
                {active.guest_email && (
                  <span>
                    Email: <strong className="text-dark">{active.guest_email}</strong>
                  </span>
                )}
                {active.guest_contact && (
                  <span>
                    Contact: <strong className="text-dark">{active.guest_contact}</strong>
                  </span>
                )}
                <span>
                  Started: <strong className="text-dark">{waitedFor(active.created_at)}</strong>
                </span>
                {active.agent_name && (
                  <span>
                    Handled by: <strong className="text-dark">{active.agent_name}</strong>
                  </span>
                )}
                {/* The desk has answered; the resident has a day to reply. */}
                {active.closes_at && !closed && (
                  <span>
                    Closes by itself: <strong className="text-dark">{whenOf(active.closes_at)}</strong>, unless they reply
                  </span>
                )}
              </div>

              <div
                ref={threadRef}
                className="h-[24rem] space-y-3 overflow-y-auto rounded-xl bg-secondary/40 px-4 py-4"
              >
                {messages.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-400">Loading messages…</p>
                ) : (
                  messages.map((message) =>
                    message.sender === "system" ? (
                      <p
                        key={message.id}
                        className="mx-auto w-fit max-w-[90%] rounded-full bg-white/80 px-3 py-1 text-center text-[11px] text-gray-500"
                      >
                        {message.body}
                      </p>
                    ) : (
                      <div key={message.id}>
                        <div
                          className={
                            message.sender === "agent"
                              ? "ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-white"
                              : "w-fit max-w-[80%] whitespace-pre-line rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm text-dark shadow-sm"
                          }
                        >
                          {message.body}
                        </div>
                        <span
                          className={`mt-0.5 block text-[11px] text-gray-400 ${
                            message.sender === "agent" ? "text-right" : ""
                          }`}
                        >
                          {message.sender === "agent" ? message.sender_name : active.visitor_name} ·{" "}
                          {timeOf(message.created_at)}
                        </span>
                      </div>
                    )
                  )
                )}
              </div>

              {closed ? (
                <p className="mt-3 rounded-xl bg-secondary px-4 py-3 text-center text-sm text-gray-500">
                  This conversation is closed. The resident can follow up on it, and it comes back here.
                </p>
              ) : someoneElses ? (
                <p className="mt-3 rounded-xl bg-secondary px-4 py-3 text-center text-sm text-gray-500">
                  {active.agent_name ?? "Another staff member"} is handling this conversation — one person answers each resident.
                </p>
              ) : (
                <ShortcutComposer
                  key={active.id}
                  value={reply}
                  onChange={(value) => setReply(active.id, value)}
                  onSend={() => void send()}
                  sending={sending}
                  shortcuts={shortcuts}
                />
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
