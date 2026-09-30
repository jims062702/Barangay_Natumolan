/**
 * The three prescribed KP forms this barangay still issues, as paper.
 *
 * Every Print button in the KP forms list used to call window.print(), which
 * prints the dashboard: the office pressed "Print the summons", the parties
 * were told a hearing had been called, and nothing came out of the printer
 * that anybody could hand them. These are the documents that press is for.
 *
 * The wording is the Katarungang Pambarangay handbook's — the forms are
 * national and the same in every barangay — over this barangay's own
 * letterhead. Long bond, portrait, one sheet each.
 */

import {
  escapeHtml as e,
  formDocument,
  manilaToday,
  seals,
  upperDate,
  withHon,
  withoutHon,
} from "../../../shared/print/formKit";
import type { KpFormPayload, LuponHearing } from "../types";
import type { Resident } from "../../../shared/types/resident";

export interface KpNames {
  punong_barangay: string;
  secretary: string;
}

/** "2026-09-29T09:00:00" → "29th day of September, 2026". */
function ordinalDay(ymd: string): string {
  const d = Number(ymd.slice(8, 10));
  if (!d) return "____";
  /* 11th, 12th and 13th break the rule that the last digit decides. */
  const suffix = d % 100 >= 11 && d % 100 <= 13
    ? "th"
    : ({ 1: "st", 2: "nd", 3: "rd" }[d % 10] ?? "th");
  return `${d}${suffix}`;
}

const monthYear = (ymd: string) => {
  const [y, m] = ymd.slice(0, 10).split("-").map(Number);
  if (!y || !m) return "____";
  return `${new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long" })}, ${y}`;
};

/** "09:00:00" → "9:00 o'clock in the morning" — the form says it in words. */
function clockInWords(iso: string): string {
  const hh = Number(iso.slice(11, 13));
  const mm = iso.slice(14, 16) || "00";
  if (Number.isNaN(hh)) return "____ o'clock";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  /* The handbook's own phrasing: forenoon and afternoon, not AM and PM. */
  const half = hh < 12 ? "in the forenoon" : "in the afternoon";
  return `${h12}:${mm} o'clock ${half}`;
}

/*
 * THE PAPER NAMES THE DAY AND THE HOUR TO COME, AND NOTHING MORE.
 *
 * It briefly carried "the sitting is set down until 11:15" as well. That
 * reads as a deadline, and it is not one: the ninety minutes are how the
 * office lays out a Tuesday, not a limit on a mediation. A summons that
 * printed an end time would be telling a respondent, over the Punong
 * Barangay's signature, that their hearing stops at a certain hour — and
 * a party who left at 11:15 because the paper said so would have walked
 * out of their own case.
 *
 * The office reads the expected end on the CALENDAR, where it is an aid to
 * laying out the day rather than a promise made to a party.
 */


/**
 * Where to find a party.
 *
 * A summons that cannot be served is not a summons, so the address is read
 * from wherever the register holds it: a non-resident carries their own, a
 * resident's is their household's.
 */
function addressOf(person?: Resident | null, fallback?: string | null): string {
  const own = person?.address?.trim();
  if (own) return own;

  const house = person?.household;
  const parts = [house?.street_address, house?.zone_purok ?? person?.zone_purok]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean);

  if (parts.length) return `${parts.join(", ")}, Barangay Natumolan, Tagoloan, Misamis Oriental`;

  return String(fallback ?? "").trim();
}

const nameOf = (r: Resident) =>
  r.full_name || [r.first_name, r.middle_name, r.last_name, r.suffix].filter(Boolean).join(" ");

/** The barangay's letterhead, the same on all three. */
const letterhead = (title: string) => `
  <div class="head">
    <img class="seal" src="${seals.barangay()}" alt="" />
    <img class="seal right" src="${seals.tagoloan()}" alt="" />
    <p>Republic of the Philippines</p>
    <p>Province of Misamis Oriental</p>
    <p>Municipality of Tagoloan</p>
    <p>BARANGAY <b>NATUMOLAN</b></p>
    <p class="office b">OFFICE OF THE LUPONG TAGAPAMAYAPA</p>
  </div>
  <p class="formno">KP Form No. ${e(title)}</p>`;

