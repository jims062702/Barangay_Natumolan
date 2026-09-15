/**
 * Default portal password: Lastname + MMYYYY — e.g. Gasang062002.
 *
 * A SECOND copy of User::defaultPortalPassword, which is why it is worth
 * saying out loud: the two must agree, and for a while they did not. It was
 * MMDDYY on both sides until the census stopped asking for a day — the
 * register fills that in itself, so a password built from it was built from a
 * number the resident had never seen.
 */
export function defaultPortalPassword(lastName: string, birthdate?: string | null): string {
  if (!birthdate) return "";

  const [y, m] = birthdate.slice(0, 10).split("-");

  if (!y || !m) return "";

  return `${lastName.replace(/[^A-Za-z0-9]/g, "")}${m}${y}`;
}
