import { useEffect, useRef, useState } from "react";
import { FiCamera, FiRefreshCw, FiX, FiAlertTriangle, FiSmartphone } from "react-icons/fi";

interface IdCameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

type CameraState = "starting" | "live" | "denied" | "unsupported" | "error";

export default function IdCameraModal({ open, onClose, onCapture }: IdCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<CameraState>("starting");
  const [errorMessage, setErrorMessage] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [capturing, setCapturing] = useState(false);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (facing: "environment" | "user") => {
    stopStream();
    setState("starting");
    setErrorMessage("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setState("live");
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error.name === "NotAllowedError" || error.name === "SecurityError") {
        setState("denied");
      } else {
        // Try fallback to any available video device
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          streamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
          }
          setState("live");
        } catch {
          setState("error");
          setErrorMessage(error.message || "Could not start camera on this device.");
        }
      }
    }
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      return;
    }

    startCamera(facingMode);

    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facingMode]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || capturing) return;

    setCapturing(true);

    try {
      const canvas = document.createElement("canvas");
      // Use crisp resolution so QR code is easily readable by jsQR
      const width = video.videoWidth;
      const height = video.videoHeight;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setCapturing(false);
        return;
      }

      ctx.drawImage(video, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          setCapturing(false);
          if (!blob) return;

          const file = new File([blob], `resident-id-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });

          stopStream();
          onCapture(file);
          onClose();
        },
        "image/jpeg",
        0.95
      );
    } catch {
      setCapturing(false);
    }
  };

  const handleNativeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      stopStream();
      onCapture(file);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Capture Resident ID with Camera"
    >
      {/* Hidden native camera capture input for instant fallback */}
      <input
        ref={nativeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleNativeFileChange}
      />

      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-dark text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <FiCamera className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-white sm:text-lg">Take Photo of Resident ID</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            aria-label="Close camera"
            className="rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Video Viewfinder Area */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-black sm:aspect-[16/10]">
          {state === "live" && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />

              {/* Resident ID Card Alignment Overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                <div className="relative aspect-[1.586/1] w-full max-w-[340px] rounded-xl border-2 border-dashed border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                  {/* Glowing Corner Accents */}
                  <div className="absolute -top-1 -left-1 h-5 w-5 rounded-tl-lg border-t-4 border-l-4 border-primary" />
                  <div className="absolute -top-1 -right-1 h-5 w-5 rounded-tr-lg border-t-4 border-r-4 border-primary" />
                  <div className="absolute -bottom-1 -left-1 h-5 w-5 rounded-bl-lg border-b-4 border-l-4 border-primary" />
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-br-lg border-b-4 border-r-4 border-primary" />

                  <div className="absolute inset-x-0 bottom-2 text-center">
                    <span className="rounded-full bg-black/75 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-xs">
                      I-align ang ID at QR code dito
                    </span>
                  </div>
                </div>
              </div>

              {/* Flip camera switch button */}
              <button
                type="button"
                onClick={toggleFacingMode}
                className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md transition hover:bg-black/80"
                title="Switch Camera (Front / Back)"
              >
                <FiRefreshCw className="h-3.5 w-3.5" />
                <span>Flip</span>
              </button>
            </>
          )}

          {state === "starting" && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-gray-300">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm font-medium">Binubuksan ang camera...</p>
            </div>
          )}

          {(state === "denied" || state === "unsupported" || state === "error") && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
              <FiAlertTriangle className="h-10 w-10 text-amber-400" />
              <div>
                <p className="font-semibold text-white">
                  {state === "denied"
                    ? "Camera Access Denied"
                    : state === "unsupported"
                    ? "Browser Does Not Support Live Camera"
                    : "Hindi Mabuksan ang Camera"}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {state === "denied"
                    ? "Pahintulutan ang camera sa browser settings, o gamitin ang native phone camera sa ibaba."
                    : errorMessage || "Maaari mong gamitin ang camera app ng iyong cellphone direkta."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => nativeInputRef.current?.click()}
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white transition hover:bg-primary-dark"
              >
                <FiSmartphone className="h-4 w-4" />
                Buksan ang Device Camera App
              </button>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => nativeInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 transition hover:text-white"
            >
              <FiSmartphone className="h-3.5 w-3.5" />
              <span>Gamitin ang Phone Camera App</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopStream();
                onClose();
              }}
              className="text-xs text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          {state === "live" && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={capturing}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-dark active:scale-95 disabled:opacity-50"
              >
                <FiCamera className="h-5 w-5" />
                <span>{capturing ? "Kinukunan..." : "Kunan ng Litrato (Capture)"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

