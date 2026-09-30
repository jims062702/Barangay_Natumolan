/**
 * The suggested questions under the chatbot's latest message — always about
 * what the person has been asking.
 *
 * THEY SIT UNDER THE MESSAGE, in the conversation. A separate "Suggested
 * questions" strip above the box read as part of the page's furniture, not
 * as the chatbot's answer offering a next step, and it pushed the
 * conversation into a smaller space.
 *
 * WHAT THEY ARE, in order, until there are enough (MIN):
 *
 *   1. the latest message's own buttons — an answer's follow-ups from the
 *      knowledge base, or an action like Talk to Clerk
 *   2. when that message has no questions of its own — "You're sending
 *      messages too quickly", "you already asked this", "I could not
 *      understand" — the follow-ups of the last REAL answer, so the
 *      conversation carries on where it was rather than starting over
 *   3. the questions of the topic the person last asked about
 *   4. the general questions, so there is always somewhere to go
 *
 * The topic is read from what the PERSON asked, never from the answer: the
 * built-in assistant's "could not match" names every office, and would send
 * every conversation to the Health Station's questions.
 */

import { looksLikeGibberish } from "./chatGuard";
import type { ChatButton, WidgetMessage } from "../types";

export interface Suggestion {
  /** What the button says — short, so a row of them fits the panel. */
  label: string;
  /** What is sent when it is pressed. */
  question: string;
  /** What the conversation shows as asked, when that is not `question` —
      a follow-up sends "/ask_clearance_fee" and shows "Clearance fee". */
  display?: string;
}

export type Topic = "general" | "vawc" | "lupon" | "health" | "population" | "portal" | "certificates";

/** How many are offered under a message that brought fewer of its own. */
const MIN = 4;

/*
 * Each sends the INTENT itself ("/ask_office_hours") and shows the question
 * in full — so pressing one always gets its exact answer, from Rasa or from
 * the built-in assistant, however either would have read the words. Labels
 * are the knowledge base's own, so a follow-up and a topic question for the
 * same intent are recognised as one.
 *
 * "How do I file a complaint?" is the exception, sent as words: the widget
 * answers that one itself, differently for a resident and a guest, and
 * checks it for violence at home first (lib/complaintIntent.ts).
 */
const ask = (label: string, intent: string, display: string): Suggestion => ({ label, question: `/${intent}`, display });
const FILE_COMPLAINT: Suggestion = { label: "File a complaint", question: "How do I file a complaint?" };

export const SUGGESTIONS: Record<Topic, Suggestion[]> = {
  general: [
    ask("Office hours", "ask_office_hours", "What are the Barangay office hours?"),
    ask("Barangay Clearance", "ask_clearance", "How do I get a Barangay Clearance?"),
    ask("What certificates are available?", "ask_certificates", "What certificates are available?"),
    ask("Request online", "ask_request_online", "How do I request a certificate?"),
    FILE_COMPLAINT,
    ask("Health services", "ask_health", "What services are available at the Health Station?"),
  ],
  certificates: [
    ask("What certificates are available?", "ask_certificates", "What certificates are available?"),
    ask("How much are the fees?", "ask_fees", "How much are the certificate fees?"),
    ask("What do I need to bring?", "ask_requirements", "What are the requirements for a certificate?"),
    ask("Request online", "ask_request_online", "How do I request a certificate online?"),
  ],
  portal: [
    ask("Get a portal account", "ask_portal_account", "How do I get a resident portal account?"),
    ask("Activation code", "ask_activation_code", "Where is my activation code?"),
    ask("Forgot password", "ask_forgot_password", "I forgot my password. What do I do?"),
  ],
  vawc: [
    ask("Where is the VAWC Desk?", "ask_vawc_location", "How do I contact the VAWC Desk?"),
    ask("VAWC Desk", "ask_vawc_help", "What services does the VAWC Desk provide?"),
    ask("Barangay Protection Order", "ask_bpo", "What is a Barangay Protection Order?"),
  ],
  lupon: [
    FILE_COMPLAINT,
    ask("What happens at a hearing", "ask_hearing_what_happens", "What happens during a Barangay hearing?"),
    ask("The Lupon Tagapamayapa", "ask_lupon", "Where is the Lupon Tagapamayapa office?"),
  ],
  health: [
    ask("Health services", "ask_health", "What services are available at the Health Station?"),
    ask("Health Station hours", "ask_health_hours", "What are the Health Station hours?"),
    ask("Immunization", "ask_immunization", "When is the immunization schedule?"),
  ],
  population: [
    ask("Register as a resident", "ask_register_resident", "How do I register as a resident?"),
    ask("Population Office", "ask_population", "Where is the Population Office?"),
    ask("Registration documents", "ask_registration_documents", "What documents are needed for resident registration?"),
  ],
};

