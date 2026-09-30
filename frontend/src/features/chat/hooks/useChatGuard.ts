import { useEffect, useRef, useState } from "react";
import { publicApi } from "../../public/api";
import { CHAT_CONFIG } from "../lib/chatConfig";
import { loadGuard, looksLikeGibberish, sameQuestion, saveGuard, type StoredGuard } from "../lib/chatGuard";
import { guestDeviceHeaders, keepGuestDevice } from "../lib/guestDevice";

/**
 * Why sending is held right now, if it is.
 *
 *   guest     a guest has used today's messages — sign in as a resident
 *   paused    ten unclear messages in a row (two minutes)
 *   cooldown  too many too quickly, or the same question again (seconds)
 *   settling  the breath after an answer (a second)
 */
export type HoldReason = "guest" | "paused" | "cooldown" | "settling";

/** What a message is, before anything is sent anywhere. */
export type Admission = "ok" | "unclear" | "too-fast" | "duplicate" | "duplicate-final";

/** What became of a message, once it was dealt with. */
export type Outcome =
  | "answered"        // the chatbot answered it — Rasa, the built-in assistant, or the widget itself
  | "not-understood"  // Rasa answered that it did not understand
  | "unclear"         // not words; answered here without asking anybody
  | "rejected"        // too fast, the same question again, or the guest limit
  | "failed";         // nothing could be reached — the person is not to blame

/** A guest message, counted by the server — or why it was not. */
export type GuestTake =
  | { ok: true; receipt: string }
  | { ok: false; reason: "limit"; resetsAt: number }
  | { ok: false; reason: "unreachable" };

interface Allowance {
  limit: number;
  left: number;
  /** Epoch ms the day starts again, or 0 before the first message. */
  resetsAt: number;
}

/** The server's answer, read defensively: anything odd is "not known". */
function readAllowance(data: unknown): Allowance | null {
  const d = data as { limit?: unknown; left?: unknown; resets_at?: unknown } | null;
  if (!d || typeof d.limit !== "number" || typeof d.left !== "number") return null;

  return { limit: d.limit, left: d.left, resetsAt: typeof d.resets_at === "number" ? d.resets_at : 0 };
}

/**
 * THE ONE PLACE THE CHATBOT'S LIMITS ARE KEPT.
 *
 * Every way of sending — the box, Enter, the suggested questions, the
 * buttons under an answer — goes through useLiveDesk's `send`, and `send`
 * asks this hook, and nothing else, whether it may. So there is one rate
 * limiter, one duplicate check, one guest count, not one per button.
 *
 * THE GUEST LIMIT IS THE SERVER'S. Ten messages a day per DEVICE
 * (config/barangay.php), counted there before a guest's message goes
 * anywhere. The device is the ID the server gave this browser with its
 * first message (lib/guestDevice) — so people sharing one Wi-Fi each have
 * their own ten, and a network can only start so many new devices a day.
 * What is shown here is the server's last answer; the server decides.
 *
 * WHAT A GUEST'S DAY IS SPENT ON: every message the chatbot deals with — a
 * question it answered, one it did not understand, and one that is not
 * words at all. Spam counts like anything else. NOT on a message refused
 * before it was asked (too fast, the same question again), and not on one
 * that failed because the chatbot could not be reached — that message is
 * handed back to the server.
 *
 * The unclear-message pause is separate and for everybody: ten unclear
 * messages in a row and the chat rests for two minutes. Every hold ends by
 * itself; nothing here blocks anybody for good.
 */
