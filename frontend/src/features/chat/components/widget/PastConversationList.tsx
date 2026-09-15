import type { ChatWidgetState } from "../../hooks/useChatWidget";

/**
 * The resident's earlier conversations with the desk.
 */
export function PastConversationList({ ctx }: { ctx: ChatWidgetState }) {
  const { setShowPast, past, readPast } = ctx;

  return (
    <div className="flex-1 overflow-y-auto bg-secondary/60 px-4 py-4">
      <button
        type="button"
        onClick={() => setShowPast(false)}
        className="mb-3 cursor-pointer text-xs font-semibold text-primary hover:underline"
      >
        &larr; Back to the assistant
      </button>

      <p className="mb-2 text-xs font-bold text-dark">Your conversations</p>

      {past.length === 0 ? (
        <div aria-hidden="true" className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className="block h-9 animate-pulse rounded-xl bg-gray" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {past.map((row) => (
            <button
              key={row.session_token}
              type="button"
              onClick={() => void readPast(row)}
              className="block w-full cursor-pointer rounded-xl border border-gray bg-white px-3 py-2 text-left transition-colors hover:border-primary"
            >
              <p className="truncate text-xs font-medium text-dark">
                {row.opening || "Conversation with the barangay"}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">
                {row.closed_at
                  ? new Date(row.closed_at).toLocaleDateString("en-PH", { dateStyle: "medium" })
                  : ""}
                {row.agent_name ? ` · ${row.agent_name}` : ""}
                {` · ${row.messages} message${row.messages === 1 ? "" : "s"}`}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
