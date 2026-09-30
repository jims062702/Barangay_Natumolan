/**
 * The Monthly Transmittal of Final Reports — the barangay's own sheet, filled.
 *
 * Laid out from KP_FORM_REPORT_MONTHLY: the heading, "TO: Judge …", the
 * reporting month, the case table with a "/" in each cell that applies and a
 * number in the TOTAL row (a row's own Total cells stay blank, as on the
 * barangay's sample), and the four signature blocks. Legal paper,
 * landscape — the sheet is eighteen columns wide.
 */

import { escapeHtml as e, formDocument, seals, tick, withoutHon } from "../../../shared/print/formKit";

export interface TransmittalRow {
  case_number: string;
  complainant: string;
  respondents: string;
  nature: "crim" | "civil" | "others";
  title: string;
  action: "med" | "conci" | "arbit" | "repu" | "cert" | "cancel" | "dropped" | "ongoing" | null;
  remarks: string;
}

export interface Transmittal {
  reporting_month: string;
  rows: TransmittalRow[];
  totals: Record<string, number>;
}

export interface TransmittalNames {
  presiding_judge: string;
  court_place: string;
  secretary: string;
  punong_barangay: string;
  mlgoo: string;
}

const NATURES = ["crim", "civil", "others"] as const;
const ACTIONS = ["med", "conci", "arbit", "repu", "cert", "cancel", "dropped", "ongoing"] as const;

/** The sheet has room for four cases before it needs to grow. */
const MIN_ROWS = 4;