export function useChatGuard(isGuest: boolean) {
  const stored = useRef<StoredGuard>(loadGuard());

  /* The questions asked on this page, in memory — see lib/chatGuard.ts. */
  const sentAt = useRef<number[]>([]);
  const answered = useRef<string[]>([]);
  const repeats = useRef(0);

  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownWhy, setCooldownWhy] = useState<"fast" | "similar">("fast");
  const [settleUntil, setSettleUntil] = useState(0);
  const [pausedUntil, setPausedUntil] = useState(stored.current.pausedUntil);
  const [now, setNow] = useState(() => Date.now());

  /* The server's last word on the guest limit — a ref for `send`, which
     reads it between awaits, and state for what is on screen. */
  const allowanceRef = useRef<Allowance>({ limit: CHAT_CONFIG.maxGuestMessages, left: CHAT_CONFIG.maxGuestMessages, resetsAt: 0 });
  const [allowance, setAllowanceState] = useState<Allowance>(allowanceRef.current);
  const setAllowance = (next: Allowance) => {
    allowanceRef.current = next;
    setAllowanceState(next);
  };

  /* What is left today, asked when somebody is a guest — on arrival, and on
     signing out. */
  useEffect(() => {
    if (!isGuest) return;
    let current = true;
    publicApi.guestAllowance({ headers: guestDeviceHeaders() })
      .then((r) => {
        const read = readAllowance(r.data?.data);
        if (current && read) setAllowance(read);
      })
      .catch(() => {
        /* Not known yet: the next message asks again, and the server decides then. */
      });

    return () => { current = false; };
  }, [isGuest]);

  /*
   * WHEN THE GUEST LIMIT LIFTS: a day after the first message of the day —
   * the server's clock, not midnight. Signing in as a resident lifts it for
   * as long as they are signed in.
   */
  const guestHeld = (t: number) => allowance.left <= 0 && allowance.resetsAt > t;

  /* A clock only while something is being waited out, stopping itself when
     the last wait ends. Idle, nothing ticks. */
  const until = Math.max(cooldownUntil, settleUntil, pausedUntil);
  useEffect(() => {
    if (until <= Date.now()) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) window.clearInterval(id);
    }, 250);

    return () => window.clearInterval(id);
  }, [until]);

  /* The guest limit's countdown is in hours: a tick a minute keeps it
     right, and lets the box open by itself when the day is up. */
  useEffect(() => {
    if (!guestHeld(Date.now())) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowance.left, allowance.resetsAt]);

  const commit = (next: StoredGuard) => {
    stored.current = next;
    saveGuard(next);
    setPausedUntil(next.pausedUntil);
  };

  /** Whether sending is held, and for how long — for the box and the buttons. */
  const hold = (guest: boolean): { reason: HoldReason | null; waitMs: number } => {
    const t = Math.max(now, Date.now());
    if (guest && guestHeld(t)) return { reason: "guest", waitMs: allowance.resetsAt - t };
    if (pausedUntil > t) return { reason: "paused", waitMs: pausedUntil - t };
    if (cooldownUntil > t) return { reason: "cooldown", waitMs: cooldownUntil - t };
    if (settleUntil > t) return { reason: "settling", waitMs: settleUntil - t };

    return { reason: null, waitMs: 0 };
  };

  const coolDown = (why: "fast" | "similar") => {
    /* The window starts again with the cooldown. Left full, the first
       message after the wait would be "too fast" all over again — a hold
       that never lets go. */
    if (why === "fast") sentAt.current = [];
    setCooldownWhy(why);
    setCooldownUntil(Date.now() + CHAT_CONFIG.cooldownMs);
    setNow(Date.now());
  };

  /**
   * Before anything is sent: is this a question to put to the chatbot?
   *
   * Recorded as sent whatever the answer — somebody firing off messages the
   * chatbot refuses is still firing them off.
   */
  const admit = (text: string): Admission => {
    const t = Date.now();
    const { maxMessages, windowMs } = CHAT_CONFIG.rateLimit;
    sentAt.current = sentAt.current.filter((at) => t - at < windowMs);

    if (sentAt.current.length >= maxMessages) {
      coolDown("fast");
      return "too-fast";
    }
    sentAt.current.push(t);

    if (looksLikeGibberish(text)) return "unclear";

    if (answered.current.some((before) => sameQuestion(before, text))) {
      repeats.current += 1;
      if (repeats.current >= CHAT_CONFIG.duplicateLimit) {
        repeats.current = 0;
        coolDown("similar");
        return "duplicate-final";
      }
      return "duplicate";
    }

    return "ok";
  };

  /**
   * A guest's message, counted by the server BEFORE it goes anywhere.
   *
   * "limit": today's are used up — the server said so, whatever this page
   * thought. "unreachable": the count could not be asked, and neither,
   * most likely, can the chatbot; nothing is sent and nothing is counted.
   */
  const takeGuest = async (): Promise<GuestTake> => {
    try {
      const r = await publicApi.takeGuestAllowance({}, { headers: guestDeviceHeaders() });
      /* The device ID the server gave (or confirmed) — kept for every message after. */
      keepGuestDevice((r.data?.data as { device?: unknown } | undefined)?.device);
      const read = readAllowance(r.data?.data);
      if (read) setAllowance(read);
      const receipt = (r.data?.data as { receipt?: unknown } | undefined)?.receipt;

      return { ok: true, receipt: typeof receipt === "string" ? receipt : "" };
    } catch (err) {
      const response = (err as { response?: { status?: number; data?: { data?: unknown } } }).response;
      if (response?.status === 429) {
        keepGuestDevice((response.data?.data as { device?: unknown } | undefined)?.device);
        const read = readAllowance(response.data?.data) ?? { ...allowanceRef.current, left: 0 };
        setAllowance(read);
        setNow(Date.now());

        return { ok: false, reason: "limit", resetsAt: read.resetsAt };
      }

      return { ok: false, reason: "unreachable" };
    }
  };

  /** The chatbot could not be reached to answer it: the message is handed back. */
  const returnGuest = async (receipt: string) => {
    if (!receipt) return;
    try {
      const r = await publicApi.returnGuestAllowance({ receipt }, { headers: guestDeviceHeaders() });
      const read = readAllowance(r.data?.data);
      if (read) setAllowance(read);
    } catch {
      /* Kept as spent. A day is ten messages; one lost to an outage is not worth a retry loop. */
    }
  };

  /**
   * After it was dealt with: the unclear-message run, and what to tell the
   * person about their limits — a warning as the pause gets close, the
   * pause itself, or that today's guest messages are used up.
   */
  const settle = (text: string, outcome: Outcome, guest: boolean) => {
    const t = Date.now();
    const next = { ...stored.current };
    let paused = false;
    let warnLeft = -1;

    if (outcome === "answered" || outcome === "not-understood") {
      /* Only a real answer is something to point back to. "I did not quite
         get that" is not — asking again, differently, is what they should do. */
      if (outcome === "answered") answered.current.push(text);
      repeats.current = 0;
    }

    if (outcome === "unclear" || outcome === "not-understood") {
      next.strikes += 1;
      const { strikesAllowed, warnFrom, pauseMs } = CHAT_CONFIG.unclear;
      if (next.strikes >= strikesAllowed) {
        next.strikes = 0;
        next.pausedUntil = t + pauseMs;
        paused = true;
      } else if (next.strikes >= warnFrom) {
        warnLeft = strikesAllowed - next.strikes;
      }
    } else if (outcome === "answered") {
      /* One answer the chatbot could give clears the run. */
      next.strikes = 0;
    }

    commit(next);
    setSettleUntil(t + CHAT_CONFIG.afterReplyMs);
    setNow(t);

    const spent = outcome === "answered" || outcome === "not-understood" || outcome === "unclear";
    const a = allowanceRef.current;

    return {
      paused,
      warnLeft,
      guestLimitReached: guest && spent && a.left <= 0,
      guestResetAt: a.resetsAt,
      guestLeft: a.left,
    };
  };

  return {
    hold,
    admit,
    takeGuest,
    returnGuest,
    settle,
    cooldownWhy,
    guestLeft: allowance.resetsAt && allowance.resetsAt <= Math.max(now, Date.now())
      ? allowance.limit
      : Math.max(0, allowance.left),
    guestLimit: allowance.limit,
    guestResetAt: allowance.resetsAt,
  };
}

export type ChatGuard = ReturnType<typeof useChatGuard>;
