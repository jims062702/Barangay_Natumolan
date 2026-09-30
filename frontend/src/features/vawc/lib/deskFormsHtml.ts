/**
 * The VAW Desk's printed forms, on the barangay's own layouts.
 *
 *   VAW-C Cases (VawC-CasesQuarterly)   Legal, landscape — names, one row
 *                                        per victim-survivor
 *   VAW Form 1 (Data Capture Form)      A4, landscape — case codes and "/"
 *   Barangay VAW Report                 A4, portrait — the Annual
 *     (Annual Accomplishment Report)    Accomplishment Report, counts only
 *
 * All carry the barangay seal on the left and Tagoloan's on the right.
 */

import { escapeHtml as e, formDocument, seals, tick, withHon, withoutHon } from "../../../shared/print/formKit";

export interface CasesReportRow {
  name: string;
  age: number | null;
  civil_status: string | null;
  education: string | null;
  date_intake: string | null;
  address: string | null;
  abuse: string | null;
  relationship: string | null;
  services: string;
  remarks: string | null;
}

export interface CasesReport {
  heading: string;
  subheading: string | null;
  rows: CasesReportRow[];
}

export interface DataCaptureRow {
  code: string;
  [column: string]: string | boolean;
}

export interface DataCapture {
  period: string;
  rows: DataCaptureRow[];
  totals: Record<string, number>;
}

export interface DeskNames {
  vaw_desk: string;
  punong_barangay: string;
}

export function casesReportHtml(r: CasesReport, names: DeskNames): string {
  const minRows = r.subheading ? 14 : 6;
  const row = (x: CasesReportRow) => `
    <tr>
      <td class="l">${e(x.name)}</td><td>${e(x.age ?? "")}</td><td>${e(x.civil_status ?? "")}</td>
      <td>${e(x.education ?? "")}</td><td>${e(x.date_intake ?? "")}</td><td class="l">${e(x.address ?? "")}</td>
      <td>${e(x.abuse ?? "")}</td><td>${e(x.relationship ?? "")}</td><td class="l">${e(x.services)}</td>
      <td class="l">${e(x.remarks ?? "")}</td>
    </tr>`;

  const body = `
    <table class="head">
      <tr>
        <td class="sealcell"><img class="seal" src="${seals.barangay()}" alt="" /></td>
        <td class="c b headtext">
          <p>${r.subheading ? "Summary of VAW-C CASES" : "VAW-C CASES"}</p>
          <p>${e(r.subheading ?? r.heading)}</p>
          <p>Barangay Natumolan</p>
        </td>
        <td class="sealcell"><img class="seal muni" src="${seals.tagoloan()}" alt="" /></td>
      </tr>
    </table>

    <table class="grid">
      <colgroup>
        <col style="width:15%"/><col style="width:4%"/><col style="width:6%"/><col style="width:8%"/>
        <col style="width:7%"/><col style="width:11%"/><col style="width:8%"/><col style="width:8%"/>
        <col style="width:18%"/><col style="width:15%"/>
      </colgroup>
      <tr>
        <th>Name of Victim</th><th>Age</th><th>Civil<br/>Status</th><th>Educational<br/>Attainment</th>
        <th>Date<br/>Intake</th><th>Address</th><th>Type of<br/>Abuse<br/>Category</th>
        <th>Relationship<br/>To<br/>Perpetrator</th><th>Service<br/>Extended</th><th>Remarks</th>
      </tr>
      ${r.rows.map(row).join("")}
      ${`<tr class="empty">${"<td></td>".repeat(10)}</tr>`.repeat(Math.max(0, minRows - r.rows.length))}
    </table>

    <table class="signs">
      <tr><td class="b">Submitted by:</td><td class="b">Noted by:</td></tr>
      <tr>
        <td class="b"><span class="u">${e(names.vaw_desk)}</span><br/>Barangay VAW-C Desk Person</td>
        <td class="b"><span class="u">${e(withoutHon(names.punong_barangay))}</span><br/>Punong Barangay</td>
      </tr>
    </table>`;

  return formDocument({
    title: `VAW-C Cases — ${r.subheading ?? r.heading}`,
    page: "14in 8.5in",
    margin: "0.5in",
    css: `
      .head { width: 100%; margin-bottom: 4px; }
      .sealcell { width: 25%; text-align: center; vertical-align: middle; }
      .seal { width: 118px; height: auto; }
      .seal.muni { width: 88px; }
      .headtext p { margin: 0; line-height: 1.35; font-size: 10.5pt; }
      .grid { width: 100%; table-layout: fixed; }
      .grid th, .grid td { border: 1px solid #000; padding: 3px 4px; font-size: 9.5pt; text-align: center; vertical-align: middle; word-wrap: break-word; }
      .grid th { font-weight: 700; }
      .grid td.l { text-align: left; }
      .grid tr.empty td { height: ${r.subheading ? "20px" : "46px"}; }
      .grid tr:not(.empty) td { height: 34px; }
      .signs { width: 100%; margin-top: 26px; }
      .signs td { width: 50%; padding: 3px 6px; vertical-align: top; font-size: 10.5pt; }
      .signs tr + tr td { padding-top: 22px; }
    `,
    body,
  });
}

