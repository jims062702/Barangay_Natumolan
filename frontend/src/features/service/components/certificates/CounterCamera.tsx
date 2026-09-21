import { useEffect, useRef, useState } from "react";
import { FiCamera } from "react-icons/fi";

/**
 * The counter photograph, taken here and now.
 *
 * NOT AN UPLOAD, and that is the whole point. A clearance with a picture is
 * proof that the person on the paper stood at this counter — a file picker
 * accepts a photograph from any year, of anybody, and the clearance then
 * proves nothing. The resident is in front of the clerk when this is issued,
 * so the camera is what takes it.
 *
 * NO FALLBACK TO UPLOAD when there is no camera. Offering one would put the
 * gap straight back: a machine with no webcam cannot issue this clearance,
 * and saying so is the honest answer. The message says what to do about it.
 *
 * The frame is captured to a JPEG File and handed to the same code an upload
 * used, so everything downstream — the offline queue, the print, the server
 * — is unchanged.
 */

/* Matches imageToDataUrl: far more than the ~3cm box prints, and small
   enough to sit in the offline queue without bloating it. */
const MAX_SIDE = 600;
const QUALITY = 0.82;

type State = "starting" | "live" | "denied" | "none" | "unsupported";

export function CounterCamera({
  onCapture,
  busy,
}: {
  /** The frame, as a JPEG File — the same shape an upload produced. */
  onCapture: (photo: File) => void;
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>("starting");
  const [problem, setProblem] = useState("");

  useEffect(() => {
    let alive = true;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unsupported");

        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          /* Portrait-ish and modest: this prints in a small box, and asking
             for 4K makes a slow laptop take a second to show anything. */
          video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
          audio: false,
        });

        if (!alive) {
          stream.getTracks().forEach((track) => track.stop());

          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setState("live");
      } catch (error) {
        if (!alive) return;

        const name = (error as { name?: string })?.name ?? "";

        /* Told apart, because they need different things from the clerk:
           one is a permission to grant, the other is a camera to attach. */
        if (name === "NotAllowedError" || name === "SecurityError") {
          setState("denied");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setState("none");
        } else {
          setState("none");
          setProblem((error as Error)?.message ?? "");
        }
      }
    };

    void start();

    /* The light on the camera goes out when the modal closes. A stream left
       running is a camera the office believes is off. */
    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const take = () => {
    const video = videoRef.current;

    if (!video || video.videoWidth === 0) {
      return;
    }

    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        onCapture(
          new File([blob], `counter-photo-${Date.now()}.jpg`, { type: "image/jpeg" }),
        );
      },
      "image/jpeg",
      QUALITY,
    );
  };

  if (state === "denied" || state === "none" || state === "unsupported") {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/5 px-3.5 py-3">
        <p className="text-sm font-semibold text-dark">
          {state === "denied"
            ? "The camera is blocked"
            : state === "unsupported"
              ? "This browser cannot use the camera"
              : "No camera found"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600">
          {state === "denied"
            ? "Allow the camera for this site in the browser's address bar, then reopen this "
              + "certificate."
            : state === "unsupported"
              ? "Open the system in Chrome or Edge on this computer to take the photograph."
              : "This clearance prints the resident's photograph and it is taken at the counter, "
                + "not uploaded — so a computer with a camera is needed to issue it."}
        </p>
        {problem && <p className="mt-1 text-[11px] text-gray-400">{problem}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="relative w-full max-w-[280px] overflow-hidden rounded-xl border border-gray bg-dark/5">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="block h-auto w-full"
        />
        {state === "starting" && (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
            Starting the camera…
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={take}
        disabled={state !== "live" || busy}
        className="mt-2.5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FiCamera className="h-4 w-4" aria-hidden="true" />
        {busy ? "Saving…" : "Take photo"}
      </button>
    </div>
  );
}
