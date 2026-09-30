/**
 * THE BARANGAY RESIDENT ID, DRAWN.
 *
 * One drawing for every use of it — what the resident sees on My Profile,
 * the PNG they download, the sheet the Population Office prints — so the
 * card on the screen, the file and the paper are the same card.
 *
 * A CR80 card (85.6 × 54 mm) at 10 units to the millimetre, drawn at three
 * times that for print. Everything on it comes from the register (see
 * ResidentCards::cardData on the server); nothing is typed here.
 *
 * The QR holds a link to this system's own check page with the card's
 * twelve-character code — not a name, not a birthday, not an address. The
 * code is printed under it too, for when a photo is too blurred to scan.
 */
import QRCode from "qrcode";
import sealUrl from "../../assets/logo/barangay-seal.jpg";
import bagongUrl from "../../assets/logo/bagong-pilipinas.png";
import tagoloanUrl from "../../assets/logo/tagoloan-seal.png";

export interface ResidentCardData {
  resident_id?: number;
  /** The card's own reference — RID-<resident no.>-<which card>. Not a secret. */
  card_no?: string | null;
  resident_number: string;
  last_name: string;
  first_name: string;
  middle_initial: string;
  sex: string | null;
  /** As the RBIM census recorded it (Q7); null when no census holds it. */
  nationality?: string | null;
  zone_purok: string | null;
  address: string;
  contact_number: string | null;
  /** "7K3M-Q9TD-X2PA" — the card's verification code. */
  code: string;
  status: string;
  issued_via: string;
  issued_at: string | null;
  /** The Punong Barangay's name, from the officials roster — printed, never a signature image. */
  punong_barangay?: string | null;
}

export const CARD_W = 856;
export const CARD_H = 540;
/** Drawn at this multiple of the card's own units: ~760 dpi on the card. */
export const SCALE = 3;

/** What the QR opens: this system's own check page, with the code. */
export const verifyLink = (code: string) => `${window.location.origin}/id/${code.replace(/-/g, "")}`;

const C = {
  purple: "#723ec3",
  deep: "#3a1d6e",
  ink: "#1b1530",
  label: "#6d5d93",
  muted: "#5d5378",
  gold: "#d9a82b",
  blue: "#1f4aa8",
  lavLine: "#ddd0f3",
};
const FONT = '"Poppins", "Segoe UI", Arial, sans-serif';
const MONO = 'Consolas, "Courier New", monospace';

type Ctx = CanvasRenderingContext2D;

const images = new Map<string, Promise<HTMLImageElement>>();
function image(src: string): Promise<HTMLImageElement> {
  if (!images.has(src)) {
    images.set(src, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image"));
      img.src = src;
    }));
  }

  return images.get(src)!;
}

/* Poppins is the system's face; wait for it, so the card is not drawn in a fallback. */
async function fontsReady() {
  try {
    await document.fonts.ready;
    await Promise.all(["400", "500", "600", "700", "800"].map((w) => document.fonts.load(`${w} 20px Poppins`)));
  } catch {
    /* Drawn in the fallback face — still a readable card. */
  }
}

function rounded(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const font = (weight: number | string, size: number, family = FONT) => `${weight} ${size}px ${family}`;

/** Letter-spaced text — drawn a character at a time, so it works in every browser. */
function spaced(ctx: Ctx, text: string, x: number, y: number, spacing: number, align: "left" | "center" | "right" = "left") {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, widths.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const saved = ctx.textAlign;
  ctx.textAlign = "left";
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = saved;

  return total;
}

/** The biggest size, down to `min`, at which the text fits the width. */
function fit(ctx: Ctx, text: string, weight: number, size: number, maxWidth: number, min: number, family = FONT) {
  let s = size;
  ctx.font = font(weight, s, family);
  while (s > min && ctx.measureText(text).width > maxWidth) {
    s -= 0.5;
    ctx.font = font(weight, s, family);
  }

  return s;
}

/**
 * Words onto lines no wider than maxWidth — and a single word too long for
 * a line (a long house-and-lot run with no spaces) broken by letter, so no
 * line is ever wider than its box.
 */
function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const push = (word: string) => {
    if (ctx.measureText(word).width <= maxWidth) return word;
    let piece = "";
    for (const ch of word) {
      if (ctx.measureText(piece + ch).width > maxWidth && piece) {
        lines.push(piece);
        piece = ch;
      } else piece += ch;
    }

    return piece;
  };
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = push(word);
    }
  }
  if (line) lines.push(line);

  return lines;
}

