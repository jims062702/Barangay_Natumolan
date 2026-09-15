/**
 * The paper each certificate prints on, and the page's styles.
 */

export const STYLE = `
  /*
    Black. All of it.
    
    Violet and red went in here on the strength of a low-resolution
    screenshot that looked coloured. Their Word files say otherwise —
    document.xml carries no colour runs at all — so the certificates were
    being printed in colours the barangay has never used. The seal is the
    only colour on the sheet, and the purple rule around the council panel,
    which is a table border and is genuinely there.
  */
  /*
    THE PAPER AND ITS MARGINS ARE THE OFFICE'S OWN — see PAPER below.

    Every certificate used to be laid out 182 mm wide inside 12-14 mm page
    margins, so that one layout would fit any paper. The Barangay Clearance
    could not: on the office's form its council panel runs the full height of
    an A4 sheet, 2 mm from the top edge. Squeezed into that box it was shrunk
    to about 70% — small type inside wide white borders, nothing like the
    paper the office hands out.

    The PAGE margin is zero and the template's margin is padding on .page
    instead. A browser prints the date, the title and "about:blank 1/1" in
    the page margin when "Headers and footers" is ticked; with no margin
    there is nowhere for them to go.
  */
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: "Times New Roman", Times, serif; color: #000; font-size: 12pt; }
  .page { overflow: hidden; margin: 0 auto; background: #fff;
          break-inside: avoid; page-break-inside: avoid; }
  /* On screen, the sheet on a grey desk — so the window that opens before
     the print dialog shows where the paper's edges are. */
  @media screen {
    body { background: #e5e7eb; }
    .page { margin: 16px auto; box-shadow: 0 1px 6px rgba(0, 0, 0, 0.25); }
  }
  .sheet { display: flex; gap: 14px; }
  /*
    Sized to the panel on their A4 form, which runs the height of the sheet:
    about 56 mm wide, the heading near 13 pt, the names and roles near 8.5.
    At the old sizes it filled barely two thirds of the height and left a
    tall empty box under the last name.
  */
  .council { width: 215px; border: 2px solid #5b21b6; padding: 8px 6px; text-align: center;
             font-size: 8.5pt; line-height: 1.3; flex: 0 0 215px; }
  .council h4 { font-size: 13pt; margin: 6px 0 12px; }
  .council h5 { font-size: 11pt; margin: 12px 0 8px; border-top: 1px solid #333;
                padding-top: 8px; }
  .member { margin-bottom: 13px; }
  .member b { display: block; font-size: 8.5pt; }
  .member span { display: block; }
  /* Smaller than the role, because it is two lines under half the names and
     the panel has to hold eleven people. */
  .member .cttee { font-size: 7.5pt; line-height: 1.25; }
  /* Same trap as the letterhead: the body's justify would win here too. */
  .council p, .council div { text-align: center; text-indent: 0; }
  .main { flex: 1; min-width: 0; }
  /* The appearance slip: two copies, each half the sheet, the cut between. */
  .main.slips { display: flex; flex-direction: column; }
  .slip { flex: 1 1 0; min-height: 0; }
  /*
    The heading is centred on the sheet and the seal is laid over the left
    margin, which is how the barangay's forms are set. Laying them out side
    by side instead centred the text in the LEFTOVER space and pushed the
    whole block right of the title beneath it.
  */
  .head { position: relative; min-height: 116px; margin-bottom: 6px;
          display: flex; flex-direction: column; justify-content: center; }
  /*
    height auto, not a square. The seal is a photograph a little wider than
    it is tall — the ribbon hangs below the disc — and forcing it square
    squashed the ribbon into an unreadable band.
  */
  .seal { position: absolute; left: 0; top: 0; width: 122px; height: auto; }
  /* Nearly the full width of the panel, which is how their sheet has it. */
  .council-seal { display: block; width: 180px; height: auto; margin: 0 auto 4px; }
  .headtext { text-align: center; }
  /* text-indent is set on p for the body paragraphs, which the barangay
     indents; the letterhead and the salutation are not body paragraphs and
     were being pushed off-centre by inheriting it. */
  /*
    text-align as well as text-indent.
    
    The body rule sets p to justify, which beats the centre inherited from
    .headtext because it is the more specific selector — and justify on a
    one-line paragraph renders flush LEFT. So the whole letterhead sat in the
    left margin under the seal while the title below it was properly centred,
    which is exactly the misalignment that was reported.
  */
  .headtext p { margin: 0; line-height: 1.35; font-size: 11pt;
                text-indent: 0; text-align: center; }
  .headtext .office { margin-top: 8px; font-size: 12pt; }
  /*
    Three title settings, because their folder has three: the clearance is
    plain bold; the residency and indigency certificates are set in a script
    face and underlined; the ones simply headed CERTIFICATION are letter-
    spaced and underlined. One setting for all of them made every form look
    like the clearance.
  */
  h1 { text-align: center; font-size: 20pt; margin: 18px 0 16px; letter-spacing: 1px; }
  h1.script { font-family: "Lucida Calligraphy", "Palatino Linotype", "Book Antiqua",
              Palatino, "Times New Roman", serif;
              font-style: italic; font-size: 19pt; letter-spacing: 0;
              text-decoration: underline; }
  h1.spaced { font-size: 17pt; letter-spacing: 3px; text-decoration: underline; }
  .concern { font-weight: bold; margin: 0 0 10px; text-indent: 0; }
  /*
    The clearance is set differently from the certifications: bold, ragged
    right rather than justified, and more open. Justified and light, it read
    as a different document from the one the office hands out.
  */
  .clearance-body p { font-weight: bold; text-align: left; line-height: 2.3;
                      margin-bottom: 16px; font-size: 12.5pt; }
  /* Their clearance title is the largest type on any of their forms. */
  .sheet.clearance h1 { font-size: 24pt; margin: 24px 0 22px; }
  .clearance-body p:first-child { text-indent: 0; }
  /* Half an inch, which is the indent on their paper. */
  p { line-height: 1.9; margin: 0 0 13px; text-align: justify; text-indent: 48px; }
  p.center { text-align: center; text-indent: 0; }
  .blank { display: inline-block; border-bottom: 1px solid #000; height: 1em;
           vertical-align: bottom; }
  .ans { text-decoration: none; border-bottom: 1px solid #000; font-weight: bold;
         padding: 0 6px; }
  table { border-collapse: collapse; margin: 0 0 12px 40px; }
  .details td { padding: 2px 6px 2px 0; vertical-align: bottom; }
  /* Indented on the residency form, flush left on the appearance slip —
     as each of the two is set on paper. */
  .details.flush { margin-left: 0; }
  .particulars { margin-left: 0; width: 100%; }
  .particulars td { padding: 3px 8px 3px 0; }
  .clauses { line-height: 1.8; margin: 0 0 12px 20px; }
  .clauses li { margin-bottom: 8px; text-align: justify; }
  .marks { display: flex; gap: 14px; align-items: flex-end; margin: 14px 0 18px; }
  .photo { width: 130px; height: 150px; border: 1px solid #000; overflow: hidden;
           display: flex; align-items: center; justify-content: center; }
  .photo img { width: 100%; height: 100%; object-fit: cover; }
  .thumbs { display: flex; gap: 14px; align-items: flex-end; }
  .thumbs > div { text-align: center; font-size: 9pt; font-weight: bold; }
  .thumb { width: 78px; height: 96px; border: 1px solid #2563eb; margin-bottom: 3px; }
  .sigbox { min-width: 120px; }
  .sigline { border-bottom: 1px solid #000; height: 96px; }
  /*
    Right of centre, not centred. On every one of their forms the signature
    block sits over toward the right margin; centring it left the page
    looking symmetrical in a way the barangay's paper is not.
  */
  .sign { margin-top: 52px; text-align: right; padding-right: 34px; }
  .sign .who { display: inline-block; text-align: center; }
  .sign .who b { display: block; text-decoration: underline; font-size: 12pt; }
  .officer { margin-top: 40px; text-align: center; }
  .officer .line { width: 260px; border-bottom: 1px solid #000; margin: 0 auto 3px;
                   min-height: 1.2em; font-weight: bold; text-transform: uppercase; }
  .verify { margin-top: 26px; font-size: 10pt; }
  .verify p { text-indent: 0; margin: 0 0 4px; text-align: left; }
  .verify .names { text-decoration: underline; font-weight: bold; }
  .ref { margin-top: 34px; font-size: 8pt; color: #444; border-top: 1px solid #bbb;
         padding-top: 6px; text-indent: 0; text-align: left; }
  .cut { border: 0; border-top: 1px dashed #999; margin: 8px 0; flex: 0 0 auto; }
  @media print { .cut { border-top: 1px dashed #999; } }
`;

