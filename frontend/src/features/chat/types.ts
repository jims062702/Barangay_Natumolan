/**
 * Live chat, as the desk and the widget see it.
 */

/** One live-agent conversation, as the Secretary's desk sees it. */
export interface ChatConversation {
  id: number;
  visitor_name: string;
  is_resident: boolean;
  resident_id?: number | null;
  guest_email?: string | null;
  guest_contact?: string | null;
  topic?: string | null;
  status: "Waiting" | "Active" | "Closed";
  assigned_to?: number | null;
  agent_name?: string | null;
  unread: number;
  last_message_at?: string | null;
  created_at?: string;
  closed_at?: string | null;

  /*
   * A resident who came back after this was closed, and how often.
   *
   * Once is somebody who forgot to ask something. Four times is a matter the
   * desk keeps closing without settling — which nothing else on the row says.
   */
  follow_up_count?: number;
  reopened_at?: string | null;
  /** When it was last closed, so the agent knows the gap they are answering across. */
  last_closed_at?: string | null;
}

export interface ChatMessage {
  id: number;
  /** `system` lines narrate the conversation (joined, closed, ...). */
  sender: "visitor" | "agent" | "system";
  sender_name?: string | null;
  body: string;
  created_at: string;
}

export interface ChatButton {
  title: string;
  payload: string;
}

/** One line in the widget's own thread — the assistant's or the visitor's. */
export interface WidgetMessage {
  id: number;
  from: "bot" | "user";
  text: string;
  buttons?: ChatButton[];
}

export interface RasaReply {
  text?: string;
  image?: string;
  buttons?: ChatButton[];
}

/** A certificate the office issues, with what it needs and costs. */
export interface CertificateService {
  certificate_type: string;
  fee: number;
  description?: string | null;
  requirements: string[];
}

/** One conversation the desk has finished with, as the list shows it. */
export interface PastConversation {
  session_token: string;
  status: string;
  started_at?: string | null;
  closed_at?: string | null;
  agent_name?: string | null;
  messages: number;
  opening?: string | null;
}