/**
 * One line of text that NEVER leaves its box: the biggest size down to
 * `min` at which it fits, and past that squeezed sideways to the width —
 * readable, whole, and inside the card, however long the name.
 */
function fitted(ctx: Ctx, text: string, x: number, y: number, maxWidth: number, weight: number, size: number, min: number, family = FONT) {
  const s = fit(ctx, text, weight, size, maxWidth, min, family);
  const w = ctx.measureText(text).width;
  if (w <= maxWidth) {
    ctx.fillText(text, x, y);
  } else {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(maxWidth / w, 1);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  return s;
}

/**
 * A block of wrapped text inside a box of maxWidth × maxHeight: the biggest
 * size, down to `min`, at which every line fits both ways. Measured on the
 * canvas at draw time, in the face actually loaded — so the file, the
 * screen and the print, all drawn from the one canvas, lay it out alike.
 */
function fitBlock(ctx: Ctx, text: string, weight: number, size: number, maxWidth: number, maxHeight: number, min: number) {
  for (let s = size; s >= min; s -= 0.5) {
    ctx.font = font(weight, s);
    const lines = wrap(ctx, text, maxWidth);
    const lineHeight = Math.round(s * 1.28 * 10) / 10;
    if (lines.length * lineHeight <= maxHeight || s - 0.5 < min) return { size: s, lines, lineHeight };
  }
  ctx.font = font(weight, min);

  return { size: min, lines: wrap(ctx, text, maxWidth), lineHeight: min * 1.28 };
}

/** Fine interlaced waves — the security-print texture of an ID. */
function guilloche(ctx: Ctx) {
  const draw = (count: number, amp: number, freq: number, y0: number, gap: number, color: string, alpha: number) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 0.85;
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      for (let x = 0; x <= CARD_W; x += 6) {
        const y = y0 + i * gap
          + amp * Math.sin((x / CARD_W) * Math.PI * 2 * freq + i * 0.42)
          + amp * 0.45 * Math.sin((x / CARD_W) * Math.PI * 2 * (freq * 2.3) - i * 0.2);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  };
  draw(26, 16, 2.2, 150, 13, C.purple, 0.1);
  draw(18, 10, 3.4, 190, 17, C.blue, 0.06);
  draw(8, 6, 1.4, 20, 15, C.gold, 0.12);
}

/** The QR, module by module, on whole device pixels so no seam shows between them. */
function drawQr(ctx: Ctx, text: string, cx: number, cy: number, maxSize: number) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = Math.floor((maxSize * SCALE) / n) / SCALE;
  const size = cell * n;
  const x0 = cx - size / 2;
  const y0 = cy - size / 2;
  ctx.fillStyle = C.ink;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) ctx.fillRect(x0 + c * cell, y0 + r * cell, cell, cell);
    }
  }
}

/**
 * THE card's header — the same on both sides, so the back reads as the back
 * of this card and not as another document: the seal, the Republic and the
 * municipality, BARANGAY NATUMOLAN, and Bagong Pilipinas and Tagoloan on the
 * right, at the same size and in the same place front and back.
 */
export const HEADER_H = 150;

function header(ctx: Ctx, seal: HTMLImageElement, logos: HTMLImageElement[]) {
  const h = HEADER_H;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#fbf8ff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, h);

  /* The seal as it is — its white ground melts into the header's. */
  const sw = 124;
  const sh = (sw * seal.height) / seal.width;
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(seal, 26, (h - sh) / 2, sw, sh);
  ctx.restore();

  const x = 26 + sw + 18;
  ctx.textBaseline = "top";
  ctx.fillStyle = C.label;
  ctx.font = font(600, 12.5);
  spaced(ctx, "REPUBLIC OF THE PHILIPPINES", x, 22, 2.5);
  ctx.fillStyle = C.muted;
  ctx.font = font(500, 13);
  ctx.fillText("Municipality of Tagoloan · Province of Misamis Oriental", x, 42);
  ctx.fillStyle = C.deep;
  ctx.font = font(800, 34);
  ctx.fillText("BARANGAY NATUMOLAN", x, 61);
  const docY = 107;
  ctx.fillStyle = C.gold;
  ctx.fillRect(x, docY + 6, 26, 3);
  ctx.fillStyle = C.purple;
  ctx.font = font(700, 13.5);
  spaced(ctx, "RESIDENT IDENTIFICATION CARD", x + 36, docY, 3);

  /* Bagong Pilipinas and Tagoloan, right. */
  let rx = CARD_W - 30;
  for (const [img, w] of logos.map((l, i) => [l, i === logos.length - 1 ? 70 : 84] as const).reverse()) {
    const ih = (w * img.height) / img.width;
    rx -= w;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(img, rx, (h - ih) / 2, w, ih);
    ctx.restore();
    rx -= 12;
  }

  /* purple, gold, blue */
  const band = ctx.createLinearGradient(0, 0, CARD_W, 0);
  band.addColorStop(0, C.deep);
  band.addColorStop(0.6, C.purple);
  band.addColorStop(1, "#8c5fd6");
  ctx.fillStyle = band;
  ctx.fillRect(0, h, CARD_W, 6);
  ctx.fillStyle = C.gold;
  ctx.fillRect(0, h + 6, CARD_W, 2);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = C.blue;
  ctx.fillRect(0, h + 8, CARD_W, 2);
  ctx.globalAlpha = 1;
}

