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
