import { escapeHtml, filled } from "./certificate/format";
import { certificateBody } from "./certificate/bodies";
import { letterhead, sidebar } from "./certificate/letterhead";
import { PAPER, STYLE } from "./certificate/paper";
import type { CouncilMember, PrintableCertificate } from "./certificate/types";

export { PAPER } from "./certificate/paper";
export type { CouncilMember, PrintableCertificate } from "./certificate/types";

/**
 * The barangay's own certificate forms, as the system prints them.
 *
 * These are transcribed from the twelve Word templates the office actually
 * uses, and they replace a single generic paragraph that printed the same
 * sentence under every heading — and signed it with a name from the
 * demonstration data, "HON. RICARDO M. BALAGTAS", who does not exist.
 *
 * Where the paper template was broken, this says so at the point of the fix
 * rather than reproducing the break:
 *
 *   - the residency forms read "resides at the said place for how many
 *     years", because the blank was never cut into the sentence;
 *   - the death certification hardcoded "her son", which printed those two
 *     words for a father whose daughter came to the counter;
 *   - the marriage certification was one widow's document with her
 *     particulars typed in, down to the barangay in Bohol that issued her
 *     husband's death certificate;
 *   - the year 2026 was typed into all twelve.
 *
 * What is NOT changed is the barangay's wording. "he/she" stays "he/she"
 * even where the register knows perfectly well which — an official document
 * is not the place to improve somebody else's sentences.
 *
 * THE SEAL is the barangay's own, lifted out of word/media in their
 * CERTIFICATE OF RESIDENCY.docx. It is kept separate from the logo the navbar
 * uses, so the paper and the website can differ without either surprising the
 * other.
 */

/*
 * The two Barangay Population Volunteers who check and verify a clearance.
 *
 * Named on the paper template and nowhere else — they are volunteers, not
 * officials, so the Officials roster has no room for them. Left here as one
 * line to edit rather than scattered through the markup, and worth turning
 * into data the day the barangay changes volunteers.
 */
const VERIFIERS = "JESSAH VETH V. CASTILLON/ABBESS KRISTEL P. PACALDO";

/**
 * The whole printable document, ready for a new window.
 *
 * `council` comes from the Officials roster, which is why the Punong
 * Barangay's name is no longer typed into the code — when the barangay
 * changes, they edit the roster once instead of every template.
 */
