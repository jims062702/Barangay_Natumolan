import { useState, useRef, useEffect } from "react";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { confirmAction } from "../../../shared/lib/confirm";
import type { Resident } from "../../../shared/types";
import { download } from "../components/transfer/download";
import { residentApi } from "../api";
import type { Preview } from "../components/transfer/types";

/**
 * The state and handlers of <TransferModal>, so its sections can share them.
 */
export function useRegisterTransfer({
  open,
  mode,
  onClose,
  onImported,
}: {
  open: boolean;
  /**
   * One job per opening.
   *
   * Taking data out and bringing data in are different errands, and the
   * second one writes. Putting both behind one button meant a clerk who
   * came to fetch a backup was one mis-click from a file upload — so they
   * are separate buttons, and each opens on the thing it says.
   */
  mode: "import" | "export";
  onClose: () => void;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState<"residents" | "non-residents" | "both">("residents");
  const [search, setSearch] = useState("");
  const [purok, setPurok] = useState("");
  const [sector, setSector] = useState("");
  const [matchCount, setMatchCount] = useState<number | null>(null);
  /*
   * The first few of them, by name.
   *
   * A count answers "how many" and not "which", and "which" is the question
   * somebody has when they typed a surname and eight people share it.
   */
  const [matches, setMatches] = useState<Resident[]>([]);
  const [counting, setCounting] = useState(false);
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  /*
   * The count comes from the residents list, not a second endpoint written
   * for it — one query, so the number on screen and the rows in the file
   * cannot drift apart.
   */
  useEffect(() => {
    if (!open || mode !== "export") return;

    setCounting(true);
    const timer = setTimeout(() => {
      residentApi.residents({ params: { ...exportParams(), per_page: 6 } })
        .then((r) => {
          setMatchCount(r.data.data.total ?? 0);
          setMatches(r.data.data.data ?? []);
        })
        .catch(() => {
          setMatchCount(null);
          setMatches([]);
        })
        .finally(() => setCounting(false));
    }, 250);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, who, search, purok, sector]);

  const reset = () => {
    setFile(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const close = () => { reset(); onClose(); };

  /** One place decides what "who + filters" means, so the count and the file agree. */
  const exportParams = () => ({
    record_type: who === "non-residents" ? "Non-resident" : undefined,
    include_non_residents: who === "both" ? 1 : undefined,
    search: search.trim() || undefined,
    zone_purok: purok || undefined,
    sector: sector || undefined,
  });

  const runExport = async () => {
    setBusy(true);
    try {
      const query = new URLSearchParams(
        Object.entries({ ...exportParams(), format })
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString();

      await download(`/residents-export?${query}`, `residents.${format}`);
      toast(`${matchCount} record(s) exported.`);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const runPreview = async (chosen: File) => {
    setBusy(true);
    setPreview(null);
    try {
      const body = new FormData();
      body.append("file", chosen);
      const response = await residentApi.previewImport(body);
      setPreview(response.data.data);
    } catch (err) {
      toast(errorMessage(err), "error");
      reset();
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!file || !preview) return;

    const { create, update, errors, new_households: households } = preview.summary;

    /* Both facts, in the order they matter. A household created by mistake
       is harder to notice afterwards than a resident, because nothing is
       obviously wrong about it. */
    const consequences = [
      households ? `${households} new household(s) will be created.` : "",
      errors ? `${errors} row(s) with problems will be skipped.` : "",
    ].filter(Boolean);

    if (
      !(await confirmAction({
        title: `Import ${create} new and ${update} updated record(s)?`,
        text: consequences.length
          ? consequences.join(" ")
          : "This writes to the resident registry.",
        confirmText: "Yes, import",
      }))
    )
      return;

    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      // Said explicitly, because the preview showed exactly what will be
      // skipped and the clerk has now seen it.
      if (errors) body.append("skip_bad_rows", "1");

      const response = await residentApi.importRegister(body);
      toast(response.data.message);
      reset();
      onImported();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return {
    busy, setBusy, who, setWho, search, setSearch, purok, setPurok, sector, setSector,
    matchCount, setMatchCount, matches, setMatches, counting, setCounting, format, setFormat,
    file, setFile, preview, setPreview, fileInput, reset, close, exportParams, runExport,
    runPreview, runImport,
  };
}

export type RegisterTransferState = ReturnType<typeof useRegisterTransfer>;
