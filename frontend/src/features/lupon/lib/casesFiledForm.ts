/**
 * Consolidated Cases Filed — the barangay's own list, not the court's form.
 *
 * The Monthly Transmittal says what the court asks: a tick in a column. This
 * says what the office is asked when somebody walks in wanting to know what
 * the Lupon did last month — the title of each complaint, who it was between,
 * and where it ended up, in words. Legal paper, landscape.
 */

import { escapeHtml as e, formDocument, seals, upperDate, withoutHon } from "../../../shared/print/formKit";

export interface CasesFiledRow {
  case_number: string;
  title: string;
  classification: string;
  complainant: string;
  respondents: string;
  date_filed: string | null;
  status: string;
  date_resolved: string | null;
  remarks: string | null;
}

export interface CasesFiled {
  period: string;
  /* Set when the list was narrowed to one status, so the sheet can say so. */
  stage?: string | null;
  rows: CasesFiledRow[];
  totals: Record<string, number>;
  total: number;
}

export interface CasesFiledNames {
  secretary: string;
  punong_barangay: string;
}

/** The sheet has room for eight cases before it needs to grow. */
const MIN_ROWS = 8;

/** "2026-09-23" → "09/23/2026", as the register writes a date in a column. */
const asDate = (value: string | null) => {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${m}/${d}/${y}` : "";
};

export function casesFiledHtml(report: CasesFiled, names: CasesFiledNames): string {
  const row = (r: CasesFiledRow, index: number) => `
    <tr>
      <td>${index + 1}</td>
      <td class="l">${e(r.case_number)}</td>
      <td class="l">${e(r.title)}</td>
      <td class="l">${e(r.classification)}</td>
      <td class="l">${e(r.complainant)}</td>
      <td class="l">${e(r.respondents)}</td>
      <td>${asDate(r.date_filed)}</td>
      <td>${e(r.status)}</td>
      <td>${asDate(r.date_resolved)}</td>
      <td class="l">${e(r.remarks ?? "")}</td>
    </tr>`;

  const blanks = Math.max(0, MIN_ROWS - report.rows.length);
  const blank = `<tr>${"<td>&nbsp;</td>".repeat(10)}</tr>`;

  /*
   * EVERY STATUS, including the ones with none.
   *
   * A summary that simply leaves out "Withdrawn" reads as "not asked"; a
   * zero beside it reads as "asked, and there were none" — which is the
   * answer the office is actually giving.
   */
  const summary = Object.entries(report.totals)
    .map(([name, count]) => `<td><span class="b">${e(name)}</span><br/>${count}</td>`)
    .join("");

  const body = `
  <div class="box">
    <div class="head">
      <img class="seal" src="${seals.barangay()}" alt="" />
      <p>Republic of the Philippines</p>
      <p>Province of Misamis Oriental</p>
      <p>Municipality of Tagoloan</p>
      <p>Barangay <b>NATUMOLAN</b></p>
      <p class="office b">OFFICE OF THE LUPONG TAGAPAMAYAPA</p>
      <p class="title b">CONSOLIDATED CASES FILED</p>
      <p class="month">Reporting Month: <b>${e(report.period)}</b></p>
      ${report.stage ? `<p class="only">Cases with the status <b>${e(report.stage)}</b> only</p>` : ""}
    </div>

    <table class="grid">
      <colgroup>
        <col style="width:3%"/><col style="width:9%"/><col style="width:17%"/><col style="width:9%"/>
        <col style="width:12%"/><col style="width:12%"/><col style="width:7%"/>
        <col style="width:8%"/><col style="width:8%"/><col style="width:15%"/>
      </colgroup>
      <tr class="hd">
        <th>No.</th>
        <th>Case No.</th>
        <th>Title of the Case</th>
        <th>Nature</th>
        <th>Complainant</th>
        <th>Respondent</th>
        <th>Date Filed</th>
        <th>Status</th>
        <th>Date Resolved</th>
        <th>Remarks</th>
      </tr>
      ${report.rows.map(row).join("")}
      ${blank.repeat(blanks)}
      <tr class="tot">
        <td colspan="6" class="l b">TOTAL CASES FILED</td>
        <td colspan="4" class="b">${report.total}</td>
      </tr>
    </table>

    <table class="summary">
      <tr><th colspan="${Object.keys(report.totals).length}" class="band">WHERE THEY STAND</th></tr>
      <tr>${summary}</tr>
    </table>

    <table class="signs">
      <tr>
        <td class="w50">Prepared by :</td>
        <td class="w50">Attested by :</td>
      </tr>
      <tr>
        <td class="name"><span class="sig">${e(names.secretary)}</span><br/><span class="role">Barangay Secretary</span></td>
        <td class="name"><span class="sig">${e(withoutHon(names.punong_barangay))}</span><br/><span class="role">Punong Barangay</span></td>
      </tr>
    </table>

    <p class="issued">Issued this <b>${e(upperDate(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })))}</b> at Barangay Natumolan, Tagoloan, Misamis Oriental.</p>
  </div>`;

  return formDocument({
    title: `Consolidated Cases Filed — ${report.period}`,
    page: "14in 8.5in",
    margin: "0.35in",
    css: `
      body { font-size: 10pt; }
      .box { border: 2px solid #000; padding: 10px 12px 8px; }
      .head { position: relative; text-align: center; min-height: 118px; }
      .head p { margin: 0; line-height: 1.3; }
      .head .seal { position: absolute; left: 21%; top: 0; width: 100px; height: auto; }
      .head .office { margin-top: 10px; }
      .head .title { margin-top: 10px; font-size: 13pt; letter-spacing: .5px; }
      .head .month { margin-top: 4px; margin-bottom: 8px; }
      .head .only { margin-bottom: 8px; font-size: 9.5pt; }
      .grid { width: 100%; table-layout: fixed; }
      .grid th, .grid td { border: 1px solid #000; padding: 3px 4px; font-size: 9pt; text-align: center; vertical-align: top; word-wrap: break-word; }
      .grid td.l, .grid th.l { text-align: left; }
      .grid .hd th { background: #9999ff; font-weight: 700; vertical-align: middle; }
      .grid .tot td { background: #ff8080; }
      .summary { width: 100%; table-layout: fixed; margin-top: 8px; }
      .summary th, .summary td { border: 1px solid #000; padding: 3px 4px; font-size: 9pt; text-align: center; }
      .summary .band { background: #9999ff; }
      .signs { width: 100%; margin-top: 10px; }
      .signs td { padding: 2px 4px; vertical-align: top; }
      .w50 { width: 50%; }
      .name { padding-top: 14px !important; text-align: center; }
      .sig { font-family: "Times New Roman", Times, serif; font-weight: 700; text-decoration: underline; font-size: 11pt; }
      .role { font-size: 10pt; }
      .issued { margin: 10px 0 0; font-family: "Times New Roman", Times, serif; font-size: 10pt; }
    `,
    body,
  });
}
