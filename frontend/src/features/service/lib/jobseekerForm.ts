/**
 * The Monthly Summary of Availees/Beneficiaries — First-Time Jobseekers —
 * on the barangay's own sheet (Jseeker_Report_Monthly_CIT): both seals, the
 * month table, and the two signatures dated the day it prints.
 *
 * Legal paper, portrait. The wording is the form's own, spelling and all.
 */

import { escapeHtml as e, formDocument, seals, upperDate, withHon } from "../../../shared/print/formKit";

export interface JobseekerMonth {
  total: number;
  male: number;
  female: number;
  basic: number;
  college: number;
  osy: number;
  isy: number;
}

export interface JobseekerSummary {
  year: number;
  as_of: string | null;
  months: (JobseekerMonth | null)[];
  totals: JobseekerMonth;
  unanswered: number;
  today: string;
}

/* As the form writes them — short and long mixed. */
const MONTHS = ["JAN", "FEB", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEP", "OCT", "NOV", "DEC"];

const KEYS: (keyof JobseekerMonth)[] = ["total", "male", "female", "basic", "college", "osy", "isy"];

export function jobseekerHtml(s: JobseekerSummary, names: { secretary: string; punong_barangay: string }): string {
  /* A month still to come is left blank; a month gone by says 0. */
  const cells = (m: JobseekerMonth | null) => KEYS.map((k) => `<td>${m ? m[k] : ""}</td>`).join("");
  const date = upperDate(s.today);

  const body = `
    <table class="head">
      <tr>
        <td class="sealcell"><img src="${seals.barangay()}" alt="" class="seal" /></td>
        <td class="headtext">
          <p>Republic of the Philippines</p>
          <p>Province of Misamis Oriental</p>
          <p>Municipality of Tagoloan</p>
          <p class="b">BARANGAY NATUMOLAN</p>
          <p>-oOo-</p>
        </td>
        <td class="sealcell"><img src="${seals.tagoloan()}" alt="" class="seal muni" /></td>
      </tr>
    </table>
    <div class="rule"></div>

    <h1>MONTHLY SUMMARY OF<br/>AVAILEES/BENEFICIARIES</h1>
    <p class="asof">As of ${e(s.as_of ?? "")}</p>

    <table class="grid">
      <colgroup>
        <col style="width:13%"/><col style="width:17%"/><col style="width:8%"/><col style="width:8%"/>
        <col style="width:21%"/><col style="width:14%"/><col style="width:9.5%"/><col style="width:9.5%"/>
      </colgroup>
      <tr>
        <th rowspan="2">MONTH</th>
        <th rowspan="2">NO OF<br/>BENEFICIARIES/<br/>AVAILESS</th>
        <th colspan="2">SEX/GENDER</th>
        <th colspan="4">EDUCATIONAL LEVEL</th>
      </tr>
      <tr>
        <th>M</th><th>F</th>
        <th>Elem/High<br/>School/Senior<br/>High School</th>
        <th>College<br/>Grad./<br/>Level</th>
        <th>OSY</th><th>ISY</th>
      </tr>
      ${MONTHS.map((name, i) => `<tr><td class="l">${name}</td>${cells(s.months[i] ?? null)}</tr>`).join("")}
      <tr><td class="l">&nbsp;</td>${"<td></td>".repeat(7)}</tr>
      <tr class="tot"><td class="l b">TOTAL</td>${KEYS.map((k) => `<td class="b">${s.totals[k]}</td>`).join("")}</tr>
    </table>

    <p class="note">Note: this form shall accomplished by the barangay to be submitted to DILG through Municipality to dict.</p>

    <table class="signs">
      <tr><td>Prepared by:</td><td>Reviewed and Approved:</td></tr>
      <tr>
        <td class="c"><span class="sig">${e(names.secretary)}</span><br/>Barangay Secretary</td>
        <td class="c"><span class="sig">${e(withHon(names.punong_barangay))}</span><br/>Punong Barangay</td>
      </tr>
      <tr>
        <td class="c date"><span class="sig">${e(date)}</span><br/><b>DATE</b></td>
        <td class="c date"><span class="sig">${e(date)}</span><br/><b>DATE</b></td>
      </tr>
    </table>`;

  return formDocument({
    title: `Monthly Summary of Availees-Beneficiaries — ${s.as_of ?? s.year}`,
    page: "8.5in 14in",
    margin: "0.7in",
    css: `
      body { font-family: Verdana, Tahoma, Arial, sans-serif; font-size: 10pt; }
      .head { width: 100%; }
      .head td { vertical-align: middle; }
      .sealcell { width: 22%; text-align: center; }
      .seal { width: 92px; height: auto; }
      .seal.muni { width: 90px; }
      .headtext { text-align: center; font-size: 10.5pt; line-height: 1.3; }
      .headtext p { margin: 0; }
      .rule { border-top: 3px solid #000; margin: 10px 0 16px; }
      h1 { text-align: center; font-family: "Arial Black", Arial, sans-serif; font-size: 17pt; letter-spacing: .5px;
           margin: 0; line-height: 1.25; color: #fff; -webkit-text-stroke: 1px #000; text-shadow: 2px 2px 0 #9a9a9a; }
      .asof { text-align: center; margin: 6px 0 16px; }
      .grid { width: 100%; table-layout: fixed; }
      .grid th, .grid td { border: 1px solid #000; padding: 3px 4px; font-size: 9.5pt; text-align: center; height: 20px; }
      /* "SEX/GENDER" spans two narrow columns and must not spill into the
         next heading. */
      .grid th { font-weight: 700; font-size: 9pt; }
      .grid td.l { text-align: left; }
      .grid .tot td { background: #ffff00; }
      .note { font-style: italic; margin: 14px 0 34px; font-size: 10pt; }
      .signs { width: 100%; }
      .signs td { width: 50%; vertical-align: top; padding: 4px 8px; }
      .signs .c { padding-top: 26px; }
      .signs .date { padding-top: 22px; }
      .sig { font-weight: 700; text-decoration: underline; }
    `,
    body,
  });
}
