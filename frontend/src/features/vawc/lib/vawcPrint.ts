import { escapeHtml as e, formDocument, seals, upperDate } from "../../../shared/print/formKit";
import type { VawcCase, VawcReferral, VawcProtectionOrder } from "../types";

const personName = (p?: { first_name?: string; middle_name?: string | null; last_name?: string; suffix?: string | null } | null) =>
  p ? [p.first_name, p.middle_name, p.last_name, p.suffix].filter(Boolean).join(" ") : "";

export function referralFormHtml(caseData: VawcCase, referral: VawcReferral): string {
  const survivorName = caseData.survivor ? personName(caseData.survivor) : "Confidential";
  const respondentName = caseData.respondent ? personName(caseData.respondent) : "Confidential";
  const refDate = referral.referral_date ? upperDate(referral.referral_date) : upperDate(new Date().toISOString());

  const body = `
    <table class="head" style="width:100%;margin-bottom:15px;border-bottom:2px solid #000;padding-bottom:10px;">
      <tr>
        <td style="width:80px;text-align:center;"><img style="width:75px;height:75px;object-fit:contain;" src="${seals.barangay()}" alt="" /></td>
        <td style="text-align:center;font-family:'Times New Roman',serif;">
          <p style="margin:0;font-size:11pt;">Republic of the Philippines</p>
          <p style="margin:0;font-size:11pt;">Province of Misamis Oriental</p>
          <p style="margin:0;font-size:11pt;">Municipality of Tagoloan</p>
          <p style="margin:2px 0 0;font-size:13pt;font-weight:bold;letter-spacing:1px;">BARANGAY NATUMOLAN</p>
          <p style="margin:2px 0 0;font-size:12pt;font-weight:bold;color:#4a154b;">BARANGAY VAW DESK</p>
        </td>
        <td style="width:80px;text-align:center;"><img style="width:75px;height:75px;object-fit:contain;" src="${seals.tagoloan()}" alt="" /></td>
      </tr>
    </table>

    <div style="text-align:center;margin:15px 0 20px;">
      <h2 style="margin:0;font-size:15pt;text-decoration:underline;text-transform:uppercase;letter-spacing:1px;">BARANGAY VAW DESK REFERRAL FORM</h2>
      <p style="margin:4px 0 0;font-size:10pt;color:#555;">Reference / Case Code: <strong>${e(caseData.case_code)}</strong> · Urgency: <strong>${e(referral.urgency)}</strong></p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:15px;font-size:10.5pt;">
      <tr>
        <td style="padding:6px 0;width:28%;"><strong>Date of Referral:</strong></td>
        <td style="padding:6px 0;border-bottom:1px solid #777;">${e(refDate)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Referred To (Agency/Office):</strong></td>
        <td style="padding:6px 0;border-bottom:1px solid #777;"><strong>${e(referral.referral_agency)}</strong></td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Client / Victim-Survivor:</strong></td>
        <td style="padding:6px 0;border-bottom:1px solid #777;">${e(survivorName)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Respondent / Alleged Offender:</strong></td>
        <td style="padding:6px 0;border-bottom:1px solid #777;">${e(respondentName)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Reason for Referral:</strong></td>
        <td style="padding:6px 0;border-bottom:1px solid #777;">${e(referral.referral_reason === "Other" ? referral.reason_other || "Other" : referral.referral_reason ?? referral.services_requested ?? "—")}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Referral Status:</strong></td>
        <td style="padding:6px 0;border-bottom:1px solid #777;">${e(referral.referral_status)}</td>
      </tr>
    </table>

    <div style="margin-top:15px;border:1px solid #aaa;border-radius:6px;padding:12px;background:#fafafa;">
      <p style="margin:0 0 6px;font-weight:bold;font-size:10pt;text-transform:uppercase;">Actions Taken / Initial Case Notes:</p>
      <p style="margin:0;font-size:10pt;line-height:1.5;white-space:pre-wrap;">${e(referral.notes || "Client was received at the Barangay VAW Desk and assessed under RA 9262 protocols. Referral is issued for appropriate protective, medical, legal, and/or psychosocial services.")}</p>
    </div>

    <table style="width:100%;margin-top:40px;font-size:10.5pt;">
      <tr>
        <td style="width:50%;text-align:left;">
          <p style="margin:0 0 35px;">Referred by:</p>
          <p style="margin:0;font-weight:bold;text-decoration:underline;">${e(referral.referrer?.name || "VAW Desk Officer")}</p>
          <p style="margin:0;font-size:9.5pt;color:#444;">Barangay VAW Desk Officer</p>
        </td>
        <td style="width:50%;text-align:left;">
          <p style="margin:0 0 35px;">Noted by:</p>
          <p style="margin:0;font-weight:bold;text-decoration:underline;">HON. RAFAEL P. VIDAL</p>
          <p style="margin:0;font-size:9.5pt;color:#444;">Punong Barangay, Barangay Natumolan</p>
        </td>
      </tr>
    </table>
  `;

  return formDocument({
    title: `VAWC Referral — ${caseData.case_code}`,
    page: "8.5in 11in",
    margin: "0.6in",
    css: "",
    body,
  });
}