/* First match wins, and the order matters: a complaint about violence at
   home is a VAWC matter before it is a Lupon one, and "how much is a
   clearance for my store" is about certificates, not the portal. */
const TOPICS: [Topic, RegExp][] = [
  ["vawc", /\bvawc\b|violence|abuse|protection order|\bbpo\b|women and child|karahasan|sinaktan|binugbog/i],
  ["lupon", /complain|reklamo|sumbong|lupon|hearing|katarungang|dispute|\bkiha\b|summons|mediation|settlement/i],
  ["health", /health|bakuna|vaccin|immuni|check-?up|prenatal|medicine|gamot|doctor|nurse|clinic|\bbhw\b|maternal/i],
  ["population", /register|registration|census|rbim|household|population|birth|transfer/i],
  ["portal", /account|log ?in|sign ?in|password|portal|activation/i],
  ["certificates", /clearance|certificat|\bcert\b|indigency|residency|good moral|jobseeker|permit|\bfees?\b|magkano|\bpila\b|bayad|presyo|requirement/i],
];

export function topicOf(text: string | undefined): Topic {
  if (!text) return "general";

  return TOPICS.find(([, pattern]) => pattern.test(text))?.[0] ?? "general";
}

const isQuestion = (b: ChatButton) => !b.payload.startsWith("__");
const fromButton = (b: ChatButton): Suggestion => ({ label: b.title, question: b.payload, display: b.title });

/** What the person last asked before message `before`, in words — keyboard
    mashing says nothing about what they want. */
function askedBefore(messages: WidgetMessage[], before: number): string | undefined {
  for (let i = before - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.from === "user" && !looksLikeGibberish(m.text)) return m.text;
  }
  return undefined;
}

/** The suggestions to show under the latest chatbot message. */
export function suggestionsFor(messages: WidgetMessage[]): Suggestion[] {
  const latestAt = messages.map((m) => m.from).lastIndexOf("bot");
  const latest = messages[latestAt];
  const own = latest?.buttons ?? [];

  const lastAsked = askedBefore(messages, messages.length);
  const topic = topicOf(lastAsked);

  /*
   * The last REAL answer's follow-ups, when this message has no questions
   * of its own. An answer is a bot message that came after somebody asked
   * something — the welcome's buttons are a menu, not a conversation.
   */
  let context: ChatButton[] = [];
  let contextTopic: Topic = "general";
  if (!own.some(isQuestion)) {
    for (let i = latestAt - 1; i >= 0; i--) {
      const m = messages[i];
      const asked = askedBefore(messages, i);
      if (m.from === "bot" && asked !== undefined && m.buttons?.some(isQuestion)) {
        context = m.buttons.filter(isQuestion);
        contextTopic = topicOf(asked);
        break;
      }
    }
  }

  /*
   * Which comes first when the person has moved on: asked about clearances,
   * then about a baby's vaccination, the vaccination questions lead — the
   * clearance follow-ups are about the conversation they have left.
   */
  const topical = topic === "general" ? [] : SUGGESTIONS[topic];
  const ordered = topic === "general" || contextTopic === topic
    ? [...context.map(fromButton), ...topical]
    : [...topical, ...context.map(fromButton)];

  /* Violence at home is never offered the Katarungang Pambarangay form:
     the Lupon may not mediate it. */
  const general = topic === "vawc"
    ? SUGGESTIONS.general.filter((s) => s !== FILE_COMPLAINT)
    : SUGGESTIONS.general;

  const out: Suggestion[] = [];
  const seen = new Set<string>();
  /*
   * Once by what it SAYS and once by what it SENDS: a follow-up "Request
   * online" and a topic question for the same intent are one question.
   */
  const add = (s: Suggestion) => {
    const byLabel = "l:" + s.label.toLowerCase();
    const bySend = "q:" + s.question.toLowerCase();
    if (seen.has(byLabel) || seen.has(bySend)) return;
    seen.add(byLabel);
    seen.add(bySend);
    out.push(s);
  };

  own.forEach((b) => add(fromButton(b)));
  for (const s of [...ordered, ...general]) {
    if (out.length >= MIN) break;
    add(s);
  }

  return out;
}
