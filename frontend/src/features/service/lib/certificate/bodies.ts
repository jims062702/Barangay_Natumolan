/**
 * The words of each certificate, as the barangay's own forms put them.
 */

import { fullName, filled, givenThis, birthdateLine, escapeHtml, longDate } from "./format";
import type { PrintableCertificate } from "./types";

export function certificateBody(
  certificate: PrintableCertificate,
  on: Date,
): { title: string; html: string; titleStyle?: "script" | "spaced" } {
  const f = certificate.template_fields ?? {};
  const r = certificate.resident;
  const name = fullName(certificate);
  /*
   * The zone as the paper's own "Zone ____" blank takes it: the register
   * names zones "Zone 1", "Zone 18A", and printed whole into that blank the
   * certificate read "Zone Zone 1". So only the number and letter go in.
   */
  const zone = (r?.zone_purok ?? "").replace(/^\s*zone\s*/i, "");
  const place = "Natumolan, Tagoloan, Misamis Oriental";

  /* Years lived here. RBIM Q35 already asked, so the form does not. */
  const years = f.years_of_residence || r?.length_of_residence_years || "";

  switch (certificate.certificate_type) {
    case "Barangay Clearance":
      return {
        title: "BARANGAY CLEARANCE",
        html: `
          <p>This is to certify that ${filled(name, "330px")} of legal age
          and a bonafide resident of Zone ${filled(zone, "120px")} ${place}
          and as per record in this office shows that he/she has no criminal
          record filed against him/her nor pending case.</p>

          <p>This Clearance is issued upon the request of the above
          named-person for ${filled(certificate.purpose, "300px")}.</p>

          <p>${givenThis("Issued", on)} at Barangay ${place}.</p>`,
      };

    case "Barangay Clearance with Picture":
      return {
        title: "BARANGAY CLEARANCE",
        html: `
          <p class="center"><b>This is to certify that the person whose name,
          picture and signature appear hereon has requested a CLEARANCE from
          this office.</b></p>

          <table class="particulars">
            <tr>
              <td><b>NAME:</b> ${filled(name, "200px")}</td>
              <td><b>GENDER:</b> ${filled(r?.gender, "110px")}</td>
            </tr>
            <tr>
              <td><b>ADDRESS:</b> ${filled(r?.address || (r?.zone_purok ? `${r.zone_purok}, Natumolan` : ""), "200px")}</td>
              <td><b>BIRTHDATE:</b> ${filled(birthdateLine(r), "130px")}</td>
            </tr>
            <tr>
              <td><b>CIVIL STATUS:</b> ${filled(r?.civil_status, "110px")}</td>
              <td><b>PLACE OF BIRTH:</b> ${filled(r?.birth_place, "170px")}</td>
            </tr>
          </table>

          ${/*
            The photograph goes in the large box; the two thumbmark boxes are
            printed empty on purpose. A thumbmark is inked onto the paper at
            the counter, and a system that pretended to capture one would be
            claiming something it had not done.
          */ ""}
          <div class="marks">
            <div class="photo">${
              certificate.photo_url
                ? `<img src="${escapeHtml(certificate.photo_url)}" alt="" />`
                : ""
            }</div>
            <div class="thumbs">
              <div><div class="thumb"></div><span>LEFT</span></div>
              <div><div class="thumb"></div><span>RIGHT</span></div>
              <div class="sigbox"><div class="sigline"></div><span>SIGNATURE</span></div>
            </div>
          </div>

          <p>This is to certify further as per record in this office shows
          that he/she has no criminal record filed against him/her nor
          pending case.</p>

          <p>This CLEARANCE is issued upon the request of the above
          named-person for the purpose ${filled(certificate.purpose, "260px")}.</p>

          <p>${givenThis("Issued", on)} at Barangay ${place}.</p>`,
      };

    case "Business Barangay Clearance":
      /*
       * Composed here, not transcribed — the office did not supply a
       * business clearance template, but the ordinance prices thirty kinds
       * of business, so they plainly issue one. Written to the same pattern
       * as the personal clearance. Worth replacing with their own wording.
       */
      return {
        title: "BUSINESS BARANGAY CLEARANCE",
        html: `
          <p>This is to certify that the business known as
          ${filled(f.business_name, "300px")}, a
          ${filled(f.business_kind, "230px")}, owned and operated by
          ${filled(name, "280px")} of Zone ${filled(zone, "110px")} ${place},
          has no derogatory record filed against it in this office.</p>

          <p>This Clearance is issued upon the request of the above
          named-person for ${filled(certificate.purpose, "280px")}.</p>

          <p>${givenThis("Issued", on)} at Barangay ${place}.</p>`,
      };

    case "Certificate of Residency":
      return {
        title: "CERTIFICATE OF RESIDENCY",
        titleStyle: "script",
        html: `
          <p>THIS IS TO CERTIFY THAT ${filled(name, "330px")} of legal age
          and a resident of <b>Zone</b> ${filled(zone, "130px")} ${place}.</p>

          <p>This is to certify further that the above named-person resides
          at the said place for ${filled(years, "80px")} years.</p>

          <p>This certification is being issued upon the request of
          <b>the above name person</b> for ${filled(certificate.purpose, "290px")}.</p>

          <p>${givenThis("Given", on)} at ${place}.</p>`,
      };

    case "Certificate of Residency with Birth Details":
      return {
        title: "CERTIFICATE OF RESIDENCY",
        titleStyle: "script",
        html: `
          <p>THIS IS TO CERTIFY THAT ${filled(name, "320px")} a resident of
          <b>Zone</b> ${filled(zone, "130px")} ${place}.</p>

          <table class="details">
            <tr><td>Date of Birth</td><td>:</td><td>${filled(birthdateLine(r), "260px")}</td></tr>
            <tr><td>Place of Birth</td><td>:</td><td>${filled(r?.birth_place, "260px")}</td></tr>
            <tr><td>Father&rsquo;s Name</td><td>:</td><td>${filled(f.father_name, "260px")}</td></tr>
            <tr><td>Mother&rsquo;s Name</td><td>:</td><td>${filled(f.mother_name, "260px")}</td></tr>
          </table>

          <p>This is to certify further that the above named-person resides
          at the said place for ${filled(years, "80px")} years.</p>

          <p>This certification is being issued upon the request of
          <b>the above name person</b> for ${filled(certificate.purpose, "290px")}.</p>

          <p>${givenThis("Given", on)} at ${place}.</p>`,
      };

    case "Certificate of Indigency":
      return {
        title: "CERTIFICATE OF INDIGENCY",
        titleStyle: "script",
        html: `
          <p>THIS IS TO CERTIFY THAT ${filled(name, "320px")} of legal age
          and bonafide resident of <b>Zone</b> ${filled(zone, "130px")} ${place}.</p>

          <p>This is to certify further that the above named-person is an
          indigent client in our barangay.</p>

          <p>This certification is being issued upon the request of the above
          name person seeking for ${filled(certificate.purpose, "280px")}.</p>

          <p>${givenThis("Given", on)} at ${place}.</p>`,
      };

    case "Certification of Death":
      return {
        title: "C E R T I F I C A T I O N",
        titleStyle: "spaced",
        html: `
          <p>THIS IS TO CERTIFY that the late ${filled(f.deceased_name, "290px")},
          ${filled(f.deceased_age, "50px")} years old and a resident of
          ${filled(f.deceased_address, "300px")}, died on
          ${filled(longDate(f.date_of_death) || f.date_of_death, "180px")} at
          ${filled(f.time_of_death, "180px")} at
          ${filled(f.place_of_death, "300px")}.</p>

          ${/*
            The relationship is asked for. The paper template says "upon the
            request of HER SON ____" in fixed type, so a father whose
            daughter came in was certified as having a son.
          */ ""}
          <p>This certification is being issued upon the request of
          ${filled(f.relationship_to_deceased, "150px")}
          ${filled(f.requested_by, "280px")} for DEATH CERTIFICATE.</p>

          <p>${givenThis("Given", on)} at ${place}.</p>`,
      };

    case "Certificate of Appearance":
      return {
        title: "CERTIFICATE OF APPEARANCE",
        html: `
          <p>THIS IS TO CERTIFY that subject person whose name is indicated
          below appeared in this Office:</p>

          <table class="details flush">
            <tr><td>Name</td><td>:</td><td>${filled(name, "320px")}</td></tr>
            <tr><td>Position</td><td>:</td><td>${filled(f.position, "320px")}</td></tr>
            <tr><td>Station</td><td>:</td><td>${filled(f.station, "320px")}</td></tr>
            <tr><td>Date/s Appeared</td><td>:</td><td>${filled(f.dates_appeared, "320px")}</td></tr>
            <tr><td>Purpose</td><td>:</td><td>${filled(certificate.purpose, "320px")}</td></tr>
          </table>

          <p>${givenThis("Issued", on)}.</p>`,
      };

    case "Certification of Common Law Partner":
      return {
        title: "C E R T I F I C A T I O N",
        titleStyle: "spaced",
        html: `
          <p>THIS IS TO CERTIFY THAT ${filled(name, "320px")} of legal age,
          and a bonafide resident of ${filled(zone, "120px")} ${place}.</p>

          <p>This is to certify further that the above named-person is the
          common law partner of ${filled(f.partner_name, "270px")} for almost
          ${filled(f.years_together, "90px")} years.</p>

          <p>This certification is being issued upon the request of the above
          named-person seeking for ${filled(certificate.purpose, "250px")}.</p>

          <p>${givenThis("Given", on)} at ${place}.</p>`,
      };

    case "Certification of Oneness of Name":
      return {
        title: "C E R T I F I C A T I O N",
        titleStyle: "spaced",
        html: `
          ${/*
            "In addition" — the paper template reads "The correct spelling is
            ____addition, they are one and the same person", which is not a
            sentence. Two words, and the only edit made to their wording
            anywhere in this file that was not a blank they had left out.
          */ ""}
          <p>The beneficiary&rsquo;s name on the payroll is
          ${filled(f.name_on_payroll, "290px")} which is incorrect. The
          correct spelling is ${filled(f.correct_name, "290px")}. In addition,
          they are one and the same person.</p>

          <p>This certification is being issued upon the request of the above
          named-person for ${filled(certificate.purpose, "230px")}.</p>

          <p>${givenThis("Given", on)} at ${place}.</p>`,
      };

    case "Certification for Marriage License": {
      /*
       * The attachments paragraph appears only when there IS a late spouse.
       * The paper template stated one unconditionally, naming a church
       * certificate and a barangay certificate from Aguining, Bohol — facts
       * belonging to one widow, printed for whoever came next.
       */
      const attachments = f.late_spouse_name || f.attached_documents
        ? `<p>Attached hereto are ${filled(f.attached_documents, "300px")},
           pertaining to the death of his/her late spouse
           ${filled(f.late_spouse_name, "250px")}.</p>`
        : "";

      return {
        title: "C E R T I F I C A T I O N",
        titleStyle: "spaced",
        html: `
          <p>THIS IS TO CERTIFY THAT ${filled(name, "300px")} of legal age,
          ${filled(f.civil_status_stated || r?.civil_status, "150px")} and a
          resident of ${filled(zone, "120px")} ${place}.</p>

          <p>This certification is being issued upon the request of the
          above-named person for his/her Marriage License application.</p>

          ${attachments}

          <p>${givenThis("Given", on)} at ${place}.</p>`,
      };
    }

    case "Barangay Construction Clearance":
      return {
        title: "C E R T I F I C A T I O N",
        titleStyle: "spaced",
        html: `
          <p><b>BARANGAY CONSTRUCTION CLEARANCE</b> is hereby granted to
          ${filled(f.applicant_name || name, "290px")} of Barangay ${place}
          after having verified and evaluated that the structure/covered by
          them application for
          ${/*
            A field. The paper template is titled for construction and then
            clears only ELECTRICAL INSTALLATION in fixed type, so a fence or
            an extension was certified as an electrical job.
          */ ""}
          <b>${filled(f.work_applied_for, "240px")}</b> is/are cleared from
          the following:</p>

          <ol class="clauses">
            <li>The structure is not affected by the road Development Plan of
            the Municipal Government authorization;</li>
            <li>The structure will not cause flooding;</li>
            <li>Structure will not block off the passageway of interior
            resident&rsquo;s outward to the existing road;</li>
            <li>That the structure and the activities to be performed within
            will not cause air or water pollution.</li>
          </ol>

          <p>This certification is being issued upon the request of the
          above-named company for whatever purpose it may serve best.</p>

          <p>${givenThis("Done", on)} at ${place}.</p>`,
      };

    case "First-Time Jobseeker":
      /*
       * Composed, like the business clearance — no template was supplied.
       * Free under RA 11261, which the document says out loud because that
       * is the law the applicant is claiming.
       */
      return {
        title: "FIRST-TIME JOBSEEKER CERTIFICATION",
        html: `
          <p>THIS IS TO CERTIFY THAT ${filled(name, "320px")} of legal age
          and a bonafide resident of <b>Zone</b> ${filled(zone, "130px")}
          ${place}, is a <b>first-time jobseeker</b> under Republic Act No.
          11261, the First Time Jobseekers Assistance Act.</p>

          <p>This certification is being issued upon the request of the above
          named-person for ${filled(certificate.purpose, "280px")}, and is
          <b>issued free of charge</b>. It is valid for one (1) year from the
          date below and may be availed of only once.</p>

          <p>${givenThis("Given", on)} at ${place}.</p>`,
      };

    case "Good Moral Character":
      /*
       * Composed, like the business clearance and the jobseeker form — the
       * office supplied no template for it, but the system already offered
       * it and residents can already ask for one, so it needed a body
       * rather than the blank line the generic case would have printed.
       */
      return {
        title: "CERTIFICATE OF GOOD MORAL CHARACTER",
        html: `
          <p>THIS IS TO CERTIFY THAT ${filled(name, "320px")} of legal age
          and a bonafide resident of <b>Zone</b> ${filled(zone, "130px")} ${place}.</p>

          <p>This is to certify further that the above named-person is of
          good moral character and standing in this community, and as per
          record in this office has no derogatory record filed against
          him/her nor pending case.</p>

          <p>This certification is being issued upon the request of the above
          named-person for ${filled(certificate.purpose, "280px")}.</p>

          <p>${givenThis("Given", on)} at ${place}.</p>`,
      };

    case "Certificate of Low or No Income":
      return {
        title: "CERTIFICATE OF LOW OR NO INCOME",
        html: `
          <p>THIS IS TO CERTIFY THAT ${filled(name, "320px")} of legal age
          and a bonafide resident of <b>Zone</b> ${filled(zone, "130px")} ${place}.</p>

          <p>This is to certify further that the above named-person has
          little or no regular source of income, as verified by this office.</p>

          <p>This certification is being issued upon the request of the above
          named-person for ${filled(certificate.purpose, "280px")}.</p>

          <p>${givenThis("Given", on)} at ${place}.</p>`,
      };

    default:
      /*
       * A type with no template of its own. "Other Certification" was the
       * last, and is no longer issued; one printed before it went still
       * opens here, as a plain certification with nothing invented in it.
       */
      return {
        title: "C E R T I F I C A T I O N",
        titleStyle: "spaced",
        html: `
          <p>THIS IS TO CERTIFY THAT ${filled(name, "320px")} of legal age
          and a bonafide resident of <b>Zone</b> ${filled(zone, "130px")} ${place}.</p>

          <p>This certification is being issued upon the request of the above
          named-person for ${filled(certificate.purpose, "280px")}.</p>

          <p>${givenThis("Given", on)} at ${place}.</p>`,
      };
  }
}
