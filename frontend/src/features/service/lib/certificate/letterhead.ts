/**
 * The top of the page, and the council down its side.
 */

import { escapeHtml } from "./format";
import seal from "../../../../assets/logo/barangay-seal.jpg";
import type { CouncilMember } from "./types";

/*
 * The seal's URL, escaped.
 *
 * Unescaped it was fine while the bundler emitted a tidy path and broke the
 * moment it emitted a data: URL instead — the quote inside ended the src
 * attribute early and spilled the rest of the image into the page as text,
 * above the letterhead. Caught by rendering it; no assertion about the
 * markup would have noticed.
 */
export function sealUrl(): string {
  return escapeHtml(new URL(seal, window.location.origin).href);
}

/**
 * The four heading lines, centred on the page.
 *
 * `withSeal` is false on the Barangay Clearance, and that is not a tidying
 * choice: on the barangay's own form the seal sits at the top of the purple
 * council box down the left, and the heading beside it carries none. Drawing
 * one in both places put two seals on a page that has one.
 *
 * When the seal IS here it is taken out of the flow and laid over the left
 * margin, because the heading on their paper is centred on the SHEET. Laid
 * out beside the seal instead, the whole block sat visibly right of centre —
 * which is what "hindi naka align" was pointing at.
 */
export function letterhead(office: string, withSeal: boolean): string {
  return `
    <div class="head">
      ${withSeal ? `<img class="seal" src="${sealUrl()}" alt="" />` : ""}
      <div class="headtext">
        <p>Republic of the Philippines</p>
        <p><b>PROVINCE OF MISAMIS ORIENTAL</b></p>
        <p>Municipality of <b>TAGOLOAN</b></p>
        <p>Barangay <b>NATUMOLAN</b></p>
        <p>-o0o-</p>
        <p class="office"><b>OFFICE OF THE ${office.toUpperCase()}</b></p>
      </div>
    </div>`;
}

/** The council down the left margin — only the Barangay Clearance has it. */
export function sidebar(council: CouncilMember[]): string {
  const of = (position: string) =>
    council.filter((member) => member.position === position);

  const line = (member: CouncilMember, role: string) =>
    `<div class="member">
       <b>${escapeHtml(member.name)}</b>
       <span class="role">${role}</span>
       ${
         member.committees
           ? `<span class="cttee">${escapeHtml(member.committees)}</span>`
           : ""
       }
     </div>`;

  return `
    <aside class="council">
      ${/* At the top of the box, which is where their clearance has it. */ ""}
      <img class="council-seal" src="${sealUrl()}" alt="" />
      <h4>NATUMOLAN<br/>BRGY. COUNCIL</h4>
      ${of("Punong Barangay").map((m) => line(m, "Punong Barangay<br/>Over All Chairman")).join("")}
      <h5>BARANGAY KAGAWADS:</h5>
      ${of("Barangay Kagawad").map((m) => line(m, "Barangay Kagawad")).join("")}
      ${of("SK Chairperson").map((m) => line(m, "Barangay SK Chairperson")).join("")}
      ${of("Barangay Secretary").map((m) => line(m, "Barangay Secretary")).join("")}
      ${of("Barangay Treasurer").map((m) => line(m, "Barangay Treasurer")).join("")}
    </aside>`;
}
