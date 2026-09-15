import { ensureNotifyPermission } from "../../../../shared/lib/desktopNotify";
import { HINT_LINES } from "../../lib/widgetCopy";
import type { ChatWidgetState } from "../../hooks/useChatWidget";

/**
 * What the button is, in words, beside the launcher.
 */
export function HintBubble({ ctx }: { ctx: ChatWidgetState }) {
  const { setOpen, thinking, typed, line } = ctx;

  return (
    <div className="pointer-events-none fixed bottom-5 right-4 z-50 flex h-14 items-center pr-[4.25rem] sm:right-6">
      <button
        type="button"
        onClick={() => {
          /* No dismissal here any more: opening hides the bubble through
             `!open`, and closing arms it again. */
          setOpen(true);
          void ensureNotifyPermission();
        }}
        /*
          A fixed label, and no live region. The words in the bubble
          rotate to catch an eye; announcing all three on a loop to
          somebody using a screen reader would be noise, and the button
          still only does the one thing.
        */
        aria-label="Chat with the barangay assistant"
        className="chat-hint pointer-events-auto relative flex min-h-[2.75rem] max-w-[11rem] cursor-pointer items-center rounded-2xl bg-dark px-4 py-2.5 text-left text-sm font-medium leading-snug text-white shadow-xl sm:max-w-[15rem]"
      >
        {thinking ? (
          /* Three dots, the way a chat says it is about to speak. */
          <span aria-hidden="true" className="flex items-center gap-1 py-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="chat-dot h-1.5 w-1.5 rounded-full bg-white"
                style={{ animationDelay: `${i * 160}ms` }}
              />
            ))}
          </span>
        ) : (
          <span aria-hidden="true">
            {typed}
            {/* The caret stops the moment the line is finished, so a
                resting sentence does not look like it is still being
                written. */}
            {typed.length < HINT_LINES[line].length && (
              <span className="chat-caret ml-0.5 font-normal">|</span>
            )}
          </span>
        )}

        {/* The tail, pointing at the button. */}
        <span
          aria-hidden="true"
          className="absolute -right-1 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-dark"
        />
      </button>
    </div>
  );
}
