import { useState } from "react";
import { CHAT_CONFIG } from "../lib/chatConfig";
import { chatApi } from "../api";
import { remember, LIVE_KEY } from "../lib/widgetMemory";
import type { LiveDeskState } from "./useLiveDesk";
import type { PastConversation, ChatMessage as LiveMessage } from "../types";

/**
 * The resident's earlier conversations: reading one back, and following one up.
 */
export function usePastConversations(ctx: LiveDeskState) {
  const {
    lastSeenId, refreshLive, setLiveError, setLiveStatus, setMode, setPast, setToken,
  } = ctx;

  const [showPast, setShowPast] = useState(false);
  /*
   * The follow-up box.
   *
   * `followUpFor` is the token being followed up rather than a boolean,
   * because the same box serves the live view and the reader — and in the
   * reader the thread being answered is not the one in `token`.
   */
  const [followUpFor, setFollowUpFor] = useState<string | null>(null);
  const [followUpText, setFollowUpText] = useState("");
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [reading, setReading] = useState<PastConversation | null>(null);
  const [readingMessages, setReadingMessages] = useState<LiveMessage[]>([]);
  /** The list, fetched only when the resident asks for it. */
  const loadPast = async () => {
    try {
      const response = await chatApi.history();
      const rows: PastConversation[] = response.data.data.conversations ?? [];

      // Only the finished ones: the open conversation is already on screen.
      setPast(rows.filter((row) => row.status === "Closed"));
    } catch {
      setPast([]);
    }
  };
  /**
   * Opens a resolved thread, read-only.
   *
   * The same endpoint the live view uses — a closed conversation is still
   * the resident's to read, so nothing special is needed to fetch it. What
   * is special is that it cannot be replied to: it is a record of what was
   * said, not a way to say more.
   */
  const readPast = async (row: PastConversation) => {
    setReading(row);
    setReadingMessages([]);

    try {
      const response = await chatApi.conversation(row.session_token);
      setReadingMessages(response.data.data.messages ?? []);
    } catch {
      setReadingMessages([]);
    }
  };
  /**
   * Reopen a finished conversation with one more question.
   *
   * On success the widget moves into the live view on THAT thread, so the
   * answer and the follow-up are read together — which is the whole point of
   * reopening rather than starting again.
   */
  const sendFollowUp = async () => {
    const body = followUpText.trim();
    if (!body || !followUpFor) return;

    setSendingFollowUp(true);

    try {
      await chatApi.followUp(followUpFor, { body });

      remember(LIVE_KEY, followUpFor);
      setToken(followUpFor);
      setLiveStatus("Waiting");
      setMode("live");
      setReading(null);
      setShowPast(false);
      setFollowUpFor(null);
      setFollowUpText("");
      lastSeenId.current = 0;
      await refreshLive(followUpFor);
    } catch {
      setLiveError("That follow-up did not send. Check your connection and try again.");
    } finally {
      setSendingFollowUp(false);
    }
  };
  /** The box, shared by the live view and the reader. */
  const followUpBox = (sessionToken: string) =>
    followUpFor === sessionToken ? (
      <div className="space-y-2">
        <textarea
          rows={3}
          autoFocus
          value={followUpText}
          onChange={(e) => setFollowUpText(e.target.value)}
          placeholder="What else would you like to ask?"
          maxLength={CHAT_CONFIG.maxMessageLength}
          className="w-full rounded-xl border border-gray px-3 py-2 text-xs text-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
        />
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => { setFollowUpFor(null); setFollowUpText(""); }}
            className="cursor-pointer rounded-full border border-gray px-3 py-1.5 text-xs font-semibold text-dark"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={sendFollowUp}
            disabled={!followUpText.trim() || sendingFollowUp}
            className="cursor-pointer rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {sendingFollowUp ? "Sending…" : "Send follow-up"}
          </button>
        </div>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => { setFollowUpFor(sessionToken); setFollowUpText(""); }}
        className="cursor-pointer rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
      >
        Ask a follow-up
      </button>
    );

  return {
    showPast, setShowPast, followUpFor, setFollowUpFor, followUpText, setFollowUpText,
    sendingFollowUp, setSendingFollowUp, reading, setReading, readingMessages,
    setReadingMessages, loadPast, readPast, sendFollowUp, followUpBox,
  };
}

export type PastConversationsState = ReturnType<typeof usePastConversations>;