/*
 * The paper each form is printed on, and its margins, in millimetres
 * (top, right, bottom, left).
 *
 * Measured from the PDFs of the office's own templates — the printed ink,
 * not a guess:
 *
 *   BARANGAY CLEARANCE          A4      0.08in top, 0.16 bottom, 0.21 left, 0.24 right
 *   CERTIFICATE OF RESIDENCY,
 *   INDIGENCY, death, marriage,
 *   common law, construction,
 *   oneness, birth residency    Letter  an inch at the top and right; the seal
 *                                       hangs into a narrower left margin
 *   CERTIFICATE OF APPEARANCE   Legal   0.62in top, 0.93 left, 1.06 right,
 *                                       two slips to the sheet
 *
 * The print dialog opens on this paper. If the office loads a different one
 * the browser scales the sheet to it, so it is still one page.
 */
export const PAPER: Record<string, {
  size: string;
  width: number;
  height: number;
  margin: [number, number, number, number];
}> = {
  council: { size: "A4", width: 210, height: 297, margin: [2, 6, 4, 5.3] },
  plain: { size: "letter", width: 215.9, height: 279.4, margin: [25.4, 25.4, 25.4, 19] },
  half: { size: "legal", width: 215.9, height: 355.6, margin: [15.7, 26.9, 15.7, 23.6] },
};