/** Complainant, respondents, case number and what it is about. */
function caption(p: KpFormPayload): string {
  const c = p.case;
  const respondents = (c.respondents ?? []).map(nameOf).join("<br/>")
    || e(c.respondent_display_names ?? "");

  return `
  <table class="caption">
    <tr>
      <td class="party">
        <span class="b">${e(c.complainant_display_name ?? "")}</span><br/>
        <span class="role">Complainant/s</span>
        <p class="vs">- against -</p>
        <span class="b">${respondents}</span><br/>
        <span class="role">Respondent/s</span>
      </td>
      <td class="ref">
        Barangay Case No. <span class="u b">${e(c.case_number)}</span><br/>
        For: <span class="u">${e(c.case_classification)}</span>
      </td>
    </tr>
  </table>
  <p class="rule">x - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - x</p>`;
}

/** The signature block, and the Secretary who keeps the record. */
function signature(names: KpNames, dated: string): string {
  return `
  <p class="dated">This ${ordinalDay(dated)} day of ${monthYear(dated)}, at Barangay Natumolan, Tagoloan, Misamis Oriental.</p>
  <table class="signs">
    <tr>
      <td class="w50"></td>
      <td class="w50 c">
        <span class="sig">${e(withHon(names.punong_barangay))}</span><br/>
        <span class="role">Punong Barangay/Lupon Chairman</span>
      </td>
    </tr>
  </table>
  <table class="signs">
    <tr>
      <td class="w50">
        Attested by:<br/><br/>
        <span class="sig">${e(withoutHon(names.secretary))}</span><br/>
        <span class="role">Lupon Secretary</span>
      </td>
      <td class="w50"></td>
    </tr>
  </table>`;
}

const SHEET_CSS = `
  body { font-family: "Times New Roman", Times, serif; font-size: 12pt; }
  .head { position: relative; text-align: center; min-height: 92px; }
  .head p { margin: 0; line-height: 1.35; }
  .head .seal { position: absolute; left: 6%; top: 0; width: 84px; height: auto; }
  .head .seal.right { left: auto; right: 6%; }
  .head .office { margin-top: 8px; letter-spacing: .5px; }
  .formno { margin: 2px 0 10px; font-size: 10pt; }
  .caption { width: 100%; margin-top: 6px; }
  .caption td { vertical-align: top; padding: 0 4px; }
  .caption .party { width: 58%; }
  .caption .ref { width: 42%; padding-left: 18px; }
  .caption .role { font-size: 10.5pt; font-style: italic; }
  .caption .vs { margin: 8px 0 8px 40px; }
  .rule { margin: 4px 0 14px; letter-spacing: -1px; }
  .title { text-align: center; font-weight: 700; font-size: 14pt; letter-spacing: 1.5px; margin: 6px 0 16px; }
  .to { margin: 0 0 12px; }
  .to .addr { margin: 0 0 0 34px; }
  p.body { margin: 0 0 12px; text-align: justify; text-indent: 40px; line-height: 1.55; }
  .warn { margin: 0 0 12px; text-align: justify; text-indent: 40px; line-height: 1.55; }
  .terms { margin: 6px 0 14px; padding: 8px 10px; border: 1px solid #000; min-height: 96px; white-space: pre-wrap; line-height: 1.5; }
  .dated { margin: 18px 0 8px; }
  .signs { width: 100%; margin-top: 10px; }
  .signs td { vertical-align: top; padding: 2px 4px; }
  .w50 { width: 50%; }
  .sig { font-weight: 700; text-decoration: underline; }
  .role { font-size: 10.5pt; }
  .parties { width: 100%; margin-top: 26px; }
  .parties td { width: 50%; text-align: center; padding: 0 6px; }
  .parties .line { display: block; border-bottom: 1px solid #000; margin: 0 14px 3px; height: 1px; }
`;

/** One KP form: its title, and the sheet's body. */
type Paper = { title: string; body: string };

const paper = (title: string, body: string): Paper => ({ title, body });

