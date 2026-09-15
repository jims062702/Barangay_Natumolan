import { useEffect, useState } from "react";
import { FiClock, FiAlertTriangle, FiRefreshCw, FiX, FiChevronUp } from "react-icons/fi";
import {
  allJobs,
  discard,
  flush,
  retry,
  watchQueue,
  type QueuedJob,
} from "../../lib/writeQueue";
import { useIsOffline } from "../../hooks/useConnectivity";
import { confirmAction } from "../../lib/confirm";
import { toast } from "../../lib/toast";

/**
 * What the office has done that the server does not have yet.
 *
 * Without this the queue is invisible, and invisible is the one thing it
 * must not be. A clerk who files a certificate offline is told it was
 * recorded; if they cannot then SEE it waiting, they have been asked to
 * take that on faith — and the first time something fails to send they
 * would have no way of knowing, which is how work quietly disappears.
 *
 * Two states, and they read differently on purpose:
 *
 *   WAITING — normal, expected, nothing to do. Quiet.
 *   REFUSED — the server said no. A person has to look at this, and it
 *             says so in a colour that does not blend in.
 */
export default function QueuePanel() {
  const [jobs, setJobs] = useState<QueuedJob[]>([]);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const offline = useIsOffline();

  useEffect(() => {
    void allJobs().then(setJobs);

    return watchQueue(setJobs);
  }, []);

  const failed = jobs.filter((j) => j.status === "failed");
  const waiting = jobs.filter((j) => j.status !== "failed");

  /* Nothing pending and nothing refused: no badge, no bar, nothing. */
  if (jobs.length === 0) {
    return null;
  }

  const sendNow = async () => {
    setSending(true);

    try {
      const result = await flush();

      if (result.sent > 0) {
        toast(`${result.sent} sent.`, "success");
      }

      if (result.failed > 0) {
        toast(`${result.failed} refused by the server — needs attention.`, "warning");
      }

      if (result.sent === 0 && result.failed === 0) {
        toast(
          offline ? "Still no connection." : "Nothing was sent.",
          "info",
        );
      }
    } finally {
      setSending(false);
    }
  };

  const throwAway = async (job: QueuedJob) => {
    const ok = await confirmAction({
      title: "Discard this entry?",
      text: `“${job.label}” will not be sent and will be lost for good. `
        + "It will have to be entered again by hand if it is still needed.",
      confirmText: "Yes, discard",
      cancelText: "Keep it",
      danger: true,
    });

    if (!ok) return;

    await discard(job.id);
    toast("Discarded.", "info");
  };

  return (
    <div className="fixed bottom-5 left-4 z-40 w-[min(26rem,calc(100vw-2rem))] sm:left-6">
      {open && (
        <div className="mb-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-gray bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray px-4 py-3">
            <span className="text-sm font-semibold text-dark">Pending sync</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="cursor-pointer rounded-full p-1 text-gray-400 hover:bg-secondary hover:text-dark"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>

          <ul className="divide-y divide-gray/60">
            {jobs.map((job) => (
              <li key={job.id} className="px-4 py-3">
                <div className="flex items-start gap-2">
                  {job.status === "failed" ? (
                    <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                  ) : (
                    <FiClock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-dark">{job.label}</p>
                    {/*
                      The time the CLERK did it, not the time it syncs. A row
                      that says "just now" hours after the fact would make a
                      day's work look like one minute's.
                    */}
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {new Date(job.createdAt).toLocaleString("en-PH")}
                      {job.attempts > 0 && ` · ${job.attempts} ${job.attempts === 1 ? "attempt" : "attempts"}`}
                    </p>
                    {job.problem && (
                      <p className="mt-1 rounded-lg bg-danger/5 px-2 py-1 text-[11px] text-danger">
                        {job.problem}
                      </p>
                    )}
                  </div>
                </div>

                {job.status === "failed" && (
                  <div className="mt-2 flex gap-2 pl-6">
                    <button
                      type="button"
                      onClick={() => void retry(job.id)}
                      className="cursor-pointer rounded-full border border-gray px-3 py-1 text-[11px] font-semibold text-primary hover:border-primary"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => void throwAway(job)}
                      className="cursor-pointer rounded-full border border-gray px-3 py-1 text-[11px] font-semibold text-gray-500 hover:border-danger hover:text-danger"
                    >
                      Discard
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-full px-4 py-2.5 text-sm font-semibold shadow-xl transition-colors ${
          failed.length > 0
            ? "bg-danger text-white hover:bg-danger/90"
            : "bg-dark text-white hover:bg-dark/90"
        }`}
      >
        <span className="flex items-center gap-2">
          {failed.length > 0 ? (
            <FiAlertTriangle className="h-4 w-4" aria-hidden="true" />
          ) : (
            <FiClock className="h-4 w-4" aria-hidden="true" />
          )}
          {failed.length > 0
            ? `${failed.length} ${failed.length === 1 ? "needs" : "need"} attention`
            : `${waiting.length} waiting to sync`}
        </span>

        <span className="flex items-center gap-2">
          {/*
            Only offered when there is a line. Offering "send now" with the
            network down invites a press that cannot do anything, and an
            office that presses it and sees nothing happen learns to
            distrust the panel.
          */}
          {!offline && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                void sendNow();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  void sendNow();
                }
              }}
              className="rounded-full bg-white/15 px-2 py-1 text-[11px] hover:bg-white/25"
            >
              <FiRefreshCw
                className={`inline h-3 w-3 ${sending ? "animate-spin" : ""}`}
                aria-hidden="true"
              />{" "}
              {sending ? "Sending…" : "Send now"}
            </span>
          )}
          <FiChevronUp
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </span>
      </button>
    </div>
  );
}
