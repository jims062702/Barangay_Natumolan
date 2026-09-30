import { useEffect, useMemo, useState } from "react";
import { FiDownload } from "react-icons/fi";
import FormPreview from "../print/FormPreview";
import { formDocument } from "../print/formKit";
import { cardSheet, drawResidentCard, type ResidentCardData } from "./drawCard";
import { cardFileName, saveBlob } from "./downloadCard";

/**
 * A Barangay Resident ID on screen — both sides — with Download and Print.
 *
 * What is shown IS the file: the same drawing is saved as the PNG, and the
 * same two images go to the printer — large by default, or at the card's
 * real size for a standard ID holder.
 */

/*
 * THE PRINT SIZE (2026-09-30). At the card's own 85.6 × 54 mm the print was
 * small on an A4 sheet and hard to read, so it prints half as big again by
 * default: both sides still fit one A4 page, one under the other. The real
 * card size stays one choice away, for a sleeve made for a CR80 card. The
 * drawing is 2568 pixels across, so even the large print is sharp.
 */
const PRINT_SIZES = {
  large: { width: 128.4, height: 81, label: "Large — 128 × 81 mm" },
  card: { width: 85.6, height: 54, label: "ID card size — 85.6 × 54 mm" },
} as const;

type PrintSize = keyof typeof PRINT_SIZES;
export function ResidentCardView({ card, note }: { card: ResidentCardData; note?: string }) {
  const [sides, setSides] = useState<{ front: string; back: string; frontCanvas: HTMLCanvasElement; backCanvas: HTMLCanvasElement } | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [size, setSize] = useState<PrintSize>("large");

  useEffect(() => {
    let current = true;
    setSides(null);
    setFailed(false);
    drawResidentCard(card)
      .then(({ front, back }) => {
        if (current) setSides({ front: front.toDataURL("image/png"), back: back.toDataURL("image/png"), frontCanvas: front, backCanvas: back });
      })
      .catch(() => current && setFailed(true));

    return () => { current = false; };
  }, [card]);

  const download = async () => {
    if (!sides) return;
    setSaving(true);
    try {
      saveBlob(await cardSheet(sides.frontCanvas, sides.backCanvas), cardFileName(card));
    } finally {
      setSaving(false);
    }
  };

  /* Both sides at the chosen size, with a cut line round each. */
  const { width, height } = PRINT_SIZES[size];
  const printHtml = useMemo(() => (sides ? formDocument({
    title: `Barangay Resident ID — ${card.resident_number}`,
    page: "A4",
    margin: "15mm",
    css: `
      .cards { display: flex; flex-direction: column; align-items: center; gap: 10mm; padding-top: 5mm; }
      .cards figure { margin: 0; text-align: center; }
      .cards img { display: block; width: ${width}mm; height: ${height}mm; outline: 0.2mm dashed #9a9a9a; outline-offset: 1.5mm; }
      .cards figcaption { margin-top: 3mm; font-size: 8pt; color: #666; }
    `,
    body: `
      <div class="cards">
        <figure><img src="${sides.front}" alt="Front" /><figcaption>Front</figcaption></figure>
        <figure><img src="${sides.back}" alt="Back" /><figcaption>Back — cut along the dashed lines</figcaption></figure>
      </div>`,
  }) : ""), [sides, card.resident_number, width, height]);

  return (
    <div>
      {failed ? (
        <p className="rounded-xl bg-danger/5 px-4 py-6 text-center text-sm text-danger">The card could not be drawn. Please reload the page.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2" data-testid="resident-card-sides">
          {(["front", "back"] as const).map((side) => (
            <figure key={side} className="m-0">
              {sides ? (
                <img
                  src={sides[side]}
                  alt={side === "front" ? "Barangay Resident ID, front" : "Barangay Resident ID, back"}
                  className="block w-full rounded-[4%] shadow-[0_1px_2px_rgba(40,20,80,.1),0_14px_30px_-16px_rgba(40,20,80,.45)]"
                />
              ) : (
                <div className="aspect-[856/540] w-full animate-pulse rounded-[4%] bg-secondary" />
              )}
              <figcaption className="mt-1.5 text-center text-xs font-medium text-gray-500">{side === "front" ? "Front" : "Back"}</figcaption>
            </figure>
          ))}
        </div>
      )}

      {note && <p className="mt-4 text-xs leading-relaxed text-gray-500">{note}</p>}

      <div className="mt-4">
        <FormPreview
          html={printHtml}
          title="Barangay Resident ID"
          printLabel="Print"
          preview={false}
          disabled={!sides}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={download}
                disabled={!sides || saving}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-primary px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiDownload className="h-4 w-4" aria-hidden="true" /> {saving ? "Saving…" : "Download ID (PNG)"}
              </button>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as PrintSize)}
                aria-label="Print size"
                className="cursor-pointer rounded-full border border-gray bg-white px-4 py-2.5 text-sm text-dark focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              >
                {(Object.keys(PRINT_SIZES) as PrintSize[]).map((key) => (
                  <option key={key} value={key}>{PRINT_SIZES[key].label}</option>
                ))}
              </select>
            </div>
          }
        />
      </div>
    </div>
  );
}
