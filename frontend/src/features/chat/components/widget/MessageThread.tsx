import type { ChatWidgetState } from "../../hooks/useChatWidget";
import { ChatText } from "./ChatText";
import { suggestionsFor } from "../../lib/suggestions";

/**
 * The conversation itself — with the assistant, or with the Clerk.
 */
export function MessageThread({ ctx }: { ctx: ChatWidgetState }) {
  const {
    listRef, mode, liveStatus, liveMessages, token, followUpBox, followUpFor, endLive,
    messages, send, typing, hold,
  } = ctx;
  const held = typing || (hold.reason !== null && hold.reason !== "guest");
  /* The latest message carries the suggested questions (its own buttons
     among them); older answers keep their buttons where they were. */
  const latestBotId = [...messages].reverse().find((m) => m.from === "bot")?.id;
  const suggestions = suggestionsFor(messages);
  const goesSomewhere = (payload: string) => ["__live__", "__complaint__", "__vawc__", "__certificate__", "__login__"].includes(payload);

  return (
    <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-secondary/60 px-4 py-4">
{mode === "live" ? (
<>
{liveStatus === "Waiting" && (
<p className="rounded-2xl bg-warning/15 px-4 py-2.5 text-xs leading-relaxed text-dark">
You are in the queue. The Barangay Clerk will join shortly — you can keep
typing in the meantime, and everything you send will be waiting for them.
</p>
)}
{liveMessages.map((message) => (
<div key={message.id} data-chat-line="" data-from={message.sender}>
{message.sender === "system" ? (
 <p className="mx-auto w-fit max-w-[90%] rounded-full bg-white/70 px-3 py-1 text-center text-[11px] text-gray-500">
   {message.body}
 </p>
) : (
 <div
   className={
     message.sender === "visitor"
       ? "ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-white"
       : "w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm text-dark shadow-sm"
   }
 >
   {message.sender === "agent" && message.sender_name && (
     <span className="mb-0.5 block text-[11px] font-semibold text-primary">
       {message.sender_name}
     </span>
   )}
   <ChatText text={message.body} />
 </div>
)}
</div>
))}
{liveStatus === "Closed" && (
<div className="space-y-2 rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
<p className="text-xs text-gray-500">
 This conversation has ended. If something is still unclear you
 can ask here — it goes back to the same desk with everything
 already said.
</p>
{token && followUpBox(token)}
{followUpFor !== token && (
 <button
   type="button"
   onClick={endLive}
   className="block w-full cursor-pointer text-xs font-medium text-gray-500 hover:text-primary"
 >
   Back to the assistant
 </button>
)}
</div>
)}
</>
) : (
<>
{messages.map((message) => (
<div key={message.id} data-chat-line="" data-from={message.from}>
<div
 className={
   message.from === "user"
     ? "ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-white"
     : "w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm text-dark shadow-sm"
 }
>
 <ChatText text={message.text} />
</div>
{message.from === "bot" && message.id !== latestBotId && message.buttons && message.buttons.length > 0 && (
 <div className="mt-2 flex flex-wrap gap-1.5">
   {message.buttons.map((button, index) => (
     <button
       key={index}
       type="button"
       onClick={() => void send(button.payload, button.title)}
       disabled={held && !goesSomewhere(button.payload)}
       className="cursor-pointer rounded-full border border-primary/40 bg-white px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-primary"
     >
       {button.title}
     </button>
   ))}
 </div>
)}
{/*
  The suggested questions, under the LATEST message — the chatbot offering
  the next step, where the person is reading. Always there, and always about
  what they have been asking: see lib/suggestions.ts. They go through the
  same `send` as the box, so the same limits apply to them.
*/}
{message.from === "bot" && message.id === latestBotId && suggestions.length > 0 && (
 <div role="group" aria-label="Suggested questions" className="mt-2 flex flex-wrap gap-1.5">
   {suggestions.map((item) => (
     <button
       key={item.question}
       type="button"
       onClick={() => void send(item.question, item.display)}
       disabled={held && !goesSomewhere(item.question)}
       aria-label={goesSomewhere(item.question) ? item.label : `Ask: ${item.display ?? item.question}`}
       className="cursor-pointer rounded-full border border-primary/40 bg-white px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-primary"
     >
       {item.label}
     </button>
   ))}
 </div>
)}
</div>
))}
{typing && (
<div aria-label="Assistant is typing" className="flex w-fit gap-1.5 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
{[0, 1, 2].map((n) => (
 <span
   key={n}
   className="h-2 w-2 animate-bounce rounded-full bg-primary/60"
   style={{ animationDelay: `${n * 150}ms` }}
 />
))}
</div>
)}
</>
)}
</div>
  );
}
