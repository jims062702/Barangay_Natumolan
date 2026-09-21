import { FiFileText, FiHeadphones, FiMessageCircle, FiSend, FiX } from "react-icons/fi";
import { ensureNotifyPermission } from "../../../shared/lib/desktopNotify";
import { useChatWidget } from "../hooks/useChatWidget";
import { ChatHeader } from "./widget/ChatHeader";
import { SignInPrompt } from "./widget/SignInPrompt";
import { LiveAgentForm } from "./widget/LiveAgentForm";
import { CertificateRequestPanel } from "./widget/CertificateRequestPanel";
import { PastConversationList } from "./widget/PastConversationList";
import { PastConversationReader } from "./widget/PastConversationReader";
import { MessageThread } from "./widget/MessageThread";
import { HintBubble } from "./widget/HintBubble";

/**
 * Floating chat (bottom-right), with two modes.
 *
 * BOT — talks to a Rasa server through its REST channel, falling back to the
 * built-in service-guide assistant (POST /api/assistant/inquiry) so the widget
 * always answers.
 *
 * LIVE — hands the conversation to a person. The BARANGAY SECRETARY staffs
 * that desk. It is plain polling rather than a websocket: the barangay runs
 * this on one machine, and a socket server nobody restarts after a power cut
 * is worse than a request every few seconds.
 */