const TYPES = [
  ["physical", "Physical<br/>Abuse<br/>(2a)"],
  ["sexual", "Sexual<br/>Abuse<br/>(2b)"],
  ["psychological", "Psychological<br/>/<br/>Emotional<br/>Abuse<br/>(2c)"],
  ["economic", "Economic<br/>Abuse<br/>(2d)"],
] as const;

const ACTIONS = [
  ["bpo", "Issued<br/>BPO<br/>(3a)"],
  ["lswdo", "Referred<br/>to<br/>LSWDO<br/>(3b)"],
  ["pnp", "Referred<br/>to PNP<br/>(3c)"],
  ["nbi", "Referred<br/>to NBI<br/>(3d)"],
  ["medical", "Referred for Medical<br/>Treatment<br/>(3e)"],
  ["legal", "Referred for Legal<br/>Assistance<br/>(3f)"],
  ["court", "Referred<br/>to Court<br/>(3g)"],
  ["others", "Others<br/>(ex: Referred to NGOs, FBOs)<br/>(3h)"],
] as const;

export function dataCaptureHtml(d: DataCapture, names: DeskNames): string {
  const columns = [...TYPES, ...ACTIONS].map(([key]) => key);
  const total = (key: string) => {
    const n = d.totals[key] ?? 0;
    return n > 0 ? String(n) : "";
  };

  const body = `
    <p class="formno">VAW Form 1</p>
    <table class="head">
      <tr>
        <td class="sealcell"><img class="seal" src="${seals.barangay()}" alt="" /></td>
        <td class="c headtext">
          <p class="t1">BARANGAY DATA CAPTURE FORM</p>
          <p class="t2">MONITORING OF INCIDENCE ON VIOLENCE AGAINST WOMEN (VAW)</p>
          <p class="t3">For the period: <span class="u">${e(d.period)}</span></p>
        </td>
        <td class="sealcell"><img class="seal muni" src="${seals.tagoloan()}" alt="" /></td>
      </tr>
    </table>

    <table class="place">
      <tr><td>Region:</td><td class="b">10</td></tr>
      <tr><td>Province:</td><td class="b">Misamis Oriental</td></tr>
      <tr><td>City/Municipality:</td><td class="b">Tagoloan</td></tr>
      <tr><td>Barangay:</td><td class="b">NATUMOLAN</td></tr>
    </table>

    <table class="grid">
      <tr>
        <th rowspan="2" class="victim">VAW<br/>VICTIM/S<br/>(1)</th>
        <th colspan="4" class="types">TYPES OF VIOLENCE (2)</th>
        <th colspan="8" class="acts">ACTIONS TAKEN BY THE BARANGAY (3)</th>
      </tr>
      <tr>
        ${TYPES.map(([, label]) => `<th class="types">${label}</th>`).join("")}
        ${ACTIONS.map(([, label]) => `<th class="acts">${label}</th>`).join("")}
      </tr>
      <tr class="shade"><td class="victim"></td>${TYPES.map(() => '<td class="types"></td>').join("")}${ACTIONS.map(() => '<td class="acts"></td>').join("")}</tr>
      ${d.rows.map((r) => `<tr><td>${e(r.code)}</td>${columns.map((k) => `<td>${tick(Boolean(r[k]))}</td>`).join("")}</tr>`).join("")}
      ${`<tr class="empty">${"<td></td>".repeat(13)}</tr>`.repeat(Math.max(0, 6 - d.rows.length))}
      <tr class="tot"><td class="b l">TOTAL: ${d.totals.victims}</td>${columns.map((k) => `<td>${total(k)}</td>`).join("")}</tr>
    </table>

    <table class="signs">
      <tr><td>Submitted by:</td><td class="r">Noted By:</td></tr>
      <tr>
        <td><span class="b u">${e(names.vaw_desk)}</span><br/>VAW/ASH Desk Officer</td>
        <td class="r"><span class="b u">${e(withHon(names.punong_barangay))}</span><br/>Punong Barangay</td>
      </tr>
    </table>`;

  return formDocument({
    title: `VAW Form 1 — ${d.period}`,
    page: "A4 landscape",
    margin: "0.45in",
    css: `
      body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; }
      .formno { margin: 0 0 2px; }
      .head { width: 100%; }
      .sealcell { width: 18%; text-align: center; vertical-align: middle; }
      .seal { width: 118px; height: auto; }
      .seal.muni { width: 104px; }
      .headtext p { margin: 0; }
      .t1 { font-size: 14pt; font-weight: 700; margin-top: 14px !important; }
      .t2 { font-size: 12.5pt; font-weight: 700; }
      .t3 { font-weight: 700; }
      .place { margin: 8px 0 10px; }
      .place td { padding: 0 34px 0 0; font-size: 10pt; }
      .grid { width: 100%; table-layout: fixed; }
      .grid th, .grid td { border: 1px solid #000; padding: 2px 3px; text-align: center; vertical-align: middle; font-size: 8.5pt; word-wrap: break-word; }
      /* Smaller, and never broken mid-word: "Psychological" reads whole. */
      .grid th { font-weight: 700; font-size: 7.5pt; word-wrap: normal; }
      .grid td { height: 18px; }
      .grid td.l { text-align: left; }
      .victim { background: #fce4d6; }
      .types { background: #e2efda; }
      .acts { background: #f2dcdb; }
      .grid .shade td { height: 32px; }
      .grid .tot td { background: #ffff00; font-weight: 700; }
      .signs { width: 100%; margin-top: 30px; }
      .signs td { width: 50%; vertical-align: top; padding: 2px 10px; font-size: 10pt; }
      .signs tr + tr td { padding-top: 18px; }
      /* The right-hand block starts inside its own half, so a name never
         wraps: "HON. RAFAEL P. VIDAL" is one line. */
      .signs .r { padding-left: 24%; }
    `,
    body,
  });
}

