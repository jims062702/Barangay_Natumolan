import { STORE_META, meta, setMeta, remove } from "../offline/offlineDb";
import type { User } from "../types";

/**
 * Signing in with no server to ask.
 *
 * Every request normally carries a token the server looks up, which is the
 * whole problem: with the line down there is nothing to look it up in. The
 * office would be thrown to a login page they cannot get past — and that is
 * exactly what happened, because a failed `/auth/me` was treated as a
 * refused one and the token was deleted.
 *
 * So the device keeps enough to answer two questions by itself:
 *
 *   WHO IS THIS?     the profile from the last successful sign-in
 *   IS IT THEM?      a verifier the typed password is checked against
 *
 * THE PASSWORD IS NEVER STORED. What is kept is PBKDF2 over it with a random
 * salt — the same one-way shape a server keeps — so the stored value cannot
 * be turned back into the password.
 *
 * WHAT THIS GIVES UP, said plainly. Somebody holding the laptop can guess at
 * the password as fast as their machine allows, with no server to lock them
 * out after five tries. Three things push back: the iteration count below
 * makes each guess cost real time, a local counter stops the device after
 * repeated failures, and the office's passwords should not be guessable.
 * That last one is a policy the barangay has to set — `min:8` with no
 * complexity rule accepts "12345678".
 */

const GRANT = "auth.offline-grant";
const FAILURES = "auth.offline-failures";

/*
 * OWASP's floor for PBKDF2-SHA256 at the time of writing. High enough that a
 * guess costs a noticeable fraction of a second, low enough that the clerk
 * does not wait at the counter. Stored WITH the grant so raising it later
 * does not lock out every device issued under the old number.
 */
const ITERATIONS = 600_000;

/** After this many wrong tries the device stops answering until it is online. */
const MAX_FAILURES = 10;

/**
 * How long a device may be signed into with no server.
 *
 * Thirty days, because the barangay asked for offline that survives weeks
 * and a grant shorter than the outage is a grant that does not work. It is
 * the one number here with a real cost — it is also how long a stolen laptop
 * stays useful to somebody who knows the password — so it is named once,
 * here, for the barangay to change.
 */
const GRANT_DAYS = 30;

interface StoredGrant {
  email: string;
  salt: string;
  verifier: string;
  iterations: number;
  /** The profile to restore, so the app knows who is signed in. */
  user: User;
  /** The API token, kept so work can resume when the line returns. */
  token: string;
  grantedAt: number;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/** PBKDF2 over the password, as base64. */
async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    key,
    256,
  );

  return bytesToBase64(new Uint8Array(bits));
}

/**
 * Remembers this sign-in so the same person can get back in with no line.
 *
 * Called only after the SERVER has accepted the password. Nothing here
 * decides whether a password is right the first time; it records that the
 * server already said so.
 *
 * OFFICES ONLY. Offline exists because a barangay hall loses its line and
 * the counter cannot stop; a resident at home with no signal is not in that
 * position — nothing they can do in the portal works without the server
 * anyway, and a password kept on their phone is a risk taken for nothing.
 */
export async function rememberForOffline(
  email: string,
  password: string,
  user: User,
  token: string,
): Promise<void> {
  if (user.role === "Resident") {
    return;
  }

  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const grant: StoredGrant = {
      email: email.trim().toLowerCase(),
      salt: bytesToBase64(salt),
      verifier: await derive(password, salt, ITERATIONS),
      iterations: ITERATIONS,
      user,
      token,
      grantedAt: Date.now(),
    };

    await setMeta(GRANT, grant);
    await setMeta(FAILURES, 0);
  } catch {
    /*
     * No IndexedDB, or no WebCrypto — a private window, an insecure origin.
     * Online sign-in still works and that is what just happened; failing
     * here must not turn a successful login into an error.
     */
  }
}

export type OfflineSignIn =
  | { kind: "ok"; user: User; token: string }
  | { kind: "no-grant" }
  | { kind: "wrong-account" }
  | { kind: "wrong-password"; remaining: number }
  | { kind: "locked" }
  | { kind: "expired" };

/**
 * Checks a password against what this device remembers.
 *
 * The failure kinds are separate on purpose: "this device has never seen
 * you" and "that password is wrong" need different things from the person
 * standing there, and one message covering both would send them looking for
 * the wrong fix.
 */
export async function signInOffline(email: string, password: string): Promise<OfflineSignIn> {
  const grant = await meta<StoredGrant | null>(GRANT, null);

  if (!grant) {
    return { kind: "no-grant" };
  }

  /* A grant kept from before offices-only: a resident's is not honoured. */
  if (grant.user?.role === "Resident") {
    return { kind: "no-grant" };
  }

  if (grant.email !== email.trim().toLowerCase()) {
    /* A device remembers ONE account — the person who uses it. Another
       account has to sign in online at least once on this machine. */
    return { kind: "wrong-account" };
  }

  const age = Date.now() - grant.grantedAt;

  if (age > GRANT_DAYS * 24 * 60 * 60 * 1000) {
    return { kind: "expired" };
  }

  const failures = await meta<number>(FAILURES, 0);

  if (failures >= MAX_FAILURES) {
    return { kind: "locked" };
  }

  const attempt = await derive(password, base64ToBytes(grant.salt), grant.iterations);

  /*
   * Length-independent comparison. `===` on strings can return early on the
   * first differing character, and the time that takes is measurable — with
   * the attacker holding the device and able to try at will, that leaks the
   * verifier one character at a time.
   */
  if (!timingSafeEqual(attempt, grant.verifier)) {
    const next = failures + 1;

    await setMeta(FAILURES, next);

    return { kind: "wrong-password", remaining: Math.max(0, MAX_FAILURES - next) };
  }

  await setMeta(FAILURES, 0);

  return { kind: "ok", user: grant.user, token: grant.token };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;

  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

/** The profile this device last saw, for restoring a session with no line. */
export async function cachedProfile(): Promise<{ user: User; token: string } | null> {
  const grant = await meta<StoredGrant | null>(GRANT, null);

  return grant ? { user: grant.user, token: grant.token } : null;
}

/** Keeps the stored profile in step after an online refresh. */
export async function updateCachedProfile(user: User, token?: string): Promise<void> {
  try {
    const grant = await meta<StoredGrant | null>(GRANT, null);

    if (!grant) {
      return;
    }

    await setMeta(GRANT, { ...grant, user, token: token ?? grant.token });
  } catch {
    /* Nothing to do; the next successful sign-in rewrites it. */
  }
}

/** Whether this device can sign anybody in with no line. */
export async function hasOfflineGrant(): Promise<boolean> {
  return (await meta<StoredGrant | null>(GRANT, null)) !== null;
}

/**
 * Forgets the account. Called on a deliberate sign-out, and only then.
 *
 * A sign-out with no line would leave nobody able to get back in, which is
 * why the button is hidden while offline — this function is the reason that
 * matters.
 */
export async function forgetOfflineGrant(): Promise<void> {
  try {
    await remove(STORE_META, GRANT);
    await remove(STORE_META, FAILURES);
  } catch {
    /* Already gone, or no database. Either way there is nothing to keep. */
  }
}