export function transmittalHtml(t: Transmittal, names: TransmittalNames): string {
  const row = (r: TransmittalRow) => `
    <tr>
      <td class="l">${e(r.case_number)}</td>
      <td class="l">${e(r.complainant)}</td>
      <td class="l">${e(r.respondents)}</td>
      ${NATURES.map((n) => `<td>${tick(r.nature === n)}</td>`).join("")}
      <td></td>
      <td class="l">${e(r.title)}</td>
      ${ACTIONS.map((a) => `<td>${tick(r.action === a)}</td>`).join("")}
      <td></td>
      <td class="l">${e(r.remarks)}</td>
    </tr>`;

  const blanks = Math.max(0, MIN_ROWS - t.rows.length);
  const blank = `<tr>${"<td>&nbsp;</td>".repeat(18)}</tr>`;
  const total = (key: string) => {
    const n = t.totals[key] ?? 0;
    return n > 0 ? String(n) : "";
  };

  const body = `
  <div class="box">
    <div class="head">
      <img class="seal" src="${seals.barangay()}" alt="" />
      <p>Republic of the Philippines</p>
      <p>Province of Misamis Oriental</p>
      <p>Municipality of Tagoloan</p>
      <p>Barangay <b>NATUMOLAN</b></p>
      <p class="office b">OFFICE OF THE LUPONG TAGAPAMAYAPA</p>
      <p class="title b">MONTHLY TRANSMITTAL OF FINAL REPORTS</p>
    </div>

    <div class="to">
      <p>TO: Judge <b>${e(names.presiding_judge)}</b></p>
      <p class="in1">Presiding Judge</p>
      <p class="in2">${e(names.court_place)}</p>
    </div>

    <p class="enclosed">Enclosed herewith are the final reports of settlement of disputes and arbitration awards made by the Punong Barangay/ Pangkat ng Tagapagkasundo in the following cases</p>
    <p class="month b">Reporting Month: ${e(t.reporting_month)}</p>

    <table class="grid">
      <colgroup>
        <col style="width:8.5%"/><col style="width:9%"/><col style="width:11%"/>
        <col style="width:3.6%"/><col style="width:3.6%"/><col style="width:3.8%"/><col style="width:3.6%"/>
        <col style="width:14%"/>
        <col style="width:3.6%"/><col style="width:3.6%"/><col style="width:3.6%"/><col style="width:3.6%"/>
        <col style="width:3.6%"/><col style="width:3.8%"/><col style="width:4.2%"/><col style="width:4.4%"/>
        <col style="width:3.6%"/><col style="width:7%"/>
      </colgroup>
      <tr><th colspan="18" class="band">LUPONG TAGAPAMAHAYAG REPORT CASES FILED,ACTION TAKEN</th></tr>
      <tr class="hd">
        <th rowspan="2">Case No.</th>
        <th rowspan="2">Complainant</th>
        <th rowspan="2">Respondent</th>
        <th colspan="4">Nature of Cases</th>
        <th>Description</th>
        <th colspan="10">ACTION TAKEN</th>
      </tr>
      <tr class="hd">
        <th>Crim.</th><th>Civil</th><th>Others</th><th>Total</th>
        <th>Title</th>
        <th>Med.</th><th>Conci</th><th>Arbit</th><th>Repu</th><th>Cert.</th><th>Cancel</th><th>Dropped</th><th>On-going</th><th>Total</th><th>Remarks</th>
      </tr>
      ${t.rows.map(row).join("")}
      ${blank.repeat(blanks)}
      <tr class="tot">
        <td class="nofill"></td><td class="nofill"></td>
        <td class="b c nofill">TOTAL</td>
        ${NATURES.map((n) => `<td>${total(n)}</td>`).join("")}
        <td>${total("nature_total")}</td>
        <td></td>
        ${ACTIONS.map((a) => `<td>${total(a)}</td>`).join("")}
        <td>${total("action_total")}</td>
        <td></td>
      </tr>
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

    <table class="copies">
      <tr>
        <td class="b">DILG:</td>
        <td class="b">TRIAL COURT:</td>
        <td class="b">PNP:</td>
      </tr>
      <tr>
        <td class="name"><span class="sig">${e(names.mlgoo)}</span><br/><span class="role">MLGOO-TAGOLOAN</span></td>
        <td>Name: <span class="line"></span></td>
        <td>Name: <span class="line"></span></td>
      </tr>
    </table>

    <p class="important"><b>IMPORTANT:</b>&nbsp;&nbsp; Lupon/Pangkat Secretary shall transmit not later than the first five days of each month the final reports for preceding month.</p>
  </div>`;

  return formDocument({
    title: `Monthly Transmittal of Final Reports — ${t.reporting_month}`,
    page: "14in 8.5in",
    margin: "0.35in",
    css: `
      body { font-size: 10pt; }
      .box { border: 2px solid #000; padding: 10px 12px 8px; }
      .head { position: relative; text-align: center; min-height: 118px; }
      .head p { margin: 0; line-height: 1.3; }
      .head .seal { position: absolute; left: 21%; top: 0; width: 100px; height: auto; }
      .head .office { margin-top: 10px; }
      .head .title { margin-top: 10px; margin-bottom: 8px; }
      .to p { margin: 0; line-height: 1.3; }
      .to .in1 { padding-left: 64px; }
      .to .in2 { padding-left: 38px; }
      .enclosed { margin: 12px 0 2px; }
      .month { text-align: right; margin: 2px 0 4px; }
      .grid { width: 100%; table-layout: fixed; }
      .grid th, .grid td { border: 1px solid #000; padding: 2px 3px; font-size: 9pt; text-align: center; vertical-align: middle; word-wrap: break-word; }
      .grid td.l { text-align: left; }
      .grid .band { border: 1.5px solid #000; font-size: 9.5pt; }
      .grid .hd th { background: #9999ff; font-weight: 700; }
      .grid .tot td { background: #ff8080; font-weight: 700; }
      .grid .tot td.nofill { background: #fff; }
      .signs, .copies { width: 100%; margin-top: 8px; }
      .signs td, .copies td { padding: 2px 4px; vertical-align: top; }
      .w50 { width: 50%; }
      .name { padding-top: 14px !important; text-align: center; }
      .sig { font-family: "Times New Roman", Times, serif; font-weight: 700; text-decoration: underline; font-size: 11pt; }
      .role { font-size: 10pt; }
      .copies td { width: 33.3%; }
      .line { display: inline-block; width: 190px; border-bottom: 1px solid #000; }
      .important { margin: 10px 0 0; font-family: "Times New Roman", Times, serif; font-size: 10pt; }
    `,
    body,
  });
}
