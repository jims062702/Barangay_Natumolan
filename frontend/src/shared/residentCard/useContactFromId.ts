import { useEffect, useRef } from "react";
import type { ResidentIdValue } from "./ResidentIdCheck";

/**
 * THE CONTACT NUMBER ON THE RECORD, FILLED IN ONCE A RESIDENT ID CHECKS OUT
 * (2026-09-30) — and theirs to change.
 *
 * A number changes more often than anybody tells the Population Office, so
 * the box is filled, never locked: somebody whose record still has the old
 * number types the new one over it.
 *
 * Only a box that is empty, or still holds what this filled in, is filled —
 * and emptied again when the card goes or turns out to be refused. A number
 * somebody typed is never replaced.
 *
 * @param normalise  how the box holds a number ("+63…" for PhoneInput), so a
 *                   filled-in number is recognised as the one filled in
 * @returns whether what the box holds now is the number from the record
 */
export function useContactFromId(
  id: ResidentIdValue,
  contact: string,
  setContact: (value: string) => void,
  normalise: (value: string) => string = (value) => value,
): boolean {
  const filled = useRef("");

  useEffect(() => {
    const fromRecord = id.status === "verified" && id.contactNumber ? normalise(id.contactNumber) : "";

    if (contact === "" || contact === filled.current) {
      filled.current = fromRecord;
      if (contact !== fromRecord) setContact(fromRecord);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id.status, id.contactNumber]);

  return filled.current !== "" && contact === filled.current;
}
