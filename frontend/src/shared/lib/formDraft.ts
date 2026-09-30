/**
 * Drafts for long forms, kept in the browser.
 *
 * The family forms take minutes to fill in — several people, each with a full
 * resident record — and the dialog closes on a stray click outside it, with
 * nothing asked first. Losing all of that to one misplaced click is the kind
 * of thing that makes a clerk stop using a feature, so what has been typed is
 * written down as it is typed and offered back when the form is next opened.
 *
 * A draft survives a closed dialog, a reload and a closed browser. It does NOT
 * survive logging out: it holds residents' names, birthdates and phone
 * numbers, and the next person at that desk has no business seeing them.
 */

const PREFIX = "bn-draft:";
/* Drafts kept before this file existed, under their own names — the Lupon
   intake's. Still removed at logout on any computer that holds one. */
const LEGACY_PREFIXES = ["lupon-intake-draft:"];

interface Envelope<T> {
  saved_at: number;
  /** The record's version the draft was typed against — an edit form's. */
  version?: string | null;
  value: T;
}

/*
 * WHOSE drafts these are.
 *
 * Every key carries the signed-in account's id, set by the AuthProvider. A
 * draft typed by one clerk is invisible to the next person who signs in at
 * the same desk, even before logout has cleared them all — and with nobody
 * signed in there is no owner, so nothing is written or read at all.
 */
let owner: string | null = null;

export function setDraftOwner(id: number | null | undefined): void {
  owner = id == null ? null : String(id);
  if (owner) carryOverLegacy(owner);
}

/* A Lupon intake typed before drafts were kept here is moved across once,
   so an update does not cost somebody a half-written complaint. */
function carryOverLegacy(who: string): void {
  try {
    const legacy = `lupon-intake-draft:${who}`;
    const old = localStorage.getItem(legacy);
    if (old === null) return;
    const target = `${PREFIX}${who}:lupon-intake`;
    if (localStorage.getItem(target) === null) {
      localStorage.setItem(target, JSON.stringify({ saved_at: Date.now(), version: null, value: JSON.parse(old) }));
    }
    localStorage.removeItem(legacy);
  } catch {
    // Unreadable: nothing worth keeping.
  }
}

const keyFor = (key: string) => (owner ? `${PREFIX}${owner}:${key}` : null);

/*
 * Drafts that must never touch the disk — the VAWC desk's. A survivor's
 * details are never kept on a device (the server encrypts them with a key
 * the browser never holds), so their drafts live in this tab's memory only:
 * they survive a closed dialog and a move to another page, and are gone on
 * a reload, a closed tab, or logout.
 */
const memory = new Map<string, Envelope<unknown>>();

export interface DraftOptions {
  memoryOnly?: boolean;
  version?: string | null;
}

/** Writes a draft. Storage being unavailable is not worth an interruption. */
export function saveDraft<T>(key: string, value: T, options: DraftOptions = {}): void {
  const full = keyFor(key);
  if (!full) return;

  const envelope: Envelope<T> = { saved_at: Date.now(), version: options.version ?? null, value };
  if (options.memoryOnly) {
    memory.set(full, envelope);

    return;
  }

  try {
    localStorage.setItem(full, JSON.stringify(envelope));
  } catch {
    // Private mode, or the quota is full. The form still works; only the
    // safety net is missing, and saying so mid-sentence would help nobody.
  }
}

/** The draft stored under `key`, or null when there is none to be had. */
export function loadDraft<T>(key: string, options: DraftOptions = {}): { value: T; savedAt: number; version: string | null } | null {
  const full = keyFor(key);
  if (!full) return null;

  try {
    const envelope = (options.memoryOnly
      ? memory.get(full)
      : JSON.parse(localStorage.getItem(full) ?? "null")) as Envelope<T> | null;
    if (!envelope || typeof envelope !== "object" || envelope.value == null) return null;

    return { value: envelope.value, savedAt: envelope.saved_at ?? 0, version: envelope.version ?? null };
  } catch {
    // Corrupt, or written by an older shape of the form. Start clean rather
    // than restoring something that would half-fill the fields.
    return null;
  }
}

export function clearDraft(key: string, options: DraftOptions = {}): void {
  const full = keyFor(key);
  if (!full) return;

  if (options.memoryOnly) {
    memory.delete(full);

    return;
  }

  try {
    localStorage.removeItem(full);
  } catch {
    // Nothing to clear.
  }
}

/** Drops every draft on this machine, and in this tab — see the note at the top. */
export function clearAllDrafts(): void {
  memory.clear();
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && [PREFIX, ...LEGACY_PREFIXES].some((p) => key.startsWith(p))) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing to clear.
  }
}

/** How long ago a draft was written, in words, for the notice on the form. */
export function draftAge(savedAt: number): string {
  const minutes = Math.floor((Date.now() - savedAt) / 60000);
  if (minutes < 1) return "a moment ago";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
