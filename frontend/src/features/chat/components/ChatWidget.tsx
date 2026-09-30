import { FiEdit3, FiFileText, FiHeadphones, FiMessageCircle, FiShield, FiX } from "react-icons/fi";
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
import { Composer } from "./widget/Composer";
import { ChatStatus } from "./widget/ChatStatus";
import { describeWhen } from "../lib/chatGuard";

/**
 * Floating chat (bottom-right), with two modes.
 *
 * BOT — talks to a Rasa server through its REST channel, falling back to the
 * built-in service-guide assistant (POST /api/assistant/inquiry) so the widget
 * always answers.
 *
 * LIVE — hands the conversation to a person. The BARANGAY CLERK staffs
 * that desk. It is plain polling rather than a websocket: the barangay runs
 * this on one machine, and a socket server nobody restarts after a power cut
 * is worse than a request every few seconds.
 */
export default function ChatWidget() {
  const ctx = useChatWidget();
  const {
    open, setOpen, expanded, input, setInput, typing, isResident, hint, mode, liveStatus, queuePosition,
    queueTotal, closesAt, picking, showPast, reading, handleSubmit, startHandoff, openRequest, endLive,
    openComplaintForm, openVawcForm, openCertificatePage, hold, cooldownWhy, guestLeft, isGuest, goSignIn,
  } = ctx;

  const botHeld = typing || hold.reason !== null;

  return (
    <>
      {/* Chat panel */}
      {open && (
        /*
          THE SIZE (2026-09-29). It was a 24rem box at most 37rem tall, and
          the three buttons, "Talk to Clerk", the guest notice and the box
          under it left the conversation itself a strip a few lines high.

            phone    the whole screen; the launcher is hidden under it, and
                     the header's X closes it
            laptop   28–30rem wide, as tall as the screen allows, above the
                     launcher
            bigger   the header's button: top to bottom, up to 48rem wide
        */
        <div
          role="dialog"
          aria-label="Barangay Natumolan assistant"
          data-size={expanded ? "bigger" : "normal"}
          className={`fixed bottom-2 left-2 right-2 top-2 z-50 flex flex-col overflow-hidden rounded-3xl border border-gray bg-white shadow-2xl shadow-primary/20 sm:left-auto sm:right-6 ${
            expanded
              ? "sm:bottom-4 sm:top-4 sm:w-[min(48rem,calc(100vw-3rem))]"
              : "sm:bottom-24 sm:top-auto sm:h-[min(46rem,calc(100dvh-7.5rem))] sm:w-[28rem] lg:w-[30rem]"
          }`}
        >
          {/* Header */}
          <ChatHeader ctx={ctx} />

          {/* Body */}
          {mode === "signin" ? (
            /*
              The desk is the Clerk, taking people in turn, so the queue is
              only as useful as it is short. Keeping it to registered residents is
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

          {/*
            The things somebody can START from here, side by side.

            Filing a complaint opens the real form rather than a panel inside
            this one: it asks for a photograph of an ID and, for somebody not
            signed in, who they are — too much for a 24rem chat, and exactly
            what the page is built for. Offered to everybody, because a
            complaint may be filed by somebody who is not a resident at all.

            A certificate and a VAWC complaint are offered to a guest too
            (2026-09-29): a resident who is not signed in asks with their
            Barangay Resident ID, on the page for it. A signed-in resident
            asks for a certificate here, inside the chat.
          */}
          {!picking && !showPast && !reading && liveStatus !== "Closed" && (
            <div className="flex divide-x divide-gray border-t border-gray bg-white">
              <button
                type="button"
                onClick={() => (isResident ? void openRequest() : openCertificatePage())}
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 px-2 py-2 text-xs font-semibold leading-tight text-primary transition-colors hover:bg-primary/5"
              >
                <FiFileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                Request a certificate
              </button>
              <button
                type="button"
                onClick={openComplaintForm}
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 px-2 py-2 text-xs font-semibold leading-tight text-primary transition-colors hover:bg-primary/5"
              >
                <FiEdit3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                File a complaint
              </button>
              <button
                type="button"
                onClick={openVawcForm}
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 px-2 py-2 text-xs font-semibold leading-tight text-primary transition-colors hover:bg-primary/5"
              >
                <FiShield className="h-4 w-4 shrink-0" aria-hidden="true" />
                VAWC complaint
              </button>
            </div>
          )}

          {/* Handoff / end bar */}
          {mode === "bot" && !picking && !showPast && !reading && (
            <button
              type="button"
              onClick={startHandoff}
              className="flex cursor-pointer items-center justify-center gap-2 border-t border-gray bg-white px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
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
                  The Clerk answers people in the order they came. You can keep typing — your
                  messages are saved, and you will be notified when the Clerk joins.
                </p>
              )}
            </div>
          )}

          {/*
            The Clerk has answered and the next word is theirs. Said before it
            happens, so a conversation closing by itself is never a surprise —
            and so nobody thinks it is gone for good.
          */}
          {mode === "live" && liveStatus !== "Closed" && closesAt && (
            <p className="border-t border-gray bg-secondary/60 px-4 py-2 text-[11px] leading-relaxed text-gray-500">
              If there is no reply from you by {describeWhen(new Date(closesAt).getTime())}, this conversation
              closes on its own. You can still follow up on it afterwards.
            </p>
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
          {/*
            The reason for any hold, just above the box — the assistant's
            only. The live desk is a person: nothing here limits what is said
            to the Clerk, and the Clerk is always one button away from
            somebody the assistant cannot help. (The suggested questions are
            in the conversation, under the latest message.)
          */}
          {mode === "bot" && !picking && !showPast && !reading && (
            <>
              <ChatStatus
                reason={hold.reason}
                waitMs={hold.waitMs}
                why={cooldownWhy}
                guestLeft={guestLeft}
                isGuest={isGuest}
                onSignIn={goSignIn}
              />
            </>
          )}

          {mode !== "form" && mode !== "signin" && !picking && !showPast && !reading && (
            <Composer
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              placeholder={
                mode === "live"
                  ? liveStatus === "Closed"
                    ? "This conversation has ended"
                    : "Message the Clerk…"
                  : hold.reason === "guest"
                    ? "Log in as a resident to keep chatting"
                    : "Type your question…"
              }
              label={mode === "live" ? "Message the Clerk" : "Type your question"}
              /* The box closes only when nothing typed could go anywhere.
                 During a cooldown it stays open, so the next question can be
                 written while the wait runs out. */
              disabled={(mode === "live" && liveStatus === "Closed") || (mode === "bot" && hold.reason === "guest")}
              sendDisabled={mode === "bot" ? botHeld : false}
            />
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
        /* Under the panel wherever the panel covers it — a phone's whole
           screen, or the bigger panel — so it is not drawn over the box. */
        className={`fixed bottom-5 right-4 z-50 h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/40 transition-all duration-300 hover:scale-110 hover:bg-primary-dark sm:right-6 ${
          open ? (expanded ? "hidden" : "hidden sm:flex") : "flex"
        }`}
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

