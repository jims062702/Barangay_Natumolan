/**
 * THE CONVERSATION WITH THE CHATBOT, KEPT FOR A DAY (2026-09-29).
 *
 * A reload used to wipe it: somebody halfway through asking what a
 * clearance needs pressed F5 and was back at "Kumusta!", the answers they
 * had been given gone with it. Now it is kept in this browser and read back
 * on the next page — until the day is up, and then it is gone:
 *
 *   a guest     when the guest limit starts again — the server's resets_at,
 *               a day after the first message — so the conversation and the
 *               ten messages come back fresh together
 *   signed in   a day after the conversation began (there is no limit to
 *               line it up with)
 *
 * WHOSE IT IS. Kept under who was chatting: a guest, or one signed-in
 * account. Read back by anybody else — somebody signing in on the same
 * phone, or the next person after a sign-out — it is deleted, never shown.
 * Signing out deletes it as well (AuthContext).
 *
 * WHAT IS NEVER WRITTEN. A question about violence or danger, and every
 * answer to it (see `isSensitive`). A shared phone keeps whatever is written
 * to it, and a conversation about a violent partner is the one that must not
 * be found on it. Those lines stay on screen for this page view only; kept
 * in their place is one line that says something was left out, and not what.
 *
 * The live desk's conversation is not kept here: that one is the server's,
 * and is read back from it (useLiveDesk).
 */

import { mentionsVawc } from "../../lupon/lib/jurisdictionScreen";
import { looksLikeEmergency } from "./emergency";
import { remember, remembered } from "./widgetMemory";
import type { ChatButton, WidgetMessage } from "../types";

/* Also removed by name on sign-out, in shared/auth/AuthContext.tsx. */
const KEY = "bn-chat-log";

export const LOG_DAY_MS = 24 * 60 * 60 * 1000;

/** The most lines kept — a day of questions is far fewer than this. */
const MAX_LINES = 200;

/** Said where lines were left out of what was kept. */
export const NOT_KEPT_NOTE = "Some messages here were not saved on this device, for your privacy.";

/** A question the conversation must not be kept on the device for. */
export function isSensitive(...texts: (string | null | undefined)[]): boolean {
  return texts.some((text) => !!text && (looksLikeEmergency(text) || mentionsVawc(text)));
}

interface StoredLog {
  v: 1;
  owner: string;
  expiresAt: number;
  messages: WidgetMessage[];
}

function readButton(raw: unknown): ChatButton | null {
  const b = raw as { title?: unknown; payload?: unknown } | null;
  if (!b || typeof b.title !== "string" || typeof b.payload !== "string") return null;

  return { title: b.title, payload: b.payload };
}

/** One kept line, read defensively: anything odd is left out. */
function readLine(raw: unknown): WidgetMessage | null {
  const m = raw as Partial<WidgetMessage> | null;
  if (!m || typeof m.id !== "number" || (m.from !== "bot" && m.from !== "user") || typeof m.text !== "string") return null;

  const buttons = Array.isArray(m.buttons)
    ? m.buttons.map(readButton).filter((b): b is ChatButton => b !== null)
    : undefined;

  return {
    id: m.id,
    from: m.from,
    text: m.text,
    ...(buttons && buttons.length ? { buttons } : {}),
    ...(m.understood === false ? { understood: false } : {}),
  };
}

/** Forgets the kept conversation. */
export function forgetChatLog(): void {
  remember(KEY, null);
}

/**
 * The conversation kept for `owner`, or null.
 *
 * Somebody else's, one past its day, or one that cannot be read is deleted
 * on the spot, so it is not there to be read the next time either.
 */
export function loadChatLog(owner: string): { messages: WidgetMessage[]; expiresAt: number } | null {
  const raw = remembered(KEY);
  if (!raw) return null;

  try {
    const log = JSON.parse(raw) as Partial<StoredLog>;
    if (log.v !== 1 || log.owner !== owner || typeof log.expiresAt !== "number" || log.expiresAt <= Date.now()
      || !Array.isArray(log.messages)) {
      forgetChatLog();
      return null;
    }
    const messages = log.messages.map(readLine).filter((m): m is WidgetMessage => m !== null);
    if (messages.length === 0) {
      forgetChatLog();
      return null;
    }

    return { messages, expiresAt: log.expiresAt };
  } catch {
    forgetChatLog();
    return null;
  }
}

/**
 * Keeps the conversation — the lines after the welcome, which is always the
 * page's own. A run of lines that must not be kept is written as one
 * NOT_KEPT_NOTE; nothing asked yet is nothing to keep.
 */
export function saveChatLog(owner: string, expiresAt: number, lines: WidgetMessage[]): void {
  const kept: WidgetMessage[] = [];
  for (const line of lines) {
    if (line.unsaved) {
      const last = kept[kept.length - 1];
      if (!last || last.text !== NOT_KEPT_NOTE) kept.push({ id: line.id, from: "bot", text: NOT_KEPT_NOTE });
      continue;
    }
    kept.push({
      id: line.id,
      from: line.from,
      text: line.text,
      ...(line.buttons && line.buttons.length ? { buttons: line.buttons } : {}),
      ...(line.understood === false ? { understood: false } : {}),
    });
  }

  /* Only the note left is nothing to keep — and would say, on its own, that something was left out. */
  if (kept.every((line) => line.text === NOT_KEPT_NOTE)) {
    forgetChatLog();
    return;
  }

  const log: StoredLog = { v: 1, owner, expiresAt, messages: kept.slice(-MAX_LINES) };
  remember(KEY, JSON.stringify(log));
}