export default function ChatWidget() {
  const ctx = useChatWidget();
  const {
    open, setOpen, input, setInput, typing, isResident, hint, mode, liveStatus, queuePosition,
    queueTotal, picking, showPast, reading, handleSubmit, startHandoff, openRequest, endLive,
  } = ctx;

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Barangay Natumolan assistant"
          className="fixed bottom-24 right-4 z-50 flex max-h-[min(37rem,calc(100dvh-8rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-gray bg-white shadow-2xl shadow-primary/20 sm:right-6"
        >
          {/* Header */}
          <ChatHeader ctx={ctx} />

          {/* Body */}
          {mode === "signin" ? (
            /*
              The desk is one Clerk at a time, so the queue is only as
              useful as it is short. Keeping it to registered residents is
              what makes a queue number mean anything — and it means whoever
              is answered can actually be looked up, and reached afterwards.
            */
            <SignInPrompt ctx={ctx} />
          ) : mode === "form" ? (
            /* Who are you, and what do you need? Kept to three fields — the
               person is already frustrated enough to want a human. */
            <LiveAgentForm ctx={ctx} />
          ) : picking ? (
            /*
              Requesting a certificate, as a panel of its own.

              It was a strip wedged between the thread and the buttons, which
              left it about eighty pixels tall — the requirements, the fee,
              the purpose box and the send button all fighting for a space
              none of them fitted in. A form nobody can read is a form nobody
              fills in correctly.
            */
            <CertificateRequestPanel ctx={ctx} />
          ) : showPast && !reading ? (
            /*
              The list, as a panel of its own rather than a block inside the
              thread — so it covers nothing and needs no scrolling to find.
              Labelled by what the resident opened with, because a column of
              dates says nothing about which one was about the clearance.
            */
            <PastConversationList ctx={ctx} />
          ) : reading ? (
            /*
              A resolved conversation, read back.

              Read-only on purpose: it is a record of what was said, not a way
              to say more. Somebody who needs to ask again starts a new one,
              which is what the desk expects and what keeps the two threads
              from being confused for one.
            */
            <PastConversationReader ctx={ctx} reading={reading} />
          ) : (            <MessageThread ctx={ctx} />
          )}

          {isResident && !picking && !showPast && !reading && liveStatus !== "Closed" && (
            <button
              type="button"
              onClick={() => void openRequest()}
              className="flex cursor-pointer items-center justify-center gap-2 border-t border-gray bg-white px-4 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              <FiFileText className="h-4 w-4" aria-hidden="true" />
              Request a certificate
            </button>
          )}

          {/* Handoff / end bar */}
          {mode === "bot" && !picking && !showPast && !reading && (
            <button
              type="button"
              onClick={startHandoff}
              className="flex cursor-pointer items-center justify-center gap-2 border-t border-gray bg-white px-4 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              <FiHeadphones className="h-4 w-4" aria-hidden="true" />
              Talk to Clerk (live agent)
            </button>
          )}
          {/*
            Where they stand. "Waiting" on its own tells somebody nothing
            about whether to keep the tab open or come back later; a position
            and a total tell them exactly that.
          */}
          {mode === "live" && liveStatus === "Waiting" && queuePosition !== null && (
            <div className="border-t border-gray bg-warning/10 px-4 py-2.5">
              <p className="text-xs font-semibold text-dark">
                {queuePosition === 1
                  ? "You are next — the Clerk will be with you shortly."
                  : `You are number ${queuePosition} in the queue.`}
              </p>
              {queueTotal > 1 && (
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {queuePosition === 1
                    ? `${queueTotal} waiting in total.`
                    : `${queuePosition - 1} ${queuePosition - 1 === 1 ? "person is" : "people are"} ahead of you.`}{" "}
                  The desk answers one person at a time. You can keep typing — your messages are
                  saved, and you will be notified when the Clerk joins.
                </p>
              )}
            </div>
          )}

          {mode === "live" && liveStatus !== "Closed" && (
            <button
              type="button"
              onClick={endLive}
              className="cursor-pointer border-t border-gray bg-white px-4 py-2 text-xs font-medium text-gray-500 transition-colors hover:text-danger"
            >
              End this conversation
            </button>
          )}

          {/*
            Input, hidden while a form or a past conversation is open.

            Nothing typed there would go anywhere useful — the request panel
            has its own box, and a resolved thread cannot be replied to — and
            a composer that looks live but is not is worse than no composer.
          */}
          {mode !== "form" && mode !== "signin" && !picking && !showPast && !reading && (
            <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-gray bg-white px-3 py-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  mode === "live"
                    ? liveStatus === "Closed"
                      ? "This conversation has ended"
                      : "Message the Clerk…"
                    : "Type your question…"
                }
                aria-label={mode === "live" ? "Message the Clerk" : "Type your question"}
                disabled={mode === "live" && liveStatus === "Closed"}
                className="flex-1 rounded-full border border-gray bg-secondary/60 px-4 py-2.5 text-sm text-dark outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={!input.trim() || typing || (mode === "live" && liveStatus === "Closed")}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiSend className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      )}

      {/*
        What the button IS, in words.

        Sits in its own fixed box the same height as the launcher, so it stays
        vertically centred against it whether it is showing three dots or two
        lines of text — and the box ignores pointer events, so the page
        underneath is still clickable everywhere except the bubble.
      */}
      {hint && !open && (
        <HintBubble ctx={ctx} />
      )}

      {/* Floating launcher — bottom right */}
      <button
        type="button"
        aria-label={open ? "Close the barangay assistant" : "Chat with the barangay assistant"}
        onClick={() => {
          /* The bubble follows `open` on its own now — hidden while the panel
             is up, back a beat after it closes. */
          setOpen((o) => !o);
          // Opening the chat is a good moment to ask for desktop-alert
          // permission (a user gesture) — enables reply popups when tabbed away.
          void ensureNotifyPermission();
        }}
        className="fixed bottom-5 right-4 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/40 transition-all duration-300 hover:scale-110 hover:bg-primary-dark sm:right-6"
      >
        {open ? <FiX className="h-6 w-6" /> : <FiMessageCircle className="h-6 w-6" />}
        {!open && (
          // `animate-ping` (scale 2) reached past the screen edge and gave the
          // whole page a sideways scroll — see `ping-contained` in index.css.
          <span
            aria-hidden="true"
            className="animate-ping-contained absolute inset-0 -z-10 rounded-full bg-primary/40"
          />
        )}
      </button>
    </>
  );
}

