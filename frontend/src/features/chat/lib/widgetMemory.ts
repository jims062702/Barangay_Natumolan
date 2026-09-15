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