export function buildCertificateHtml(
  certificate: PrintableCertificate,
  council: CouncilMember[],
  options: { letterhead: string; office: string },
): string {
  const on = new Date();
  const { title, html, titleStyle } = certificateBody(certificate, on);
  const punongBarangay =
    council.find((m) => m.position === "Punong Barangay")?.name ?? "";

  const signature = `
    <div class="sign">
      <div class="who">
        <b>${escapeHtml(punongBarangay.replace(/^HON\.\s*/i, ""))}</b>
        ${escapeHtml(options.office)}
      </div>
    </div>`;

  /*
   * Only the clearance carries the officer of the day and the volunteers'
   * check — the other eleven forms are signed by the Punong Barangay alone,
   * and adding lines nobody signs would invite somebody to sign them.
   */
  const isClearance = options.letterhead === "council";

  const clearanceFooter = isClearance
    ? `
      <div class="officer">
        ${/*
          The kagawad's name, on the line.

          The form asked for it and the clerk typed it, but the line was
          printed empty every time: the field was collected and never read
          back, so the paper came out asking somebody to write in a name the
          system already had. Blank still, when nobody was entered — the
          line is then where it gets signed by hand.
        */ ""}
        <div class="line">${escapeHtml(certificate.template_fields?.officer_of_the_day ?? "")}</div>
        <b>Barangay Kagawad-Officer of the day</b>
      </div>
      <div class="verify">
        <p><b>Checked and Verified by:</b></p>
        <p class="names">${VERIFIERS}</p>
        <p><b>Barangay Population Volunteer&rsquo;s (BPV&rsquo;s)</b></p>
        <p style="margin-top:10px"><b>OR # :</b> ${filled(
          certificate.template_fields?.or_number,
          "150px",
        )}</p>
      </div>`
    : "";

  const reference = `
    <p class="ref">Certificate No. ${escapeHtml(certificate.certificate_number)}
    &middot; Verification Ref. ${escapeHtml(certificate.reference_number)}
    &middot; Verify at the barangay website &rarr; Certificate Verification.</p>`;

  const document = `
    ${/* The clearance's seal is in the council box, so the heading has none. */ ""}
    ${letterhead(options.office, !isClearance)}
    <h1${titleStyle ? ` class="${titleStyle}"` : ""}>${title}</h1>
    ${/*
      Every form but the clearance opens with it.
      
      Their Barangay Clearance goes straight from the title into "This is to
      certify that" — no salutation. It was put on all sixteen out of habit,
      which added a line to the one form that does not have one.
    */ ""}
    ${isClearance ? "" : '<p class="concern">TO WHOM IT MAY CONCERN:</p>'}
    <div class="${isClearance ? "body clearance-body" : "body"}">${html}</div>
    ${signature}
    ${clearanceFooter}
    ${reference}`;

  /*
   * The half-sheet prints twice with a cut line between, exactly as the
   * office's own Certificate of Appearance does — two to a page, snipped
   * apart. Printing one and wasting the other half was never the intent.
   */
  const isHalf = options.letterhead === "half";
  const main = isHalf
    ? `<div class="slip">${document}</div><hr class="cut"/><div class="slip">${document}</div>`
    : document;

  const paper = PAPER[options.letterhead] ?? PAPER.plain;
  const [top, right, bottom, left] = paper.margin;

  /*
   * Half a millimetre short of the paper. A sheet exactly as tall as the page
   * rounds, now and then, to a hair over it — and a hair over is a blank
   * second page coming out of the printer.
   */
  const pageCss = `
    @page { size: ${paper.size}; margin: 0; }
    .page { width: ${paper.width}mm; height: ${paper.height - 0.5}mm;
            padding: ${top}mm ${right}mm ${bottom}mm ${left}mm; }`;

  return `<!doctype html><html><head><meta charset="utf-8"/>
    <title>${escapeHtml(certificate.certificate_number)} — ${escapeHtml(
      certificate.certificate_type,
    )}</title><style>${STYLE}${pageCss}</style></head><body>
    <div class="page">
      <div class="sheet${isClearance ? " clearance" : ""}">
        ${isClearance ? sidebar(council) : ""}
        <div class="main${isHalf ? " slips" : ""}">${main}</div>
      </div>
    </div>
    <script>
      /*
       * Fits the certificate to its own sheet: full size when it fits, and
       * otherwise shrunk evenly — never cut off, never onto a second page.
       *
       * The largest scale that fits is searched for rather than worked out in
       * one division, because a narrower column wraps to more lines: shrinking
       * the text also widens the column it is set in, so the first guess is
       * always smaller than it needs to be.
       *
       * The sheet is then stretched back to the full box, so the council panel
       * still runs the height of the page and the two appearance slips still
       * split it at the cut line. Run on load, once the seal and the photograph
       * are in — their height is part of what is measured.
       */
      function fitToOnePage() {
        var page = document.querySelector(".page");
        var sheet = document.querySelector(".sheet");
        if (!page || !sheet) return 1;
        var cs = getComputedStyle(page);
        var boxW = page.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        var boxH = page.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        function heightAt(scale) {
          sheet.style.zoom = "";
          sheet.style.height = "";
          sheet.style.width = (boxW / scale) + "px";
          return sheet.scrollHeight * scale;
        }
        var lo = 1;
        if (heightAt(1) > boxH) {
          var hi = 1;
          lo = 0.3;
          for (var i = 0; i < 14; i++) {
            var mid = (lo + hi) / 2;
            if (heightAt(mid) <= boxH) lo = mid; else hi = mid;
          }
        }
        var scale = Math.floor(lo * 1000) / 1000;
        sheet.style.width = (boxW / scale) + "px";
        sheet.style.height = (boxH / scale) + "px";
        sheet.style.zoom = scale === 1 ? "" : String(scale);
        document.documentElement.setAttribute("data-fit-scale", String(scale));
        return scale;
      }
      window.onload = function () { fitToOnePage(); window.print(); };
    </script>
    </body></html>`;
}
