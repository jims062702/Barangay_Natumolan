import type { ChatWidgetState } from "../../hooks/useChatWidget";
import type { PastConversation } from "../../types";

/**
 * A resolved conversation, read back.
 */
export function PastConversationReader({ ctx, reading }: {
  ctx: ChatWidgetState;
  reading: PastConversation;
}) {
  const { setReading, setReadingMessages, setShowPast, readingMessages, followUpBox } = ctx;

  return (
    <div className="flex-1 overflow-y-auto bg-secondary/60 px-4 py-4">
      <button
        type="button"
        onClick={() => { setReading(null); setReadingMessages([]); setShowPast(true); }}
        className="mb-3 cursor-pointer text-xs font-semibold text-primary hover:underline"
      >
        &larr; Back to your conversations
      </button>

      <p className="mb-3 text-[11px] leading-relaxed text-gray-500">
        {reading.agent_name
          ? `Answered by ${reading.agent_name}`
          : "From the barangay desk"}
        {reading.closed_at
          ? ` · resolved ${new Date(reading.closed_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}`
          : ""}
      </p>

      <div className="space-y-3">
        {readingMessages.map((message) => (
          <div key={message.id}>
            {message.sender === "system" ? (
              <p className="mx-auto w-fit max-w-[90%] rounded-full bg-white/70 px-3 py-1 text-center text-[11px] text-gray-500">
                {message.body}
              </p>
            ) : (
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                  message.sender === "visitor"
                    ? "ml-auto bg-primary text-white"
                    : "bg-white text-dark"
                }`}
              >
                {message.body}
              </div>
            )}
          </div>
        ))}
      </div>

      {/*
        The same offer, on an older thread. A resident reading back
        through what they were told is exactly the person who realises
        they have one more question.
      */}
      {reading.status === "Closed" && (
        <div className="mt-4 space-y-2 rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
          <p className="text-xs text-gray-500">
            Still need something on this? Ask here and the desk picks up
            the same conversation.
          </p>
          {followUpBox(reading.session_token)}
        </div>
      )}
    </div>
  );
}
