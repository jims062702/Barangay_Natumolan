import type { Certificate } from "../../../shared/types";
import { cachedOnly } from "../../../shared/offline/referenceCache";
import { pendingFor } from "../../../shared/offline/writeQueue";
import { cachedResident } from "../../../shared/offline/residentCache";
import type { Period } from "../../../shared/ui/PeriodFilter";

/**
 * The certificate report, counted on the device when there is no line.
 *
 * It is NOT the barangay's report and does not pretend to be: the device
 * holds this counter's recent certificates and whatever was filed here with
 * no line, not the whole register. What it answers is the question a clerk
 * actually asks at that moment — "did the one I just filed get counted?" —
 * which a page of zeros answered wrongly, and a page saying only "needs a
 * connection" did not answer at all.
 *
 * The windows are worked out the way the server works them out, in Manila
 * time and from the day the certificate was ASKED for, so the same
 * certificate falls in the same week whichever side counts it.
 */

/** The report shape the page renders, whoever counted it. */
export interface CertificateReport {
  as_of: string;
  counts: Record<string, number>;
  period: string | null;
  period_from: string;
  period_to: string;
  window: { key: string; label: string; from: string; to: string };
  years: number[];
  by_type: { certificate_type: string; total: number }[];
  by_status: Record<string, number>;
  by_resident: {
    resident_id: number;
    name: string;
    resident_number: string | null;
    total: number;
  }[];
}

/** A date as Manila reads it: 2026-09-16, whatever the device's own clock says. */
function manilaDay(value: string | number | Date): string {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function addDays(day: string, days: number): string {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The same five windows the server defines, plus a named month or year. */
function windowFor(period: Period, today: string): { key: string; label: string; from: string; to: string } {
  const [year, month] = today.split("-").map(Number);
  const monthEnd = (y: number, m: number) => (m === 12 ? `${y}-12-31` : addDays(`${y}-${String(m + 1).padStart(2, "0")}-01`, -1));

  if (period.month) {
    const y = Number(period.year) || year;
    const m = Number(period.month);

    return {
      key: `${y}-${m}`,
      label: `${MONTH_NAMES[m - 1]} ${y}`,
      from: `${y}-${String(m).padStart(2, "0")}-01`,
      to: monthEnd(y, m),
    };
  }

  if (period.year) {
    const y = Number(period.year);

    return { key: String(y), label: String(y), from: `${y}-01-01`, to: `${y}-12-31` };
  }

  switch (period.period) {
    case "today":
      return { key: "today", label: "Today", from: today, to: today };
    case "week": {
      /* Monday to Sunday, like the server's week. */
      const weekday = new Date(today + "T00:00:00Z").getUTCDay(); // 0 = Sunday
      const monday = addDays(today, weekday === 0 ? -6 : 1 - weekday);

      return { key: "week", label: "This week", from: monday, to: addDays(monday, 6) };
    }
    case "half_year": {
      const firstHalf = month <= 6;

      return {
        key: "half_year",
        label: firstHalf ? `January–June ${year}` : `July–December ${year}`,
        from: firstHalf ? `${year}-01-01` : `${year}-07-01`,
        to: firstHalf ? `${year}-06-30` : `${year}-12-31`,
      };
    }
    case "year":
      return { key: "year", label: String(year), from: `${year}-01-01`, to: `${year}-12-31` };
    case "month":
      return {
        key: "month",
        label: `${MONTH_NAMES[month - 1]} ${year}`,
        from: `${year}-${String(month).padStart(2, "0")}-01`,
        to: monthEnd(year, month),
      };
    default:
      return { key: "", label: "All time", from: "0000-01-01", to: "9999-12-31" };
  }
}

/**
 * Every certificate this device holds: the counter's last page from the
 * server, and anything filed here that has not been sent yet.
 */
export async function heldCertificates(): Promise<Certificate[]> {
  const cached = (await cachedOnly<Certificate[]>("certificates-page1")) ?? [];
  const jobs = await pendingFor("/certificates");

  const queued = await Promise.all(jobs.map(async (job, index) => {
    const body = job.body as {
      resident_id: number;
      certificate_type: string;
      fee_amount?: number;
      offline_status?: string;
      certificate_number?: string;
    };
    const resident = await cachedResident(body.resident_id);

    return {
      id: -(index + 1),
      certificate_number: body.certificate_number ?? "—",
      certificate_type: body.certificate_type,
      status: body.offline_status ?? "Processing",
      created_at: new Date(job.createdAt).toISOString(),
      resident_id: body.resident_id,
      resident: resident
        ? {
          id: resident.id,
          resident_number: resident.resident_number,
          first_name: resident.first_name,
          last_name: resident.last_name,
          full_name: [resident.first_name, resident.middle_name, resident.last_name, resident.suffix]
            .filter(Boolean).join(" "),
        }
        : null,
    } as unknown as Certificate;
  }));

  /* A job that has been sent is on both lists; the server's copy wins. */
  const numbers = new Set(cached.map((c) => c.certificate_number));

  return [...queued.filter((c) => !numbers.has(c.certificate_number)), ...cached];
}

/** The five window counts, and the breakdown for the one that was picked. */
export function buildOfflineReport(rows: Certificate[], period: Period): CertificateReport {
  const today = manilaDay(new Date());
  const day = (c: Certificate) => manilaDay(c.created_at ?? new Date());
  const within = (w: { from: string; to: string }) =>
    rows.filter((c) => day(c) >= w.from && day(c) <= w.to);

  const counts: Record<string, number> = {};
  for (const key of ["today", "week", "month", "half_year", "year"]) {
    counts[key] = within(windowFor({ period: key, month: "", year: "" }, today)).length;
  }

  const chosen = windowFor(period, today);
  const inWindow = within(chosen);

  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byResident = new Map<number, { name: string; resident_number: string | null; total: number }>();

  for (const c of inWindow) {
    byType[c.certificate_type] = (byType[c.certificate_type] ?? 0) + 1;
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;

    if (c.resident_id) {
      const held = byResident.get(c.resident_id) ?? {
        name: c.resident?.full_name
          ?? ([c.resident?.first_name, c.resident?.last_name].filter(Boolean).join(" ") || "—"),
        resident_number: c.resident?.resident_number ?? null,
        total: 0,
      };
      held.total += 1;
      byResident.set(c.resident_id, held);
    }
  }

  return {
    as_of: new Date().toISOString(),
    counts,
    period: ["today", "week", "month", "half_year", "year"].includes(chosen.key) ? chosen.key : null,
    period_from: chosen.from,
    period_to: chosen.to,
    window: chosen,
    /* Only the years the device can actually show something for. */
    years: [...new Set(rows.map((c) => Number(day(c).slice(0, 4))))].sort((a, b) => b - a),
    by_type: Object.entries(byType)
      .map(([certificate_type, total]) => ({ certificate_type, total }))
      .sort((a, b) => b.total - a.total),
    by_status: byStatus,
    by_resident: [...byResident.entries()]
      .map(([resident_id, held]) => ({ resident_id, ...held }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20),
  };
}
