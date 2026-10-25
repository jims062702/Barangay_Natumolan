/**
 * The pieces every printed barangay report is made of.
 *
 * Each report is ONE HTML document: the preview on the page is that document
 * in a frame, and Print prints that same frame. There is no second layout
 * for the screen to drift away from the paper.
 */

import barangaySeal from "../../assets/logo/barangay-seal.jpg";
import tagoloanSeal from "../../assets/logo/tagoloan-seal.png";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Absolute, so the frame resolves them the same way the page does. */
export const seals = {
  barangay: () => escapeHtml(new URL(barangaySeal, window.location.origin).href),
  tagoloan: () => escapeHtml(new URL(tagoloanSeal, window.location.origin).href),
};

/** "HON. RAFAEL P. VIDAL" → "RAFAEL P. VIDAL" — some forms print the title, some do not. */
export const withoutHon = (name: string | null | undefined) =>
  String(name ?? "").replace(/^\s*hon\.?\s+/i, "").trim();

export const withHon = (name: string | null | undefined) => {
  const bare = withoutHon(name);
  return bare ? `HON. ${bare}` : "";
};

/** "2026-06-27" → "JUNE 27, 2026", the way the barangay dates a signature. */
export function upperDate(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";

  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase();
}

/** Today in Manila, "YYYY-MM-DD". */
export const manilaToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

/**
 * A whole printable document.
 *
 * `page` is the CSS @page size — "14in 8.5in" is Legal, landscape. On
 * screen the sheet is drawn at its real width and zoomed down to fit the
 * frame; the zoom comes off for printing, so the paper is exactly the sheet.
 */
export function formDocument({ title, page, margin = "0.4in", css, body }: {
  title: string;
  page: string;
  margin?: string;
  css: string;
  /* Several sheets print as one job, each on its own page — the notice of
     hearing and the summons together, say. */
  body: string | string[];
}): string {
  const sheets = Array.isArray(body) ? body : [body];

  /* The paper's width, for drawing the sheet at its real size on screen. */
  const w = page.startsWith("A4")
    ? (page.includes("landscape") ? "11.69in" : "8.27in")
    : page.split(" ")[0];

  return `<!doctype html><html><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: ${page}; margin: ${margin}; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  /* The forms' shaded headers and TOTAL rows print even with "background
     graphics" off in the print dialog. */
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Calibri, Carlito, Arial, Helvetica, sans-serif; font-size: 11pt; }
  @media screen {
    html { background: #e9e6ef; }
    body { padding: 12px; }
    .sheet { background: #fff; width: calc(${w} - 2 * ${margin}); margin: 0 auto; padding: ${margin};
             box-shadow: 0 1px 4px rgba(0,0,0,.18); box-sizing: content-box; }
  }
  @media print { .sheet { width: auto; } }
  .sheet.next { break-before: page; page-break-before: always; }
  @media screen { .sheet.next { margin-top: 16px; } }
  table { border-collapse: collapse; }
  .u { text-decoration: underline; }
  .b { font-weight: 700; }
  .c { text-align: center; }
  ${css}
</style></head>
<body>${sheets.map((one, i) => `<div class="sheet${i ? " next" : ""}">${one}</div>`).join("")}
<script>
  /* Fit the sheet to the frame on screen; print it at full size. */
  function fit() {
    var sheet = document.querySelector(".sheet");
    if (!sheet) return;
    document.body.style.zoom = "";
    var z = Math.min(1, (document.documentElement.clientWidth - 24) / sheet.getBoundingClientRect().width);
    document.body.style.zoom = String(z);
    /* The frame grows to the zoomed sheet, so the page scrolls, not the frame. */
    if (window.frameElement) window.frameElement.style.height = Math.ceil(document.body.getBoundingClientRect().bottom + 12) + "px";
  }
  window.addEventListener("load", fit);
  window.addEventListener("resize", fit);
  window.addEventListener("beforeprint", function () { document.body.style.zoom = ""; });
  window.addEventListener("afterprint", fit);
</script>
</body></html>`;
}

/** A cell's mark: the barangay's forms tick a box with "/". */
export const tick = (on: boolean) => (on ? "/" : "");

/**
 * Prints HTML directly via a temporary off-screen iframe without opening a new tab or page.
 */
export function printHtmlViaIframe(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute(
    "style",
    "position:fixed;top:-10000px;left:-10000px;width:0;height:0;border:0;visibility:hidden;",
  );
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow?.document;
  if (!frameDoc) {
    iframe.remove();
    return;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  let printed = false;
  const trigger = () => {
    if (printed) return;
    printed = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("Print error:", e);
    } finally {
      setTimeout(() => {
        iframe.remove();
      }, 1000);
    }
  };

  setTimeout(trigger, 300);
}
