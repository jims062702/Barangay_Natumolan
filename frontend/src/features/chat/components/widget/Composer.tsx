import { useLayoutEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { FiSend } from "react-icons/fi";
import { CHAT_CONFIG } from "../../lib/chatConfig";

/** Lines the box grows to before it scrolls inside itself. */
const MAX_LINES = 5;

const LIMIT = CHAT_CONFIG.maxMessageLength;

/**
 * The box a message is typed into.
 *
 * IT GROWS. It was a one-line <input>, so a question longer than the box
 * scrolled sideways out of sight while it was being typed. A textarea wraps
 * onto the next line and grows with it, up to five lines, and then scrolls
 * within itself so the panel's buttons are never pushed off the screen.
 *
 * THE COUNT IS ALWAYS THERE — "1,000 characters remaining" before a word is
 * typed — so the limit is known before it matters, not discovered at it.
 * It counts what is in the box as it stands; spaces at the ends are trimmed
 * when the message is SENT, never while it is being typed.
 *
 * Enter sends and Shift+Enter is a new line; Enter while sending is held
 * does nothing, so it cannot go round the Send button's own rules.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  disabled = false,
  sendDisabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  placeholder: string;
  label: string;
  /** The box itself cannot be typed in (a closed conversation, the guest limit). */
  disabled?: boolean;
  /** Typing is fine, sending is held (a question in flight, a cooldown). */
  sendDisabled?: boolean;
}) {
  const box = useRef<HTMLTextAreaElement | null>(null);
  const form = useRef<HTMLFormElement | null>(null);

  /* Measured after every change, before paint, so the box never flickers
     between one height and the next. */
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;

    el.style.height = "auto";
    const style = getComputedStyle(el);
    const line = parseFloat(style.lineHeight) || 20;
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const cap = line * MAX_LINES + padding;

    el.style.height = `${Math.min(el.scrollHeight, cap)}px`;
    el.style.overflowY = el.scrollHeight > cap ? "auto" : "hidden";
  }, [value]);

  const blocked = disabled || sendDisabled || !value.trim() || value.length > LIMIT;

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    if (!blocked) form.current?.requestSubmit();
  };

  const remaining = Math.max(0, LIMIT - value.length);
  const band = remaining === 0 ? "limit" : remaining <= CHAT_CONFIG.counterWarnAt ? "near" : "ok";

  return (
    <form ref={form} onSubmit={onSubmit} className="border-t border-gray bg-white px-3 pt-3 pb-2">
      <div className="flex items-end gap-2">
        <textarea
          ref={box}
          rows={1}
          value={value}
          /* maxLength stops typing and trims a paste; this holds the same
             line for text that arrives any other way — dictation, autofill,
             an extension filling the box. */
          onChange={(e) => onChange(e.target.value.slice(0, LIMIT))}
          onKeyDown={onKeyDown}
          maxLength={LIMIT}
          placeholder={placeholder}
          aria-label={label}
          aria-describedby={disabled ? undefined : "chat-char-count"}
          disabled={disabled}
          className="block max-h-40 min-h-[2.625rem] flex-1 resize-none rounded-2xl border border-gray bg-secondary/60 px-4 py-2.5 text-sm leading-5 text-dark outline-none transition [overflow-wrap:anywhere] focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={blocked}
          className="flex h-[2.625rem] w-[2.625rem] shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiSend className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Not under a box that cannot be typed in — the guest limit, a closed
          conversation — where it only takes room from the thread. */}
      {!disabled && (
        <div className="mt-1 flex min-h-4 items-center justify-between gap-2 px-1 text-[11px]">
          {/* A phone has no Shift key to speak of; the hint is for a keyboard. */}
          <span className="hidden text-gray-400 sm:inline">Shift + Enter for a new line</span>
          <span
            id="chat-char-count"
            className={`ml-auto tabular-nums ${
              band === "limit" ? "font-semibold text-danger" : band === "near" ? "font-medium text-warning" : "text-gray-400"
            }`}
          >
            {remaining.toLocaleString("en-PH")} {remaining === 1 ? "character" : "characters"} remaining
          </span>
          {/*
            Announced only when the band changes — near the limit, at it — and
            not on every keystroke, which would read out a number with each
            letter typed.
          */}
          <span className="sr-only" aria-live="polite">
            {band === "limit"
              ? "Character limit reached."
              : band === "near"
                ? `${CHAT_CONFIG.counterWarnAt} characters or fewer remaining.`
                : ""}
          </span>
        </div>
      )}
    </form>
  );
}
