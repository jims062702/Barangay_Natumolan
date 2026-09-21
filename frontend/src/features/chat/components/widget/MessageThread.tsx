import type { ChatWidgetState } from "../../hooks/useChatWidget";

/**
 * The conversation itself — with the assistant, or with the Clerk.
 */
export function MessageThread({ ctx }: { ctx: ChatWidgetState }) {
  const {
    listRef, mode, liveStatus, liveMessages, token, followUpBox, followUpFor, endLive,
    messages, send, typing,
  } = ctx;

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
<div key={message.id}>
{message.sender === "system" ? (
 <p className="mx-auto w-fit max-w-[90%] rounded-full bg-white/70 px-3 py-1 text-center text-[11px] text-gray-500">
   {message.body}
 </p>
) : (
 <div
   className={
     message.sender === "visitor"
       ? "ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-white"
       : "w-fit max-w-[85%] whitespace-pre-line rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm text-dark shadow-sm"
   }
 >
   {message.sender === "agent" && message.sender_name && (
     <span className="mb-0.5 block text-[11px] font-semibold text-primary">
       {message.sender_name}
     </span>
   )}
   {message.body}
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
<div key={message.id}>
<div
 className={
   message.from === "user"
     ? "ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-white"
     : "w-fit max-w-[85%] whitespace-pre-line rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm text-dark shadow-sm"
 }
>
 {message.text}
</div>
{message.from === "bot" && message.buttons && message.buttons.length > 0 && (
 <div className="mt-2 flex flex-wrap gap-1.5">
   {message.buttons.map((button, index) => (
     <button
       key={index}
       type="button"
       onClick={() => void send(button.payload, button.title)}
       className="cursor-pointer rounded-full border border-primary/40 bg-white px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
     >
       {button.title}
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
