/**
 * What the widget remembers between visits, in this browser.
 */

/**
 * localStorage, for a browser that may refuse it.
 *
 * With site data blocked — an in-app browser, a private window, a strict
 * privacy setting — every one of these THROWS rather than returning null.
 * One of them ran inside a useState initialiser, where the exception takes
 * the whole widget down during its first render: the chat button simply
 * never appears, and nothing says why.
 */
export function remembered(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function remember(key: string, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    /* Nothing is saved, and the chat still works for this page view. */
  }
}

/** Stable anonymous sender id so Rasa keeps the conversation context. */
export function senderId(): string {
  const KEY = "bn-chat-sender";
  let id = remembered(KEY);
  if (!id) {
    id = "web-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    remember(KEY, id);
  }
  return id;
}

/** The live conversation survives a page reload; a closed one is forgotten. */
export const LIVE_KEY = "bn-chat-live-token";

/** "1" when the panel was made bigger — a setting, nothing said in it. */
export const EXPANDED_KEY = "bn-chat-expanded";

/**
 * "Open the chat again when I get back." Set by Login as Resident, read
 * once by the widget on the page the sign-in lands on.
 *
 * A flag and nothing more. The conversation is not carried across a sign-in:
 * what a guest said is kept as the guest's (lib/chatLog.ts), and the account
 * starts its own.
 */
export const REOPEN_KEY = "bn-chat-reopen";

/** Reads the flag and clears it, so it opens the chat exactly once. */
export function takeReopen(): boolean {
  const set = remembered(REOPEN_KEY) === "1";
  if (set) remember(REOPEN_KEY, null);

  return set;
}

/**
 * The suggested question a guest pressed after their limit, to answer once
 * they have signed in as a resident.
 *
 * Only ever a SUGGESTION — a button the chatbot offered, like "Office
 * hours". The box is closed at the limit, so nothing the person typed can
 * end up here. Kept half an hour: a question pressed yesterday is not what
 * somebody signing in today came to ask.
 */
const PENDING_KEY = "bn-chat-pending";
const PENDING_FOR_MS = 30 * 60 * 1000;

export interface PendingQuestion {
  question: string;
  display: string;
}

export function rememberPending(pending: PendingQuestion): void {
  remember(PENDING_KEY, JSON.stringify({ ...pending, at: Date.now() }));
}

/** Reads the question and clears it, so it is asked exactly once. */
export function takePending(): PendingQuestion | null {
  const raw = remembered(PENDING_KEY);
  if (!raw) return null;
  remember(PENDING_KEY, null);

  try {
    const p = JSON.parse(raw) as Partial<PendingQuestion> & { at?: number };
    if (typeof p.question !== "string" || typeof p.display !== "string") return null;
    if (!p.at || Date.now() - p.at > PENDING_FOR_MS) return null;

    return { question: p.question, display: p.display };
  } catch {
    return null;
  }
}