/* ------------------------------------------------------------------------
 * Barangay VAW Report — Annual Accomplishment Report
 * ---------------------------------------------------------------------- */

export interface AnnualRow {
  victims: number;
  referred: { cmswdo: number; pnp: number; court: number; hospital: number; others: number };
  applied_bpo: number;
  bpo_issued: number;
}

export interface Headcount {
  total: number;
  male: number;
  female: number;
  sex_not_recorded: number;
  adults: number;
  minors: number;
  age_not_recorded: number;
  as_of: string;
}

/** The table's rows, in the paper's order and with the paper's words. */
export const ANNUAL_ROWS = [
  ["ra9262", "Violence Against Women and their Children (RA 9262)"],
  ["physical", "Physical"],
  ["sexual", "Sexual Extortion"],
  ["psychological", "Psychological"],
  ["economic", "Economic"],
  ["rape", "Rape (RA 9262)"],
  ["trafficking", "Trafficking in Persons RA 9208/10364"],
  ["sexual_harassment", "Sexual Harassment (RA 7877)"],
] as const;

export type AnnualRowKey = (typeof ANNUAL_ROWS)[number][0];

export interface AnnualReport {
  year: number;
  population: Headcount;
  clients_served: number;
  cases_received: number;
  cases_acted_upon: number;
  /* null: a row the case files cannot count (Trafficking) — left blank. */
  rows: Record<AnnualRowKey, AnnualRow | null>;
}

