import { useEffect, useState } from "react";
import { FiEye, FiEyeOff, FiAlertCircle } from "react-icons/fi";
import { api } from "../../../../shared/lib/api";

/**
 * The photograph of somebody's identity card, shown to one officer.
 *
 * FETCHED, NOT LINKED. The endpoint streams from the private disk behind the
 * session, and an <img src> carries no bearer token — it would show a broken
 * image where an ID should be. So it comes through the API client as a blob.
 *
 * SHOWN, NOT DOWNLOADED. The office computer is shared, and a photograph of a
 * resident's licence sitting in its Downloads folder is a disclosure nobody
 * decided to make. The blob URL is revoked when the viewer closes, so what
 * the officer saw does not outlive the reason they had for seeing it.
 *
 * CLOSED BY DEFAULT, for the same reason: this sits on a screen in a public
 * office, and an ID card should be on it while an officer is comparing it to
 * a face — not while the next person in the queue is leaning over the desk.
 */
export function ValidIdViewer({
  complaintId,
  idType,
  idNumber,
  path,
}: {
  complaintId: number;
  idType: string;
  idNumber?: string | null;
  /** Where the picture is streamed from, when it is not a Lupon complaint's (the VAW Desk's reports). */
  path?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [pdf, setPdf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState("");

  /* Revoked on close and on unmount — see the note above. */
  useEffect(() => {
    if (open) return;
    setUrl((current) => {
      if (current) URL.revokeObjectURL(current);

      return null;
    });
  }, [open]);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  const show = async () => {
    setOpen(true);
    if (url) return;

    setLoading(true);
    setFailed("");
    try {
      const response = await api.get(path ?? `/lupon/online-complaints/${complaintId}/valid-id`, {
        responseType: "blob",
      });
      const blob = response.data as Blob;
      setPdf(blob.type === "application/pdf");
      setUrl(URL.createObjectURL(blob));
    } catch {
      setFailed("The uploaded ID could not be opened. It may no longer be on file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray bg-secondary/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Identification
          </p>
          <p className="mt-0.5 text-sm font-semibold text-dark">{idType}</p>
          {idNumber && <p className="text-xs text-gray-500">No. {idNumber}</p>}
        </div>

        <button
          type="button"
          onClick={() => (open ? setOpen(false) : show())}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-primary/40 px-4 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
        >
          {open ? (
            <>
              <FiEyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Hide the ID
            </>
          ) : (
            <>
              <FiEye className="h-3.5 w-3.5" aria-hidden="true" /> Show the ID
            </>
          )}
        </button>
      </div>

      {open && (
        <div className="mt-3">
          {loading && <p className="text-xs text-gray-500">Opening…</p>}

          {failed && (
            <p className="flex items-center gap-2 text-xs font-medium text-danger">
              <FiAlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> {failed}
            </p>
          )}

          {url && !pdf && (
            <img
              src={url}
              alt="The identity document the complainant uploaded"
              className="max-h-96 w-full rounded-xl border border-gray bg-white object-contain"
            />
          )}

          {url && pdf && (
            <object
              data={url}
              type="application/pdf"
              className="h-96 w-full rounded-xl border border-gray bg-white"
              aria-label="The identity document the complainant uploaded"
            >
              <p className="p-4 text-xs text-gray-500">
                This browser cannot display the PDF inline.
              </p>
            </object>
          )}

          {url && (
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              Hold this beside the person in front of you. The photograph is not
              identification on its own — the card is.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
