/**
 * A photograph, shrunk and turned into text the offline queue can keep.
 *
 * WHY NOT KEEP THE FILE. The offline queue lives in IndexedDB and is replayed
 * later, possibly after the browser has been closed and reopened. A File the
 * clerk picked does not survive that — the browser forgets it — so what is
 * kept is the picture itself, encoded as a data URL.
 *
 * WHY SHRINK IT. A phone photo is several megabytes. Held as text it grows by
 * a third, and it has to sit in the queue, travel over the barangay's line,
 * and print in a box about three centimetres wide. Six hundred pixels on the
 * long side is far more than that box can show, and it brings a multi-megabyte
 * photo down to roughly a hundred kilobytes.
 *
 * The same data URL serves three purposes at once: it shows in the modal, it
 * prints on the certificate, and it is what gets sent to the server.
 */

const MAX_SIDE = 600;
const QUALITY = 0.82;

export async function imageToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file is not an image. Choose a photograph.");
  }

  const bitmap = await loadImage(file);

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("This browser could not prepare the photograph.");
  }

  /*
   * White underneath first. A PNG with a transparent background would
   * otherwise come out black once flattened to JPEG, and a black box is not
   * a photograph anyone can recognise the resident in.
   */
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", QUALITY);
}

/**
 * Compresses an image file (e.g. from camera or photo gallery) to a reasonable size
 * (e.g. max 1600px, 82% JPEG quality) before uploading to the server.
 * This turns 3MB-10MB phone photos into 150KB-300KB files, making upload 10-20x faster!
 */
export async function compressImageFile(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type.includes("svg")) {
    return file;
  }
  // If already small enough (under 250 KB), skip compression
  if (file.size <= 250 * 1024) {
    return file;
  }

  try {
    const bitmap = await loadImage(file);
    const maxDimension = Math.max(bitmap.width, bitmap.height);
    const scale = maxDimension > maxSide ? maxSide / maxDimension : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<File>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
          } else {
            const fileName = file.name.replace(/\.[^.]+$/, ".jpg");
            resolve(new File([blob], fileName, { type: "image/jpeg" }));
          }
        },
        "image/jpeg",
        quality,
      );
    });
  } catch {
    return file;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The photograph could not be opened. Try another."));
    };

    image.src = url;
  });
}