/** The header's population figures, as the desk will print them. */
export interface AnnualPopulation {
  total: string;
  male: string;
  female: string;
  adults: string;
  minors: string;
}

/** One line of Section II, typed on the page. */
export interface AnnualActivity {
  trainings: string;
  advocacy: string;
  others: string;
  remarks: string;
}

const REFERRED = ["cmswdo", "pnp", "court", "hospital", "others"] as const;

export function annualReportHtml(
  r: AnnualReport,
  form: { population: AnnualPopulation; activities: AnnualActivity[] },
  names: DeskNames,
): string {
  const p = form.population;
  /* A count of none is a blank cell, as the desk leaves it on paper. */
  const n = (value: number | undefined) => (value ? String(value) : "");

  const caseRow = ([key, label]: (typeof ANNUAL_ROWS)[number]) => {
    const x = r.rows[key];
    /* The first row is every case — its victims say 0 rather than nothing. */
    const victims = x ? (key === "ra9262" ? String(x.victims) : n(x.victims)) : "";

    return `
      <tr class="${key === "ra9262" || key === "trafficking" ? "tall" : ""}">
        <td class="name">${e(label)}</td>
        <td>${victims}</td>
        ${REFERRED.map((col) => `<td>${x ? n(x.referred[col]) : ""}</td>`).join("")}
        <td>${x ? n(x.applied_bpo) : ""}</td>
        <td>${x ? n(x.bpo_issued) : ""}</td>
      </tr>`;
  };

  const typed = form.activities.filter((a) => a.trainings.trim() || a.advocacy.trim() || a.others.trim() || a.remarks.trim());
  const activity = (a?: AnnualActivity) => `
    <tr>
      <td>${e(a?.trainings.trim() ?? "")}</td><td>${e(a?.advocacy.trim() ?? "")}</td>
      <td>${e(a?.others.trim() ?? "")}</td><td>${e(a?.remarks.trim() ?? "")}</td>
    </tr>`;

  const body = `
    <table class="head">
      <tr>
        <td class="sealcell"><img class="seal" src="${seals.barangay()}" alt="" /></td>
        <td class="c headtext">
          <p class="t1">BARANGAY VIOLENCE AGAINST WOMEN (VAW) REPORT</p>
          <p class="t2">Annual Accomplishment Report</p>
          <p class="t2">Covered Period: JANUARY - DECEMBER ${e(r.year)}</p>
        </td>
        <td class="sealcell"><img class="seal muni" src="${seals.tagoloan()}" alt="" /></td>
      </tr>
    </table>

    <table class="place">
      <colgroup><col style="width:21%"/><col style="width:33%"/><col style="width:32%"/><col style="width:14%"/></colgroup>
      <tr><td>Barangay:</td><td>NATUMOLAN</td><td></td><td></td></tr>
      <tr><td>City/Municipality:</td><td>TAGOLOAN</td><td></td><td></td></tr>
      <tr><td>Province:</td><td>MISAMIS ORIENTAL</td><td></td><td></td></tr>
      <tr><td>Region:</td><td>X</td><td></td><td></td></tr>
      <tr><td>Total Population:</td><td>${e(p.total)}</td><td></td><td></td></tr>
      <tr><td>No. of Male:</td><td>${e(p.male)}</td><td>No. of Females:</td><td>${e(p.female)}</td></tr>
      <tr><td colspan="2">No. of Adults:(18yrs &amp; Above): ${e(p.adults)}</td><td>No. of Minors: (17yrs &amp; Below):</td><td>${e(p.minors)}</td></tr>
    </table>

    <p class="roman">I.</p>
    <table class="totals">
      <tr><td class="first">Total no. of Clients Served: ${r.clients_served}</td><td class="shead">Summary of Cases Received and Actions Taken</td></tr>
      <tr><td colspan="2">Total no. of Cases Received by the Barangay: ${r.cases_received}</td></tr>
      <tr><td colspan="2">Total no. of Cases Acted Upon: ${r.cases_acted_upon}</td></tr>
    </table>

    <table class="grid">
      <colgroup>
        <col style="width:18%"/><col style="width:9%"/><col style="width:10%"/><col style="width:6%"/>
        <col style="width:7%"/><col style="width:9%"/><col style="width:8%"/><col style="width:18%"/><col style="width:15%"/>
      </colgroup>
      <tr>
        <th rowspan="2">Name of Case</th>
        <th rowspan="2">Total No.<br/>of Victims</th>
        <th colspan="5">Total of cases Referred</th>
        <th rowspan="2" class="top">Total No. of Victims<br/>who Applied for BPO</th>
        <th rowspan="2" class="top">Total No. of<br/>BPO&#39;s<br/>issued</th>
      </tr>
      <tr><th>C/MSWDO</th><th>PNP</th><th>Court</th><th>Hospital</th><th>Others</th></tr>
      ${ANNUAL_ROWS.map(caseRow).join("")}
    </table>

    <p class="roman two">II.</p>
    <p class="shead c">MS/Projects/Activities Implemented to address VAW issues in the Barangay</p>
    <p class="specify">(Pls. Specify)</p>
    <table class="acts">
      <colgroup><col style="width:25%"/><col style="width:25%"/><col style="width:25%"/><col style="width:25%"/></colgroup>
      <tr><th>Trainings</th><th>Advocacy</th><th>Others</th><th>Remarks</th></tr>
      ${typed.map((a) => activity(a)).join("")}
      ${activity().repeat(Math.max(0, 6 - typed.length))}
    </table>

    <table class="signs">
      <tr><td>Submitted by:</td><td>Noted by:</td></tr>
      <tr>
        <td><span class="b u">${e(names.vaw_desk)}</span><br/>VAW Desk Officer</td>
        <td><span class="b u">${e(withoutHon(names.punong_barangay))}</span><br/>Punong Barangay</td>
      </tr>
    </table>`;

  return formDocument({
    title: `Barangay VAW Report — Annual Accomplishment Report ${r.year}`,
    page: "A4",
    margin: "0.5in",
    css: `
      body { font-family: "Times New Roman", Times, serif; font-size: 10pt; font-weight: 700; }
      .head { width: 100%; }
      .sealcell { width: 14%; text-align: center; vertical-align: middle; }
      .seal { width: 86px; height: auto; }
      .seal.muni { width: 78px; }
      .headtext p { margin: 0; line-height: 1.25; }
      /* One line, as on the paper. */
      .t1 { font-size: 12pt; white-space: nowrap; }
      .t2 { font-size: 10.5pt; }
      .place { width: 100%; margin-top: 2px; table-layout: fixed; }
      .place td { padding: 0 4px 0 0; line-height: 1.2; vertical-align: top; }
      .roman { margin: 8px 0 2px; }
      .totals td { padding: 0; line-height: 1.3; white-space: nowrap; }
      .totals .first { padding-right: 40px; }
      .shead { margin: 0; }
      .grid { width: 100%; table-layout: fixed; margin-top: 12px; }
      .grid th, .grid td { border: 1px solid #000; padding: 2px 3px; text-align: center; vertical-align: middle; word-wrap: break-word; }
      .grid th { font-size: 9pt; }
      .grid th.top { vertical-align: top; }
      .grid td { height: 26px; font-size: 10pt; }
      .grid tr.tall td { height: 46px; }
      .grid td.name { font-size: 9pt; }
      .roman.two { margin-top: 10px; }
      .specify { margin: 10px 0 4px; font-size: 9pt; }
      .acts { width: 100%; table-layout: fixed; }
      .acts th, .acts td { border: 1px solid #000; padding: 2px 4px; vertical-align: top; }
      .acts th { font-size: 9pt; }
      .acts td { height: 20px; font-weight: 400; white-space: pre-wrap; word-wrap: break-word; }
      .signs { width: 100%; margin-top: 26px; }
      .signs td { width: 50%; vertical-align: top; padding: 2px 10px 2px 0; font-weight: 400; }
      .signs tr + tr td { padding-top: 22px; }
    `,
    body,
  });
}
