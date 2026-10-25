import { escapeHtml as e, formDocument, printHtmlViaIframe, seals, upperDate } from "../../../shared/print/formKit";
import type { Report, Section } from "../components/ReportSections";
import { SECTION_LABELS } from "../components/ReportSections";

export type ReportTab = "all" | Section;

export function consolidatedReportHtml(report: Report, tab: ReportTab = "all"): string {
  const sectionsToInclude: Section[] = tab === "all" ? report.sections : [tab];

  const sectionsHtml = sectionsToInclude
    .map((sectionKey) => {
      switch (sectionKey) {
        case "lupon": {
          const l = report.lupon;
          if (!l) return "";
          return `
            <div class="report-block">
              <h3 class="section-title">I. KATARUNGANG PAMBARANGAY (LUPON TAGAPAMAYAPA)</h3>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Metric / Indicator</th>
                    <th class="r">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Cases filed in this period</td><td class="r b">${e(l.filed)}</td></tr>
                  <tr><td>Cases successfully settled</td><td class="r b">${e(l.settled)}</td></tr>
                  <tr><td>Cases currently ongoing</td><td class="r b">${e(l.open_now)}</td></tr>
                  <tr><td>Cases referred out (Court / Police / Other Agencies)</td><td class="r b">${e(l.referred_out)}</td></tr>
                  <tr><td>Hearings held</td><td class="r b">${e(l.hearings_held)}</td></tr>
                  <tr><td>Hearings scheduled</td><td class="r b">${e(l.hearings_scheduled)}</td></tr>
                  <tr><td>Filing fees settled</td><td class="r b">₱${Number(l.fees_settled).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td></tr>
                </tbody>
              </table>

              ${
                l.by_classification && l.by_classification.length > 0
                  ? `
                <h4 class="sub-title">Cases by Classification</h4>
                <table class="data-table sub-table">
                  <thead>
                    <tr><th>Classification</th><th class="r">Count</th></tr>
                  </thead>
                  <tbody>
                    ${l.by_classification
                      .map((c) => `<tr><td>${e(c.label)}</td><td class="r">${e(c.total)}</td></tr>`)
                      .join("")}
                  </tbody>
                </table>
              `
                  : ""
              }
            </div>
          `;
        }

        case "vawc": {
          const v = report.vawc;
          if (!v) return "";
          return `
            <div class="report-block">
              <h3 class="section-title">II. BARANGAY VAW DESK (CONFIDENTIAL REPORT)</h3>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Metric / Indicator</th>
                    <th class="r">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Cases recorded during this period</td><td class="r b">${e(v.opened)}</td></tr>
                  <tr><td>Active cases currently undergoing intervention / protection</td><td class="r b">${e(v.open_now)}</td></tr>
                </tbody>
              </table>
              <p class="note"><strong>Confidentiality Notice:</strong> ${e(v.note)}</p>
            </div>
          `;
        }

        case "health": {
          const h = report.health;
          if (!h) return "";
          return `
            <div class="report-block">
              <h3 class="section-title">III. BARANGAY HEALTH STATION</h3>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Health Service / Program</th>
                    <th class="r">Accomplishment</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Patient consultations & clinic visits</td><td class="r b">${e(h.visits)}</td></tr>
                  <tr><td>Prenatal visits attended</td><td class="r b">${e(h.prenatal_visits)}</td></tr>
                  <tr><td>New pregnancies registered</td><td class="r b">${e(h.pregnancies_registered)}</td></tr>
                  <tr><td>Senior citizen health wellness checks</td><td class="r b">${e(h.senior_checks)}</td></tr>
                  <tr><td>Animal bite cases managed & referred</td><td class="r b">${e(h.animal_bites_referred)}</td></tr>
                  <tr><td>Total immunization & vaccine doses given</td><td class="r b">${e(h.doses_given)}</td></tr>
                </tbody>
              </table>

              ${
                h.doses_by_vaccine && h.doses_by_vaccine.length > 0
                  ? `
                <h4 class="sub-title">Vaccine Doses Administered by Vaccine Type</h4>
                <table class="data-table sub-table">
                  <thead>
                    <tr><th>Vaccine</th><th class="r">Doses</th></tr>
                  </thead>
                  <tbody>
                    ${h.doses_by_vaccine
                      .map((vac) => `<tr><td>${e(vac.label)}</td><td class="r">${e(vac.total)}</td></tr>`)
                      .join("")}
                  </tbody>
                </table>
              `
                  : ""
              }
            </div>
          `;
        }

        case "population": {
          const p = report.population;
          if (!p) return "";
          return `
            <div class="report-block">
              <h3 class="section-title">IV. POPULATION & CIVIL REGISTRATION OFFICE</h3>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Demographic Metric</th>
                    <th class="r">Count</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Total verified residents</td><td class="r b">${e(p.residents.toLocaleString())}</td></tr>
                  <tr><td>Male residents</td><td class="r b">${e(p.male.toLocaleString())}</td></tr>
                  <tr><td>Female residents</td><td class="r b">${e(p.female.toLocaleString())}</td></tr>
                  <tr><td>Registered households</td><td class="r b">${e(p.households.toLocaleString())}</td></tr>
                  <tr><td>Registered voters</td><td class="r b">${e(p.registered.toLocaleString())}</td></tr>
                </tbody>
              </table>

              ${
                p.by_sector && p.by_sector.length > 0
                  ? `
                <h4 class="sub-title">Population by Sector</h4>
                <table class="data-table sub-table">
                  <thead>
                    <tr><th>Sector</th><th class="r">Count</th></tr>
                  </thead>
                  <tbody>
                    ${p.by_sector
                      .map((sec) => `<tr><td>${e(sec.label)}</td><td class="r">${e(sec.total.toLocaleString())}</td></tr>`)
                      .join("")}
                  </tbody>
                </table>
              `
                  : ""
              }

              ${
                p.by_zone && p.by_zone.length > 0
                  ? `
                <h4 class="sub-title">Population by Zone / Purok</h4>
                <table class="data-table sub-table">
                  <thead>
                    <tr><th>Zone / Purok</th><th class="r">Count</th></tr>
                  </thead>
                  <tbody>
                    ${p.by_zone
                      .map((z) => `<tr><td>${e(z.label)}</td><td class="r">${e(z.total.toLocaleString())}</td></tr>`)
                      .join("")}
                  </tbody>
                </table>
              `
                  : ""
              }
            </div>
          `;
        }

        case "certificates": {
          const c = report.certificates;
          if (!c) return "";
          return `
            <div class="report-block">
              <h3 class="section-title">V. BARANGAY CLERK — CERTIFICATES & CLEARANCES</h3>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Transaction Status</th>
                    <th class="r">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Certificate requests received</td><td class="r b">${e(c.requested)}</td></tr>
                  <tr><td>Certificates officially released to clients</td><td class="r b">${e(c.released)}</td></tr>
                  <tr><td>Certificates awaiting release / collection</td><td class="r b">${e(c.waiting)}</td></tr>
                </tbody>
              </table>

              ${
                c.by_type && c.by_type.length > 0
                  ? `
                <h4 class="sub-title">Issued Certificates by Document Type</h4>
                <table class="data-table sub-table">
                  <thead>
                    <tr><th>Certificate Type</th><th class="r">Count</th></tr>
                  </thead>
                  <tbody>
                    ${c.by_type
                      .map((t) => `<tr><td>${e(t.label)}</td><td class="r">${e(t.total)}</td></tr>`)
                      .join("")}
                  </tbody>
                </table>
              `
                  : ""
              }
            </div>
          `;
        }

        default:
          return "";
      }
    })
    .join("\n");

  const todayStr = upperDate(new Date().toISOString().slice(0, 10));

  const body = `
    <table class="head-table" style="width:100%;margin-bottom:12px;border-bottom:2px solid #000;padding-bottom:10px;">
      <tr>
        <td style="width:75px;text-align:center;vertical-align:middle;">
          <img style="width:70px;height:70px;object-fit:contain;" src="${seals.tagoloan()}" alt="Municipality of Tagoloan Seal" />
        </td>
        <td style="text-align:center;font-family:'Times New Roman',serif;vertical-align:middle;">
          <p style="margin:0;font-size:10.5pt;">Republic of the Philippines</p>
          <p style="margin:0;font-size:10.5pt;">Province of Misamis Oriental</p>
          <p style="margin:0;font-size:10.5pt;">Municipality of Tagoloan</p>
          <p style="margin:2px 0 0;font-size:13pt;font-weight:bold;letter-spacing:1px;">BARANGAY NATUMOLAN</p>
          <p style="margin:2px 0 0;font-size:11pt;font-weight:bold;color:#1e3a8a;">OFFICE OF THE PUNONG BARANGAY &amp; BARANGAY SECRETARY</p>
        </td>
        <td style="width:75px;text-align:center;vertical-align:middle;">
          <img style="width:70px;height:70px;object-fit:contain;" src="${seals.barangay()}" alt="Barangay Natumolan Seal" />
        </td>
      </tr>
    </table>

    <div style="text-align:center;margin:12px 0 16px;">
      <h2 style="margin:0;font-size:14pt;font-weight:bold;text-decoration:underline;letter-spacing:0.5px;">
        ${tab === "all" ? "CONSOLIDATED BARANGAY ACCOMPLISHMENT &amp; STATISTICAL REPORT" : `${e(SECTION_LABELS[tab]).toUpperCase()} ACCOMPLISHMENT REPORT`}
      </h2>
      <p style="margin:4px 0 0;font-size:10pt;color:#333;">
        REPORTING PERIOD: <strong>${e(report.period.label.toUpperCase())}</strong> (${e(report.period.from)} to ${e(report.period.to)})
      </p>
      <p style="margin:2px 0 0;font-size:9pt;color:#666;">Generated on: ${e(todayStr)}</p>
    </div>

    ${sectionsHtml}

    <div class="sign-block" style="margin-top:28px;page-break-inside:avoid;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:50%;vertical-align:top;padding-right:20px;">
            <p style="margin:0 0 35px;font-size:10pt;">Prepared by:</p>
            <p style="margin:0;font-weight:bold;font-size:11pt;text-decoration:underline;">GRACE G. GALOLA</p>
            <p style="margin:2px 0 0;font-size:9.5pt;color:#444;">Barangay Secretary</p>
          </td>
          <td style="width:50%;vertical-align:top;padding-left:20px;">
            <p style="margin:0 0 35px;font-size:10pt;">Attested and Approved by:</p>
            <p style="margin:0;font-weight:bold;font-size:11pt;text-decoration:underline;">HON. RAFAEL P. VIDAL</p>
            <p style="margin:2px 0 0;font-size:9.5pt;color:#444;">Punong Barangay</p>
          </td>
        </tr>
      </table>
    </div>
  `;

  const css = `
    .section-title { margin: 18px 0 6px; font-size: 11pt; font-weight: bold; background: #f3f4f6; padding: 4px 8px; border-left: 4px solid #1e3a8a; }
    .sub-title { margin: 10px 0 4px; font-size: 10pt; font-weight: bold; color: #374151; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10pt; }
    .data-table th, .data-table td { border: 1px solid #d1d5db; padding: 5px 8px; }
    .data-table thead { display: table-header-group; background: #f9fafb; font-weight: bold; }
    .data-table tr { page-break-inside: avoid; }
    .sub-table { margin-bottom: 8px; }
    .r { text-align: right; }
    .b { font-weight: bold; }
    .note { font-size: 8.5pt; color: #4b5563; font-style: italic; margin-top: 4px; margin-bottom: 10px; }
    .report-block { margin-bottom: 16px; page-break-inside: auto; }
  `;

  return formDocument({
    title: `Consolidated Report - ${report.period.label}`,
    page: "A4 portrait",
    margin: "0.4in",
    css,
    body,
  });
}

export function printConsolidatedReport(report: Report, tab: ReportTab = "all"): void {
  const html = consolidatedReportHtml(report, tab);
  printHtmlViaIframe(html);
}

