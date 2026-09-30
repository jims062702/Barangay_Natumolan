/**
 * Reading a Barangay Resident ID's QR from a picture of it — a phone photo of
 * the printed card, a scan, or the PNG downloaded from My Profile.
 *
 * Read here, in the browser, from the picture itself (never from its file
 * name); the code it yields is then checked by the server against the
 * register (ResidentCards::verify). A photo is tried at a few sizes, because
 * a QR a few centimetres across in a 12-megapixel photo is found more
 * readily at one size than another.
 */
import jsQR from "jsqr";

/** Crockford's base-32, as the server issues it. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** The card's code from whatever was read or typed — a link, "7K3M-Q9TD-X2PA", lower case — or null. */
export function cardCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const fromLink = raw.match(/\/id\/([A-Za-z0-9-]+)/);
  const code = (fromLink ? fromLink[1] : raw)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/U/g, "V");

  return code.length === 12 && [...code].every((ch) => ALPHABET.includes(ch)) ? code : null;
}

async function bitmapOf(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

/** The text of the first QR found in the picture, or null. */
export async function readQrFromImage(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;

  const img = await bitmapOf(file);
  const width = "naturalWidth" in img ? img.naturalWidth : img.width;
  const height = "naturalHeight" in img ? img.naturalHeight : img.height;
  if (!width || !height) return null;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const longest = Math.max(width, height);
  const targets = [1400, 900, 2200, longest].filter((t, i, all) => t <= longest && all.indexOf(t) === i);
  if (targets.length === 0) targets.push(longest);

  for (const target of targets) {
    const scale = Math.min(1, target / longest);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const found = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" });
    if (found?.data) return found.data;
  }

  return null;
}
