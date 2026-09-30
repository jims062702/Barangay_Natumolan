/**
 * The Health Station's "BARANGAY MONTHLY REPORT" — the office's own one-page
 * form, as it looks on paper:
 *
 *   BARANGAY MONTHLY REPORT            (bold, underlined)
 *   MONTH OF ________ 2026
 *
 *   CONSULTATION: ____________________
 *   ___________________________________   (ruled lines to write on)
 *   PRENATAL: / IMMUNIZATION: / POSTPARTUM: / ANIMAL BITE:
 *
 *   SUBMITTED BY:
 *
 * The lines are ruled under the text rather than drawn one by one, so words
 * sit on them however the sentence wraps — and a section with nothing to
 * say still shows its empty lines, as the paper does.
 */
import { escapeHtml, formDocument } from "../../../shared/print/formKit";

export interface MonthlySections {
  consultation: string;
  prenatal: string;
  immunization: string;
  postpartum: string;
  animal_bite: string;
}

export interface MonthlyForm {
  monthName: string;
  year: number;
  sections: MonthlySections;
  submittedBy: string;
  position: string;
}

/* The five, in the paper's order, with its own labels. ANIMAL BITE sits on
   two lines on the form: ANIMAL above, BITE: on the first ruled line. */
const SECTIONS: { key: keyof MonthlySections; label: string; above?: string; lines: number }[] = [
  { key: "consultation", label: "CONSULTATION:", lines: 5 },
  { key: "prenatal", label: "PRENATAL:", lines: 5 },
  { key: "immunization", label: "IMMUNIZATION:", lines: 5 },
  { key: "postpartum", label: "POSTPARTUM:", lines: 5 },
  { key: "animal_bite", label: "BITE:", above: "ANIMAL", lines: 4 },
];

const LINE = 26; // px between ruled lines, on the sheet

const CSS = `
  body { font-family: Calibri, Carlito, Arial, Helvetica, sans-serif; }
  .title { margin: 48px 0 0 46px; font-size: 17pt; font-weight: 700; text-decoration: underline; letter-spacing: .01em; }
  .month { margin: 4px 0 30px 64px; font-size: 14pt; }
  .month .blank { display: inline-block; min-width: 118px; border-bottom: 1px solid #000; text-align: center;
                  font-weight: 700; padding: 0 6px; }
  /* As on the paper: the label starts the first ruled line and the words
     run on after it; every line below runs the full width. */
  .section { margin: 0 40px 22px 0; }
  .above { font-size: 9.5pt; font-weight: 700; text-decoration: underline; line-height: 16px; }
  .ruled { font-size: 11pt; line-height: ${LINE}px; white-space: pre-wrap; word-wrap: break-word;
           background-image: repeating-linear-gradient(to bottom, transparent 0, transparent ${LINE - 1}px,
             #000 ${LINE - 1}px, #000 ${LINE}px); }
  /* White behind the label, so the first line's rule begins after it. */
  .label { display: inline-block; height: ${LINE}px; padding-right: 6px; background: #fff; vertical-align: top;
           font-size: 9.5pt; font-weight: 700; text-decoration: underline; }
  .submitted { margin-top: 26px; }
  .submitted .by { font-size: 9.5pt; font-weight: 700; text-decoration: underline; }
  .signer { margin: 38px 0 0 118px; width: 260px; text-align: center; }
  .signer .name { border-bottom: 1px solid #000; font-weight: 700; text-transform: uppercase; min-height: 18px; }
  .signer .pos { font-size: 9.5pt; margin-top: 2px; }
`;

/** One section: its label, and its words on as many ruled lines as the paper has — or more. */
function section(label: string, text: string, lines: number, above?: string): string {
  return `
    <div class="section">
      ${above ? `<div class="above">${above}</div>` : ""}
      <div class="ruled" style="min-height:${lines * LINE}px"><span class="label">${label}</span>${escapeHtml(text.trim())}</div>
    </div>`;
}

export function monthlyReportHtml(form: MonthlyForm): string {
  const body = `
    <p class="title">BARANGAY MONTHLY REPORT</p>
    <p class="month">MONTH OF <span class="blank">${escapeHtml(form.monthName)}</span> ${escapeHtml(form.year)}</p>
    ${SECTIONS.map((s) => section(s.label, form.sections[s.key] ?? "", s.lines, s.above)).join("")}
    <div class="submitted">
      <span class="by">SUBMITTED BY:</span>
      <div class="signer">
        <div class="name">${escapeHtml(form.submittedBy)}</div>
        <div class="pos">${escapeHtml(form.position)}</div>
      </div>
    </div>`;

  return formDocument({
    title: `Barangay Monthly Report — ${form.monthName} ${form.year}`,
    page: "A4",
    margin: "0.5in",
    css: CSS,
    body,
  });
}
