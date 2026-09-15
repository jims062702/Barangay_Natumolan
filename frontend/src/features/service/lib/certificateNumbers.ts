import { meta, setMeta } from "../../../shared/offline/offlineDb";
import { cachedGet } from "../../../shared/offline/referenceCache";

/**
 * Certificate numbers this device can issue on its own.
 *
 * THE PROBLEM. A clerk with no line has to hand over a finished certificate,
 * and a certificate with no number on it is not a document the barangay can
 * issue. So the number has to be decided here, on the device, before the
 * server has ever heard of it.
 *
 * THE DANGER. The moment two devices decide independently from one shared
 * series, both pick the same next number, and two residents walk out holding
 * paper bearing the same one. Nothing afterwards can fix that — the
 * documents exist.
 *
 * THE ANSWER. Each office has a series of its own: `CERT-2026-01-` for Main
 * Office, `CERT-2026-02-` for Population, and so on. No two offices share a
 * series, so there is nothing to collide over — and unlike reserving a block
 * of numbers in advance, it does not run out, however long the line is down.
 *
 * This holds because this barangay runs ONE DEVICE PER OFFICE. A second
 * device in the same office would share its prefix and be back to the
 * collision above; that is the assumption to revisit first if it changes.
 */

const SERIES = "certificates.series";

interface Series {
  office: string | null;
  prefix: string;
  width: number;
  /** The next number this device believes is free. */
  next: number;
}

/**
 * Refreshes the series from the server, and keeps it.
 *
 * Called while the line is up. The server's `next` is authoritative: it has
 * seen every certificate this office has filed, including any this device
 * did not.
 */
export async function syncNumberSeries(): Promise<Series | null> {
  try {
    const fresh = await cachedGet<Series>("/certificates/number-series", "number-series");

    if (!fresh) {
      return null;
    }

    const held = await meta<Series | null>(SERIES, null);

    /*
     * The HIGHER of the two wins.
     *
     * The device may have spent numbers the server has not seen yet —
     * filed offline, still in the queue — and taking the server's lower
     * figure would hand the next resident a number already printed on
     * somebody else's certificate.
     */
    const next =
      held && held.prefix === fresh.prefix ? Math.max(held.next, fresh.next) : fresh.next;

    const series: Series = { ...fresh, next };

    await setMeta(SERIES, series);

    return series;
  } catch {
    /* No line. Whatever is held is what this device will use. */
    return meta<Series | null>(SERIES, null);
  }
}

/**
 * Takes the next number in this device's series and marks it spent.
 *
 * Returns null when the device has never been told its series — a machine
 * that has not been online since it was set up. The caller must not invent
 * one: a number outside any known series is worse than no number, because
 * it looks legitimate on paper and belongs to nothing.
 */
export async function mintLocalNumber(): Promise<string | null> {
  const series = await meta<Series | null>(SERIES, null);

  if (!series) {
    return null;
  }

  const number = series.prefix + String(series.next).padStart(series.width, "0");

  /*
   * Written back BEFORE the number is handed out. If the page is closed
   * between minting and filing, the number is spent and skipped — a gap in
   * the register, which is a thing the office can read and account for. The
   * alternative is handing the same number out twice, which is not.
   */
  await setMeta(SERIES, { ...series, next: series.next + 1 });

  return number;
}

/** What this device would issue next, without spending it. */
export async function peekNumberSeries(): Promise<Series | null> {
  return meta<Series | null>(SERIES, null);
}

/**
 * A verification reference, made on the device.
 *
 * It is printed under "Verification Ref." and is what a school or a bank
 * types in to confirm the certificate is genuine — so a certificate printed
 * with no line needs one there and then, and the same one has to reach the
 * register.
 *
 * Random rather than sequential. Unlike the certificate number it carries no
 * order and no office, so there is no series to share and nothing to collide
 * over: 64 bits of randomness makes two devices choosing the same one not a
 * thing that happens. The server still refuses it if it somehow is taken.
 */
export function mintReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));

  return "REF-" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