/** One or more papers, printed as one job — each on its own legal-size page. */
const documentOf = (papers: Paper[]) =>
  papers.length
    ? formDocument({
      title: papers.map((x) => x.title).join(" · "),
      page: "8.5in 13in",
      margin: "0.7in",
      css: SHEET_CSS,
      body: papers.map((x) => x.body),
    })
    : "";

/**
 * The same two papers are issued twice in a case's life, and they must not
 * say the same thing both times: the first three sittings are the Punong
 * Barangay's mediation, the second three the Lupon's conciliation. A party
 * told to appear "before the Punong Barangay" on a day the Lupon is sitting
 * has been told the wrong room.
 */
const forum = (h: LuponHearing) =>
  h.hearing_type === "Conciliation"
    ? { act: "conciliation", office: "Office of the Lupong Tagapamayapa" }
    : { act: "mediation", office: "Office of the Punong Barangay" };

/**
 * KP-7 — the notice that calls the COMPLAINANT to the sitting.
 *
 * Two papers come out of one press and they are not interchangeable. The
 * complainant is notified of a hearing on a complaint they themselves
 * brought; the respondent is SUMMONED to answer one, under warning. This
 * notice used to be addressed to both, which handed the respondent a polite
 * note where the law expects a summons — and left the case open to the
 * answer that they were never properly called.
 */
function noticeOfHearing(p: KpFormPayload, h: LuponHearing, names: KpNames): Paper {
  const c = p.case;
  const where = forum(h);
  const parties = [
    { name: c.complainant_display_name ?? "", address: addressOf(c.complainant, c.complainant_display_address) },
  ];

  return paper(`Notice of Hearing — ${c.case_number}`, `
    ${letterhead("7")}
    ${caption(p)}
    <p class="title">NOTICE OF HEARING</p>

    <div class="to">
      <p>TO:</p>
      ${parties.map((x) => `<p class="addr"><span class="b">${e(x.name)}</span><br/>${e(x.address)}</p>`).join("")}
    </div>

    <p class="body">You are hereby notified to appear before me on the <span class="u b">${ordinalDay(h.scheduled_at)}</span> day of <span class="u b">${monthYear(h.scheduled_at)}</span>, at <span class="u b">${clockInWords(h.scheduled_at)}</span>, at the ${e(where.office)}, Barangay Natumolan, Tagoloan, Misamis Oriental, for the ${e(where.act)} of your dispute.</p>

    <p class="warn">You are further notified to appear IN PERSON, without the assistance of counsel or representative, except for minors and incompetents who may be assisted by their next of kin who are not lawyers.</p>

    <p class="warn">FAIL NOT under penalty of law.</p>

    ${signature(names, manilaToday())}
  `);
}

/** KP-9 — the summons proper: the paper a respondent is handed. */
function summons(p: KpFormPayload, h: LuponHearing, names: KpNames): Paper {
  const c = p.case;
  const where = forum(h);
  const respondents = (c.respondents ?? []).map((r) => ({ name: nameOf(r), address: addressOf(r) }));

  return paper(`Summons — ${c.case_number}`, `
    ${letterhead("9")}
    ${caption(p)}
    <p class="title">SUMMONS</p>

    <div class="to">
      <p>TO:</p>
      ${(respondents.length
        ? respondents
        : [{ name: c.respondent_display_names ?? "", address: "" }]
      ).map((x) => `<p class="addr"><span class="b">${e(x.name)}</span><br/>${e(x.address)}</p>`).join("")}
    </div>

    <p class="body">You are hereby summoned to appear before me in person, together with your witnesses, on the <span class="u b">${ordinalDay(h.scheduled_at)}</span> day of <span class="u b">${monthYear(h.scheduled_at)}</span>, at <span class="u b">${clockInWords(h.scheduled_at)}</span>, at the ${e(where.office)}, Barangay Natumolan, Tagoloan, Misamis Oriental, then and there to answer to a complaint made before me, a copy of which is attached hereto, for ${e(where.act)} of your dispute with the complainant.</p>

    <p class="warn">You are hereby warned that if you refuse or wilfully fail to appear in obedience to this summons, you may be barred from filing any counterclaim arising from the said complaint.</p>

    <p class="warn">FAIL NOT or else face punishment as for indirect contempt of court.</p>

    ${signature(names, manilaToday())}
  `);
}

