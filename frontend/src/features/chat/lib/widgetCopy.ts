/**
 * The widget's fixed settings and words.
 */

import type { WidgetMessage } from "../types";

export const RASA_URL =
  (import.meta.env.VITE_RASA_URL as string | undefined) ?? "http://localhost:5005";

/** How often the live conversation is refreshed while the panel is open. */
export const LIVE_POLL_MS = 4000;

export const WELCOME: WidgetMessage = {
  id: 0,
  from: "bot",
  text:
    "Kumusta! 👋 I'm the Barangay Natumolan assistant. Ask me about certificates, " +
    "fees, requirements, office hours, or how to use the resident portal.\n\n" +
    "Need a real person? Tap “Talk to Clerk” below and I'll put you through.",
  buttons: [
    { title: "What certificates can I get?", payload: "What certificates can I get?" },
    { title: "How much are the fees?", payload: "How much are the certificate fees?" },
    { title: "Office hours", payload: "What are your office hours?" },
    { title: "How do I get a portal account?", payload: "How do I get a resident portal account?" },
    { title: "Who developed this?", payload: "Who developed the Barangay Natumolan System?" },
  ],
};

/**
 * What the bubble says, in turn.
 *
 * The first line has to say what it IS — a round purple circle in the corner
 * of a barangay website is not obviously anything, and a resident who has
 * never used a chat widget reads it as decoration. The rest give a reason to
 * press it: somebody who does not know they can ask has no reason to.
 */
export const HINT_LINES = [
  "Hi! I am the barangay chatbot.",
  "Ask me what a certificate needs.",
  "Barangay help — one tap away.",
];