function footer(ctx: Ctx, left: string, leftSoft: string, right: string) {
  const y = CARD_H - 50;
  const g = ctx.createLinearGradient(0, 0, CARD_W, 0);
  g.addColorStop(0, C.deep);
  g.addColorStop(1, C.purple);
  ctx.fillStyle = g;
  ctx.fillRect(0, y, CARD_W, 50);
  ctx.fillStyle = C.gold;
  ctx.fillRect(0, y, CARD_W, 2);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.font = font(700, 13);
  const w = spaced(ctx, left, 30, y + 26, 1.6);
  ctx.font = font(500, 13);
  ctx.globalAlpha = 0.85;
  ctx.fillText(leftSoft, 30 + w + 10, y + 26);
  ctx.globalAlpha = 1;
  ctx.font = font(700, 12);
  spaced(ctx, right, CARD_W - 30, y + 26, 1.2, "right");
  ctx.textBaseline = "top";
}

function label(ctx: Ctx, text: string, x: number, y: number) {
  ctx.fillStyle = C.label;
  ctx.font = font(600, 11.5);
  spaced(ctx, text, x, y, 1.8);
}

const issuedOn = (iso: string | null) => (iso
  ? new Date(iso).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }).toUpperCase()
  : "");

function surface(): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W * SCALE;
  canvas.height = CARD_H * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  rounded(ctx, 0, 0, CARD_W, CARD_H, 32);
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  guilloche(ctx);

  return { canvas, ctx };
}

