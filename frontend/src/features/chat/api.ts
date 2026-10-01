/** Live chat — the resident's widget and the Clerk's desk. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const chatApi = {
  conversation: (conversationId: PathParam, ...args: QueryArgs) =>
    api.get(`/chat/${conversationId}`, ...args),
  endConversation: (conversationId: PathParam, ...args: BodyArgs) =>
    api.post(`/chat/${conversationId}/end`, ...args),
  followUp: (conversationId: PathParam, ...args: BodyArgs) =>
    api.post(`/chat/${conversationId}/follow-up`, ...args),
  sendMessage: (conversationId: PathParam, ...args: BodyArgs) =>
    api.post(`/chat/${conversationId}/messages`, ...args),
  deskConversations: (...args: QueryArgs) =>
    api.get("/chat/conversations", ...args),
  /** The counts on the desk's tabs, and what the desk rings for. */
  deskCounts: (...args: QueryArgs) =>
    api.get("/chat/queue/count", ...args),
  deskConversation: (conversationId: PathParam, ...args: QueryArgs) =>
    api.get(`/chat/conversations/${conversationId}`, ...args),
  claimConversation: (conversationId: PathParam, ...args: BodyArgs) =>
    api.post(`/chat/conversations/${conversationId}/claim`, ...args),
  closeConversation: (conversationId: PathParam, ...args: BodyArgs) =>
    api.post(`/chat/conversations/${conversationId}/close`, ...args),
  reply: (conversationId: PathParam, ...args: BodyArgs) =>
    api.post(`/chat/conversations/${conversationId}/reply`, ...args),
  history: (...args: QueryArgs) =>
    api.get("/chat/history", ...args),
  mine: (...args: QueryArgs) =>
    api.get("/chat/mine", ...args),
  shortcuts: (...args: QueryArgs) =>
    api.get("/chat/shortcuts", ...args),
  start: (...args: BodyArgs) =>
    api.post("/chat/start", ...args),
};