export function bpoFormHtml(caseData: VawcCase, order: VawcProtectionOrder): string {
  const survivorName = caseData.survivor ? personName(caseData.survivor) : "Victim-Survivor";
  const respondentName = caseData.respondent ? personName(caseData.respondent) : "Respondent";
  const respondentAddress = caseData.respondent?.address || caseData.respondent?.zone_purok || "Barangay Natumolan, Tagoloan";
  const issuedDate = order.issued_on ? upperDate(order.issued_on) : upperDate(new Date().toISOString());
  const expiresDate = order.expires_on ? upperDate(order.expires_on) : "FIFTEEN (15) DAYS FROM ISSUANCE";

  const body = `
    <table class="head" style="width:100%;margin-bottom:15px;border-bottom:2px solid #000;padding-bottom:10px;">
      <tr>
        <td style="width:80px;text-align:center;"><img style="width:75px;height:75px;object-fit:contain;" src="${seals.barangay()}" alt="" /></td>
        <td style="text-align:center;font-family:'Times New Roman',serif;">
          <p style="margin:0;font-size:11pt;">Republic of the Philippines</p>
          <p style="margin:0;font-size:11pt;">Province of Misamis Oriental</p>
          <p style="margin:0;font-size:11pt;">Municipality of Tagoloan</p>
          <p style="margin:2px 0 0;font-size:13pt;font-weight:bold;letter-spacing:1px;">BARANGAY NATUMOLAN</p>
          <p style="margin:2px 0 0;font-size:11pt;font-weight:bold;">OFFICE OF THE PUNONG BARANGAY</p>
        </td>
        <td style="width:80px;text-align:center;"><img style="width:75px;height:75px;object-fit:contain;" src="${seals.tagoloan()}" alt="" /></td>
      </tr>
    </table>

    <div style="text-align:center;margin:15px 0 20px;">
      <h2 style="margin:0;font-size:16pt;text-decoration:underline;text-transform:uppercase;letter-spacing:1px;">BARANGAY PROTECTION ORDER (BPO)</h2>
      <p style="margin:4px 0 0;font-size:10pt;">Pursuant to Republic Act No. 9262 (Anti-Violence Against Women and Their Children Act of 2004)</p>
      <p style="margin:2px 0 0;font-size:10pt;font-weight:bold;">Case Code: ${e(caseData.case_code)}${order.bpo_number ? ` · BPO No. ${e(order.bpo_number)}` : ""}</p>
    </div>

    <table style="width:100%;font-size:10.5pt;margin-bottom:15px;line-height:1.6;">
      <tr>
        <td style="width:50%;vertical-align:top;">
          <p style="margin:0;"><strong>${e(survivorName)}</strong></p>
          <p style="margin:0;color:#555;font-size:9.5pt;">Applicant / Victim-Survivor</p>
          <p style="margin:10px 0 0;">- versus -</p>
          <p style="margin:10px 0 0;"><strong>${e(respondentName)}</strong></p>
          <p style="margin:0;color:#555;font-size:9.5pt;">Respondent (Address: ${e(respondentAddress)})</p>
        </td>
        <td style="width:50%;vertical-align:top;text-align:right;">
          <p style="margin:0;"><strong>Order Status:</strong> ${e(order.status)}</p>
          <p style="margin:0;"><strong>Date Issued:</strong> ${e(issuedDate)}</p>
          <p style="margin:0;"><strong>Effective Until:</strong> ${e(expiresDate)}</p>
        </td>
      </tr>
    </table>

    <div style="font-size:10.5pt;line-height:1.6;margin-top:15px;text-align:justify;">
      <p style="margin:0 0 10px;text-indent:2em;">
        WHEREAS, on application filed by the applicant, and after careful evaluation of the verified statements and circumstances of the case, reasonable grounds exist to believe that an imminent danger of violence against the victim-survivor and/or her children exists:
      </p>
      <p style="margin:0 0 10px;text-indent:2em;">
        NOW, THEREFORE, the Respondent <strong>${e(respondentName)}</strong> is hereby <strong>STRICTLY PROHIBITED AND ORDERED TO CEASE AND DESIST</strong> from committing the following acts:
      </p>
      <ol style="margin:5px 0 15px 25px;padding:0;">
        <li style="margin-bottom:6px;">Committing, threatening to commit, or attempting to commit personally or through another any act of physical, sexual, psychological, or economic violence against the applicant and her children;</li>
        <li style="margin-bottom:6px;">Harassing, intimidating, annoying, telephoning, contacting, or otherwise communicating with the applicant, directly or indirectly;</li>
        <li style="margin-bottom:6px;">Staying away and maintaining a distance of at least five hundred (500) meters from the applicant, her residence, school, place of employment, or frequent places.</li>
      </ol>
      ${order.notes ? `<p style="margin:0 0 10px;background:#f5f5f5;padding:8px;border-left:3px solid #333;"><strong>Specific Directives:</strong> ${e(order.notes)}</p>` : ""}
      <p style="margin:0 0 10px;text-indent:2em;font-weight:bold;color:#900;">
        WARNING: VIOLATION OF THIS BARANGAY PROTECTION ORDER IS A CRIMINAL OFFENSE PUNISHABLE BY IMPRISONMENT OF THIRTY (30) DAYS WITHOUT PREJUDICE TO OTHER CRIMINAL CHARGES UNDER RA 9262.
      </p>
    </div>

    <table style="width:100%;margin-top:35px;font-size:10.5pt;">
      <tr>
        <td style="width:50%;text-align:left;">
          <p style="margin:0 0 35px;">Issued by:</p>
          <p style="margin:0;font-weight:bold;text-decoration:underline;">${e(order.issued_by_name || "HON. RAFAEL P. VIDAL")}</p>
          <p style="margin:0;font-size:9.5pt;color:#444;">${e(order.issued_by || "Punong Barangay")}</p>
        </td>
        <td style="width:50%;text-align:left;">
          <p style="margin:0 0 35px;">Attested by:</p>
          <p style="margin:0;font-weight:bold;text-decoration:underline;">BARANGAY VAW DESK OFFICER</p>
          <p style="margin:0;font-size:9.5pt;color:#444;">Barangay Natumolan</p>
        </td>
      </tr>
    </table>
  `;

  return formDocument({
    title: `Barangay Protection Order — ${caseData.case_code}`,
    page: "8.5in 11in",
    margin: "0.6in",
    css: "",
    body,
  });
}

export function printReferral(caseData: VawcCase, referral: VawcReferral): void {
  const html = referralFormHtml(caseData, referral);
  const win = window.open("", "_blank");
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 400);
  }
}

export function printBpo(caseData: VawcCase, order: VawcProtectionOrder): void {
  const html = bpoFormHtml(caseData, order);
  const win = window.open("", "_blank");
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 400);
  }
}

