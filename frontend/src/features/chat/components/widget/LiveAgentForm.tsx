import type { ChatWidgetState } from "../../hooks/useChatWidget";

/**
 * Who are you, and what do you need — before the Clerk is asked to join.
 */
export function LiveAgentForm({ ctx }: { ctx: ChatWidgetState }) {
  const { startLive, liveError, user, firstMessage, setFirstMessage, setMode, starting } = ctx;

  return (
    <form onSubmit={startLive} className="flex-1 space-y-3 overflow-y-auto bg-secondary/60 px-4 py-4">
      <p className="rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed text-dark shadow-sm">
        I&rsquo;ll pass you to the <strong>Barangay Clerk</strong> — office hours are
        Mon–Fri, 8:00 AM–5:00 PM.
      </p>
      {liveError && (
        <p className="rounded-xl bg-danger/10 px-4 py-2.5 text-xs font-medium text-danger">{liveError}</p>
      )}
      {/*
        Nothing is asked about who they are. They are signed in, so the
        barangay already has their name, their purok and their number —
        and the Clerk sees all three when the chat arrives.
      */}
      <p className="rounded-xl bg-primary/10 px-4 py-2.5 text-xs leading-relaxed text-dark">
        Signed in as <strong>{user?.name}</strong>. The Clerk will see your resident
        record, so there is nothing else to fill in.
      </p>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-dark">How can we help?</span>
        <textarea
          value={firstMessage}
          onChange={(e) => setFirstMessage(e.target.value)}
          required
          rows={3}
          placeholder="Describe what you need…"
          className="w-full rounded-xl border border-gray bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("bot")}
          className="flex-1 cursor-pointer rounded-full border border-gray bg-white py-2.5 text-xs font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
        >
          Back to the assistant
        </button>
        <button
          type="submit"
          disabled={starting || !firstMessage.trim()}
          className="flex-1 cursor-pointer rounded-full bg-primary py-2.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {starting ? "Connecting…" : "Start the chat"}
        </button>
      </div>
    </form>
  );
}