function drawFront(d: ResidentCardData, seal: HTMLImageElement, bagong: HTMLImageElement, tagoloan: HTMLImageElement) {
  const { canvas, ctx } = surface();

  /* The seal, faint, behind the details. */
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(seal, 303, 170, 330, (330 * seal.height) / seal.width);
  ctx.restore();

  header(ctx, seal, [bagong, tagoloan]);

  /* ---- the photo ---- */
  const px = 32;
  const py = 182;
  ctx.save();
  rounded(ctx, px - 5, py - 5, 210, 260, 18);
  ctx.fillStyle = C.lavLine;
  ctx.fill();
  rounded(ctx, px - 3, py - 3, 206, 256, 16);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  rounded(ctx, px, py, 200, 250, 14);
  ctx.clip();
  const pg = ctx.createLinearGradient(0, py, 0, py + 250);
  pg.addColorStop(0, "#efe8fb");
  pg.addColorStop(1, "#e2d6f6");
  ctx.fillStyle = pg;
  ctx.fillRect(px, py, 200, 250);
  ctx.fillStyle = "#b9a6e0";
  ctx.beginPath();
  ctx.arc(px + 100, py + 104, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(px + 22, py + 250);
  ctx.bezierCurveTo(px + 26, py + 196, px + 60, py + 164, px + 100, py + 164);
  ctx.bezierCurveTo(px + 140, py + 164, px + 174, py + 196, px + 178, py + 250);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8a7bb0";
  ctx.font = font(600, 11);
  ctx.textBaseline = "top";
  spaced(ctx, "PHOTO", px + 100, py + 14, 2, "center");
  ctx.restore();

  label(ctx, "RESIDENT NUMBER", 32, 444);
  ctx.fillStyle = C.deep;
  fitted(ctx, d.resident_number, 32, 461, 200, 700, 19, 13, MONO);

  /* ---- the details — every one inside its own box, however long ---- */
  const fx = 260;
  const fw = 360;
  label(ctx, "LAST NAME", fx, 182);
  ctx.fillStyle = C.ink;
  fitted(ctx, d.last_name, fx, 197, fw, 800, 36, 20);

  label(ctx, "FIRST NAME", fx, 246);
  ctx.fillStyle = C.ink;
  fitted(ctx, d.first_name, fx, 261, 250, 700, 25, 15);
  label(ctx, "M.I.", fx + 264, 246);
  ctx.fillStyle = C.ink;
  fitted(ctx, d.middle_initial || "—", fx + 264, 261, fw - 264, 700, 25, 15);

  label(ctx, "SEX", fx, 302);
  label(ctx, "NATIONALITY", fx + 100, 302);
  label(ctx, "ZONE / PUROK", fx + 245, 302);
  ctx.fillStyle = C.ink;
  fitted(ctx, d.sex || "—", fx, 318, 92, 600, 19, 12);
  fitted(ctx, d.nationality || "—", fx + 100, 318, 137, 600, 19, 12);
  fitted(ctx, (d.zone_purok || "—").toUpperCase(), fx + 245, 318, fw - 245, 600, 19, 12);

  /*
   * THE ADDRESS, whatever its length: wrapped onto as many lines as it
   * needs, the font brought down until they all sit inside the box, and the
   * contact number placed under wherever the address ends — never across
   * it, never past the footer.
   */
  label(ctx, "COMPLETE ADDRESS", fx, 353);
  ctx.fillStyle = C.ink;
  const addressTop = 369;
  const addressRoom = 486 - 20 - 16 - 8 - addressTop;
  const block = fitBlock(ctx, d.address, 500, 16.5, fw, addressRoom, 8);
  block.lines.forEach((line, i) => ctx.fillText(line, fx, addressTop + i * block.lineHeight));
  const contactY = Math.max(424, addressTop + block.lines.length * block.lineHeight + 8);

  label(ctx, "CONTACT NUMBER", fx, contactY);
  ctx.fillStyle = C.ink;
  fitted(ctx, d.contact_number || "—", fx, contactY + 16, fw, 600, 17.5, 11, MONO);

  /* ---- the QR ---- */
  const qx = CARD_W - 32 - 176;
  const qy = 184;
  ctx.save();
  ctx.shadowColor = "rgba(58, 29, 110, .25)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  rounded(ctx, qx, qy, 176, 176, 16);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
  rounded(ctx, qx, qy, 176, 176, 16);
  ctx.strokeStyle = C.lavLine;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(qx - 4, qy + 18); ctx.lineTo(qx - 4, qy + 2); ctx.arcTo(qx - 4, qy - 4, qx + 2, qy - 4, 6); ctx.lineTo(qx + 18, qy - 4);
  ctx.moveTo(qx + 176 + 4, qy + 176 - 18); ctx.lineTo(qx + 176 + 4, qy + 176 - 2); ctx.arcTo(qx + 176 + 4, qy + 176 + 4, qx + 176 - 2, qy + 176 + 4, 6); ctx.lineTo(qx + 176 - 18, qy + 176 + 4);
  ctx.stroke();
  drawQr(ctx, verifyLink(d.code), qx + 88, qy + 88, 140);

  ctx.textBaseline = "top";
  ctx.fillStyle = C.deep;
  ctx.font = font(800, 15);
  spaced(ctx, "SCAN TO VERIFY", qx + 88, qy + 188, 2, "center");
  ctx.fillStyle = C.ink;
  ctx.font = font(700, 15, MONO);
  ctx.textAlign = "center";
  ctx.fillText(d.code, qx + 88, qy + 212);
  ctx.fillStyle = "#6f6782";
  ctx.font = font(400, 10.5);
  ctx.fillText("Barangay resident ID verification", qx + 88, qy + 235);
  ctx.textAlign = "left";

  footer(ctx, "FOR BARANGAY PURPOSES ONLY", "See disclaimer on the reverse", d.issued_at ? `ISSUED ${issuedOn(d.issued_at)}` : "");

  return canvas;
}

const DISCLAIMER = "This card is intended solely for identification and legitimate transactions within Barangay "
  + "Natumolan. It is not a substitute for a national or government-issued identification card and does not "
  + "establish citizenship, legal status, or identity outside authorized barangay transactions. Unauthorized "
  + "reproduction, alteration, misuse, or transfer of this card is prohibited. For verification, scan the QR "
  + "code or contact the Barangay Office.";

function drawBack(d: ResidentCardData, seal: HTMLImageElement, bagong: HTMLImageElement, tagoloan: HTMLImageElement) {
  const { canvas, ctx } = surface();
  /* The front's header, exactly — both logos, same size, same place. */
  header(ctx, seal, [bagong, tagoloan]);

  /* ---- the disclaimer ---- */
  const top = HEADER_H + 26;
  const bx = 34;
  const by = top;
  const bw = 584;
  const lh = 20;
  ctx.font = font(400, 14);
  const lines = wrap(ctx, DISCLAIMER, bw - 43);
  const bh = 14 + 24 + lines.length * lh + 12;
  rounded(ctx, bx, by, bw, bh, 14);
  ctx.fillStyle = "rgba(255,255,255,.88)";
  ctx.fill();
  ctx.strokeStyle = C.lavLine;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.save();
  rounded(ctx, bx, by, bw, bh, 14);
  ctx.clip();
  ctx.fillStyle = C.purple;
  ctx.fillRect(bx, by, 5, bh);
  ctx.restore();
  ctx.textBaseline = "top";
  ctx.fillStyle = C.deep;
  ctx.font = font(800, 15.5);
  ctx.fillText("DISCLAIMER: FOR BARANGAY PURPOSES ONLY.", bx + 23, by + 14);
  ctx.fillStyle = "#2a2340";
  ctx.font = font(400, 14);
  lines.forEach((line, i) => ctx.fillText(line, bx + 23, by + 38 + i * lh));

  /* ---- signatures, and where to return it ----
     The Punong Barangay's NAME above their line, from the officials roster —
     never a signature image. */
  const sy = Math.max(by + bh + 58, 424);
  ctx.strokeStyle = C.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bx, sy); ctx.lineTo(bx + 279, sy);
  ctx.moveTo(bx + 305, sy); ctx.lineTo(bx + bw, sy);
  ctx.stroke();
  const pb = String(d.punong_barangay ?? "").replace(/^\s*hon\.?\s+/i, "").trim().toUpperCase();
  if (pb) {
    ctx.fillStyle = C.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    fitted(ctx, pb, bx + 305 + (bw - 305) / 2, sy - 6, bw - 305, 700, 15, 10);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }
  label(ctx, "RESIDENT'S SIGNATURE", bx, sy + 6);
  label(ctx, "PUNONG BARANGAY", bx + 305, sy + 6);
  ctx.fillStyle = C.muted;
  ctx.font = font(400, 12);
  ctx.fillText("If found, please return to the Barangay Hall, Barangay Natumolan, Tagoloan, Misamis Oriental.", bx, sy + 30);

  /* ---- how to check it ---- */
  const rx = CARD_W - 32 - 176;
  ctx.fillStyle = C.deep;
  ctx.font = font(800, 14);
  spaced(ctx, "VERIFY THIS ID", rx, top + 4, 1.8);
  ctx.fillStyle = C.muted;
  ctx.font = font(400, 12);
  wrap(ctx, "Scan the QR code on the front, or give this code to the Barangay Office:", 176)
    .forEach((line, i) => ctx.fillText(line, rx, top + 26 + i * 17));
  ctx.fillStyle = C.ink;
  fit(ctx, d.code, 700, 18, 176, 12, MONO);
  ctx.fillText(d.code, rx, top + 84);
  label(ctx, "RESIDENT NUMBER", rx, top + 120);
  ctx.fillStyle = C.deep;
  fitted(ctx, d.resident_number, rx, top + 136, 176, 700, 17, 12, MONO);
  if (d.card_no) {
    label(ctx, "CARD NUMBER", rx, top + 166);
    ctx.fillStyle = C.deep;
    fitted(ctx, d.card_no, rx, top + 182, 176, 700, 14, 10, MONO);
  }

  footer(ctx, "BARANGAY NATUMOLAN", "Tagoloan, Misamis Oriental", "VALID UNTIL REPLACED");

  return canvas;
}

/** Both sides of the card, drawn. */
export async function drawResidentCard(d: ResidentCardData): Promise<{ front: HTMLCanvasElement; back: HTMLCanvasElement }> {
  await fontsReady();
  const [seal, bagong, tagoloan] = await Promise.all([image(sealUrl), image(bagongUrl), image(tagoloanUrl)]);

  return { front: drawFront(d, seal, bagong, tagoloan), back: drawBack(d, seal, bagong, tagoloan) };
}

/** Front above back, on one PNG — the file a resident downloads and may upload later. */
export function cardSheet(front: HTMLCanvasElement, back: HTMLCanvasElement): Promise<Blob> {
  const gap = 40 * SCALE;
  const pad = 24 * SCALE;
  const sheet = document.createElement("canvas");
  sheet.width = front.width + pad * 2;
  sheet.height = front.height + back.height + gap + pad * 2;
  const ctx = sheet.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.drawImage(front, pad, pad);
  ctx.drawImage(back, pad, pad + front.height + gap);

  return new Promise((resolve, reject) => sheet.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
}