/** KP-16 — what the parties agreed to, in their own words, signed. */
function amicableSettlement(p: KpFormPayload, names: KpNames): Paper {
  const c = p.case;
  const settlement = c.settlement;
  const agreed = settlement?.date_agreed ?? manilaToday();
  const respondents = (c.respondents ?? []).map(nameOf);

  const side = (label: string, people: string[]) => `
    <td>
      ${(people.length ? people : [""]).map((n) => `
        <span class="sig">${e(n)}</span><span class="line"></span>`).join("")}
      <span class="role">${e(label)}</span>
    </td>`;

  return paper(`Amicable Settlement — ${c.case_number}`, `
    ${letterhead("16")}
    ${caption(p)}
    <p class="title">AMICABLE SETTLEMENT</p>

    <p class="body">We, the complainant/s and the respondent/s in the above-captioned case, do hereby agree to settle our dispute as follows:</p>

    <div class="terms">${e(settlement?.terms ?? "")}</div>

    <p class="body">and bind ourselves to comply honestly and faithfully with the above terms of settlement.</p>

    <p class="dated">Entered into this ${ordinalDay(agreed)} day of ${monthYear(agreed)}, at Barangay Natumolan, Tagoloan, Misamis Oriental.</p>

    <table class="parties">
      <tr>
        ${side("Complainant/s", [c.complainant_display_name ?? ""])}
        ${side("Respondent/s", respondents)}
      </tr>
    </table>

    <p class="dated">ATTESTED TO BEFORE ME this ${ordinalDay(agreed)} day of ${monthYear(agreed)}.</p>
    <table class="signs">
      <tr>
        <td class="w50"></td>
        <td class="w50 c">
          <span class="sig">${e(withHon(names.punong_barangay))}</span><br/>
          <span class="role">Punong Barangay/Lupon Chairman</span>
        </td>
      </tr>
    </table>

    <p class="body">This settlement shall have the force and effect of a final judgment of a court upon the expiration of ten (10) days from the date hereof, unless repudiated or a petition to nullify the award has been filed before the proper city or municipal court.</p>

    ${settlement?.repudiation_deadline
      ? `<p class="dated">Repudiation period ends on <span class="u b">${e(upperDate(settlement.repudiation_deadline))}</span>.</p>`
      : ""}
  `);
}

/**
 * The document for a form code, or "" when this case cannot produce it.
 *
 * The caller already knows which forms are available — the server says so —
 * but a form drawn from facts that are not there would print blanks where a
 * date belongs, and a blank date on a summons is a hearing nobody has to
 * attend.
 */
export function kpFormHtml(
  code: string,
  payload: KpFormPayload | null,
  names: KpNames,
  /*
   * The sitting the office is printing for.
   *
   * A case can hold several sittings, and the server sends the earliest
   * still scheduled. The summons has to name the one whose row was
   * pressed, or the paper calls the parties to a different day.
   */
  forHearing?: LuponHearing | null,
): string {
  const one = kpPaper(code, payload, names, forHearing);

  return one ? documentOf([one]) : "";
}

/**
 * Several KP forms as ONE print job, in the order given — the notice of
 * hearing for the complainant and the summons for the respondent come out
 * of one press, each on its own page.
 */
export function kpFormsHtml(
  codes: string[],
  payload: KpFormPayload | null,
  names: KpNames,
  forHearing?: LuponHearing | null,
): string {
  return documentOf(codes.map((code) => kpPaper(code, payload, names, forHearing)).filter((x): x is Paper => x !== null));
}

function kpPaper(code: string, payload: KpFormPayload | null, names: KpNames, forHearing?: LuponHearing | null): Paper | null {
  if (!payload) return null;

  const hearing = forHearing?.status === "Scheduled" ? forHearing : payload.next_hearing;

  if (code === "KP-7") return hearing ? noticeOfHearing(payload, hearing, names) : null;
  if (code === "KP-9") return hearing ? summons(payload, hearing, names) : null;
  if (code === "KP-16") return payload.case.settlement ? amicableSettlement(payload, names) : null;

  return null;
}
