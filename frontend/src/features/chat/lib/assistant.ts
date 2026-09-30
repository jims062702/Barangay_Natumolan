/**
 * Asking the chatbot — Rasa first, the built-in assistant if Rasa cannot
 * answer, and a plain sentence if neither can.
 *
 * NOTHING TECHNICAL REACHES THE PERSON. Not "Network Error", not a status
 * code, not "Rasa unavailable". Whatever goes wrong underneath, what comes
 * back is an answer, or a sentence saying the chatbot cannot help with that
 * just now and what to do instead. The widget stays open and usable either
 * way.
 *
 * NO RETRYING. One request to Rasa per message, with a timeout. When it
 * fails — unreachable, an error, a timeout, an answer that is not an answer
 * — Rasa is left alone for a minute (CHAT_CONFIG.rasaRetryAfterMs) and the
 * built-in assistant answers in the meantime. A Rasa that is down therefore
 * costs one failed request, not one on every message and never a loop.
 */

import { publicApi } from "../../public/api";
import { CHAT_CONFIG } from "./chatConfig";
import { RASA_URL } from "./widgetCopy";
import { nextLineId } from "./widgetIds";
import { senderId } from "./widgetMemory";
import type { ChatButton, RasaReply, WidgetMessage } from "../types";

/** What became of the question, for the limits (see useChatGuard). */
export type AskOutcome = "answered" | "not-understood" | "failed";

export interface AskResult {
  replies: WidgetMessage[];
  outcome: AskOutcome;
}

export const OFFLINE_REPLY =
  "I’m currently unable to process that request. Please try one of the suggested questions below "
  + "or visit the appropriate Barangay Office for assistance.";

export const TIMEOUT_REPLY =
  "I’m having trouble processing your request right now. Please try one of the suggested questions below.";

/** Until when Rasa is left alone after failing. Module-wide: one widget, one Rasa. */
let rasaRestingUntil = 0;

function isButton(value: unknown): value is ChatButton {
  const b = value as ChatButton;
  return typeof b === "object" && b !== null && typeof b.title === "string" && typeof b.payload === "string";
}

/** A reply the widget can actually show: some text, or a button to press. */
function usable(value: unknown): RasaReply | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as RasaReply;
  const text = typeof r.text === "string" ? r.text.trim() : "";
  const buttons = Array.isArray(r.buttons) ? r.buttons.filter(isButton) : [];

  return text || buttons.length ? { text, buttons } : null;
}

type RasaAnswer =
  | { kind: "replies"; replies: RasaReply[] }
  | { kind: "empty" }      // Rasa answered, with nothing to show
  | { kind: "down"; timedOut: boolean };

async function askRasa(text: string): Promise<RasaAnswer> {
  if (Date.now() < rasaRestingUntil) return { kind: "down", timedOut: false };

  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CHAT_CONFIG.rasaTimeoutMs);

  try {
    const response = await fetch(`${RASA_URL}/webhooks/rest/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: senderId(), message: text }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("status");

    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("shape");

    const replies = data.map(usable).filter((r): r is RasaReply => r !== null);

    /* An empty list is Rasa working and having nothing to say to this —
       not Rasa being down, so it is not rested for it. */
    return replies.length ? { kind: "replies", replies } : { kind: "empty" };
  } catch {
    rasaRestingUntil = Date.now() + CHAT_CONFIG.rasaRetryAfterMs;

    return { kind: "down", timedOut };
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Rasa's own "I did not understand" — utter_default in rasa/domain.yml,
 * matched on its opening words. If that reply is reworded, this follows it.
 */
function isRasaFallback(text: string): boolean {
  return /^sorry, i did not quite get that/i.test(text);
}

export async function askAssistant(text: string): Promise<AskResult> {
  const rasa = await askRasa(text);

  if (rasa.kind === "replies") {
    const notUnderstood = rasa.replies.some((r) => isRasaFallback(r.text ?? ""));

    return {
      outcome: notUnderstood ? "not-understood" : "answered",
      replies: rasa.replies.map((reply) => ({
        id: nextLineId(),
        from: "bot" as const,
        text: reply.text ?? "",
        buttons: reply.buttons,
      })),
    };
  }

  /*
   * The built-in service-guide assistant: when Rasa is down, rested, or had
   * nothing to say. Its "I could not match your question" is kept as it is —
   * and is an ANSWER, not a failure: the question reached the chatbot and
   * was dealt with.
   */
  try {
    const response = await publicApi.askAssistant({ message: text }, { timeout: CHAT_CONFIG.assistantTimeoutMs });
    const answer: unknown = response?.data?.data?.answer;
    if (typeof answer !== "string" || !answer.trim()) throw new Error("shape");
    /* The questions related to this answer, from the same knowledge base
       Rasa is trained on — so what is offered next follows what was asked,
       Rasa or no Rasa. */
    const raw: unknown = response?.data?.data?.buttons;
    const buttons = Array.isArray(raw) ? raw.filter(isButton) : [];

    return {
      outcome: "answered",
      replies: [{ id: nextLineId(), from: "bot", text: answer, buttons: buttons.length ? buttons : undefined }],
    };
  } catch (err) {
    const assistantTimedOut = (err as { code?: string })?.code === "ECONNABORTED";
    const timedOut = (rasa.kind === "down" && rasa.timedOut) || assistantTimedOut;

    return {
      outcome: "failed",
      replies: [{
        id: nextLineId(),
        from: "bot",
        text: timedOut ? TIMEOUT_REPLY : OFFLINE_REPLY,
        buttons: [{ title: "Talk to Clerk", payload: "__live__" }],
      }],
    };
  }
}
