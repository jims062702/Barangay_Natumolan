import { FiClock, FiLogIn, FiPauseCircle } from "react-icons/fi";
import { describeLongWait, describeWait, describeWhen } from "../../lib/chatGuard";
import type { HoldReason } from "../../hooks/useChatGuard";

/**
 * Why the chatbot is not taking a question, said where the person is looking
 * — just above the box they were about to type in.
 *
 * The sentence is a polite live region, so a screen reader hears it once
 * when it appears. The countdown sits OUTSIDE that region: announced, it
 * would be read out every second for fifteen seconds.
 *
 * The one-second breath after each answer shows nothing — it is too short
 * to explain, and explaining it would make it feel longer than it is.
 */
export function ChatStatus({
  reason,
  waitMs,
  why,
  guestLeft,
  isGuest,
  onSignIn,
}: {
  reason: HoldReason | null;
  waitMs: number;
  why: "fast" | "similar";
  guestLeft: number;
  isGuest: boolean;
  onSignIn: () => void;
}) {
  if (reason === "guest") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-gray bg-primary/5 px-4 py-2.5">
        <div className="min-w-0 flex-1 text-xs leading-relaxed text-dark">
          {/* Short: the full sentence is already in the conversation above.
              This row is what stays in view — the state, and the way out. */}
          <p role="status">Guest chat limit reached — log in as a resident to keep chatting.</p>
          {/* When it lifts, counting down by the minute — the long cousin of
              "Try again in 15 seconds". */}
          {waitMs > 0 && (
            <p className="mt-0.5 font-semibold tabular-nums">
              Or chat again as a guest in {describeLongWait(waitMs)} ({describeWhen(Date.now() + waitMs)}).
            </p>
          )}
          {/* A held chat must never be the thing between somebody and help. */}
          <p className="mt-0.5 font-semibold">In an emergency, call 911.</p>
        </div>
        <button
          type="button"
          onClick={onSignIn}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          <FiLogIn className="h-3.5 w-3.5" aria-hidden="true" /> Login as Resident
        </button>
      </div>
    );
  }

  if (reason === "cooldown" || reason === "paused") {
    const Icon = reason === "paused" ? FiPauseCircle : FiClock;

    return (
      <div className="flex items-start gap-2.5 border-t border-gray bg-warning/10 px-4 py-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0 text-xs leading-relaxed text-dark">
          {/* The reason is in the conversation above; this row keeps the wait
              in view while it runs. */}
          <p role="status">
            {reason === "paused"
              ? "The chat is taking a short break."
              : why === "similar"
                ? "Please wait a moment before asking again."
                : "You’re sending messages too quickly."}
          </p>
          <p className="mt-0.5 font-semibold tabular-nums">Try again in {describeWait(waitMs)}.</p>
          <p className="mt-0.5">In an emergency, call 911.</p>
        </div>
      </div>
    );
  }

  /* A gentle word before the limit arrives, rather than a wall when it does. */
  if (isGuest && guestLeft > 0 && guestLeft <= 2) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray bg-secondary/60 px-4 py-2">
        <p role="status" className="min-w-0 flex-1 text-[11px] leading-relaxed text-gray-500">
          {guestLeft} guest {guestLeft === 1 ? "message" : "messages"} left today. Residents can keep chatting after logging in.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="shrink-0 cursor-pointer text-[11px] font-semibold text-primary hover:underline"
        >
          Login as Resident
        </button>
      </div>
    );
  }

  return null;
}
