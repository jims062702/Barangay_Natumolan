import { FiClock, FiVolumeX, FiVolume2, FiX } from "react-icons/fi";
import logo from "../../../../assets/logo/logo.svg";
import type { ChatWidgetState } from "../../hooks/useChatWidget";

/**
 * The widget's title bar: who is answering, and the controls.
 */
export function ChatHeader({ ctx }: { ctx: ChatWidgetState }) {
  const {
    mode, liveStatus, headerSubtitle, isResident, pastCount, setShowPast, showPast, setReading,
    loadPast, toggleMuted, muted, setOpen,
  } = ctx;

  return (
    <div className="flex items-center gap-3 bg-gradient-to-r from-primary-dark to-primary px-5 py-4">
      <img src={logo} alt="" aria-hidden="true" className="h-10 w-10 rounded-full bg-white/90 p-1" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">
          {mode === "bot" ? "Natumolan Assistant" : "Barangay Clerk"}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-white/80">
          <span
            aria-hidden="true"
            className={`inline-block h-2 w-2 rounded-full ${
              mode === "live" && liveStatus === "Waiting"
                ? "animate-pulse bg-warning"
                : mode === "live" && liveStatus === "Closed"
                  ? "bg-white/50"
                  : "bg-success"
            }`}
          />
          <span className="truncate">{headerSubtitle}</span>
        </p>
      </div>
      {/*
        Earlier conversations, reached from the header.

        This sat at the top of the message thread, where it did two
        wrong things at once: it pushed the conversation down, and it
        scrolled away the moment anybody said anything. The header is
        always there and costs no room in the thread.
      */}
      {isResident && pastCount > 0 && mode !== "live" && (
        <button
          type="button"
          onClick={() => {
            setShowPast(!showPast);
            setReading(null);
            if (!showPast) void loadPast();
          }}
          aria-label="Your earlier conversations"
          title="Your earlier conversations"
          className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-white/15 hover:text-white ${
            showPast ? "bg-white/20 text-white" : "text-white/80"
          }`}
        >
          <FiClock className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-primary">
            {pastCount}
          </span>
        </button>
      )}
      <button
        type="button"
        onClick={toggleMuted}
        aria-label={muted ? "Turn message sound on" : "Turn message sound off"}
        title={muted ? "Sound off — click to turn on" : "Sound on — click to mute"}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
      >
        {muted ? <FiVolumeX className="h-5 w-5" /> : <FiVolume2 className="h-5 w-5" />}
      </button>
      <button
        type="button"
        aria-label="Close chat"
        onClick={() => setOpen(false)}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
      >
        <FiX className="h-5 w-5" />
      </button>
    </div>
  );
}
