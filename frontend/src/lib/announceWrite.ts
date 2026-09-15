import type { AxiosResponse } from "axios";
import { toast } from "./toast";

/**
 * Tells the office what actually happened to what they just saved.
 *
 * A form that opts into offline writes can get one of two answers back, and
 * they are not the same promise:
 *
 *   SAVED   the server has it. "Immunization record saved." is true.
 *   QUEUED  the device has it, and the server will when the line returns.
 *
 * Every page used to announce the first regardless. With the line down that
 * sentence became false — and a health worker who reads "saved" does not
 * go and check the Nakapila list, which is exactly the one place the record
 * is waiting.
 */
export function announceWrite(
  response: AxiosResponse | undefined,
  savedMessage: string,
): void {
  if (response?.data?.queued) {
    toast(response.data.message, "info");

    return;
  }

  toast(savedMessage);
}
