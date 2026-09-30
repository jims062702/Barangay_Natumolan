import { cardSheet, drawResidentCard, type ResidentCardData } from "./drawCard";

/** A file saved to the device, by the browser's own download. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const cardFileName = (card: Pick<ResidentCardData, "resident_number">) =>
  `Barangay-Resident-ID-${card.resident_number}.png`;

/**
 * The same Resident ID, from anywhere it is offered — My Profile, the
 * resident's record, a census form, a household. One drawing (drawCard), so
 * every download is the same card with the same data.
 */
export async function downloadResidentCard(card: ResidentCardData): Promise<void> {
  const { front, back } = await drawResidentCard(card);
  saveBlob(await cardSheet(front, back), cardFileName(card));
}
