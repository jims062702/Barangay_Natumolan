/**
 * THIS DEVICE, to the chatbot's guest limit.
 *
 * The server gives a device an ID with its first guest message (a random,
 * signed token — it names no one) and counts that device's ten a day
 * against it, so people sharing one Wi-Fi each have their own ten
 * (2026-09-29). It is kept here, in this browser, and sent with every
 * allowance request.
 *
 * Storage that cannot be read (a private window, blocked site data) simply
 * means no ID: the server treats the next message as a new device, and it
 * limits how many new devices one network may start in a day.
 */
const KEY = "chat-guest-device";

export function guestDevice(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function keepGuestDevice(token: unknown): void {
  if (typeof token !== "string" || token === "") return;
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* Not kept: the next message is a new device, within the network's allowance. */
  }
}

/** The header every allowance request carries. */
export const guestDeviceHeaders = () => {
  const token = guestDevice();

  return token ? { "X-Guest-Device": token } : {};
};
