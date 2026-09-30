/**
 * Every limit the chatbot keeps, in one place.
 *
 * These were spread across the widget — a 4-second Rasa timeout in the send
 * hook, a character limit in the guard, a poll interval in the copy file —
 * and a limit written in two places is a limit that ends up two different
 * numbers. Change one here and every part of the widget follows.
 *
 * The server holds the same message length for what reaches it
 * (AssistantInquiryRequest, ResidentChatMessageRequest). If this changes,
 * those change with it.
 */
export const CHAT_CONFIG = {
  /** Characters in one message. The office asked for 1,000. */
  maxMessageLength: 1000,
  /** From this many characters left, the counter turns to the attention colour. */
  counterWarnAt: 100,

  /**
   * Messages somebody not signed in may send in a day before being asked to
   * sign in as a resident — spam included. COUNTED BY THE SERVER, per
   * device (config/barangay.php, chat.guest_daily_limit; see lib/guestDevice),
   * so people on one Wi-Fi each have their own. This figure is only what the
   * widget shows before the server has answered.
   */
  maxGuestMessages: 10,

  /** More than this many messages in the window is sending too quickly. */
  rateLimit: { maxMessages: 5, windowMs: 30_000 },
  /** The same question again: a note the first time, a cooldown at this many. */
  duplicateLimit: 2,
  /** How alike two questions must be to count as the same one (0–1). */
  similarity: 0.75,
  /** The wait after sending too quickly, or repeating a question. */
  cooldownMs: 15_000,
  /** A breath after every answer, so Enter held down is not ten questions. */
  afterReplyMs: 1_000,

  /**
   * Ten messages in a row the chatbot cannot make sense of, and it pauses.
   * The office asked for ten (2026-09-25).
   */
  unclear: { strikesAllowed: 10, warnFrom: 7, pauseMs: 2 * 60_000 },

  /** How long Rasa has to answer before the widget stops waiting. */
  rasaTimeoutMs: 10_000,
  /**
   * After Rasa fails, how long before it is asked again. Until then the
   * built-in assistant answers — so a Rasa that is down costs one failed
   * request, not one on every message.
   */
  rasaRetryAfterMs: 60_000,
  /** How long the built-in assistant has, when it is the one asked. */
  assistantTimeoutMs: 10_000,

  /** How often a conversation with the Clerk is refreshed while open. */
  livePollMs: 4_000,
} as const;
