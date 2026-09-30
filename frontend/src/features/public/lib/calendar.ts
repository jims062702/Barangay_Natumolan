/**
 * "Add to calendar" for a barangay event — a small .ics file the phone's own
 * calendar opens.
 *
 * The office types the time as words ("8:00 AM – 12:00 NN"), so it is read
 * only when it is plain: a start (and maybe an end) with AM, PM, NN (noon) or
 * MN (midnight). Anything else becomes an all-day entry with the time kept in
 * the note — a calendar reminder at the wrong hour is worse than none at all.
 *
 * The barangay keeps Philippine time, which has no daylight saving: UTC+8.
 */

interface CalendarEvent {
  id: number | string;
  title: string;
  /** YYYY-MM-DD… */
  date: string;
  /** As the office typed it, or "". */
  time: string;
  location: string;
  description: string;
  url: string;
}

const MANILA_OFFSET_HOURS = 8;

/** Minutes after midnight, or null when the text is not a plain clock time. */
function minutesOf(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|nn|mn|noon|midnight)$/i);
  if (!m) return null;

  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  const mark = m[3].toLowerCase().replace(/\./g, "");

  if (hour < 1 || hour > 12 || minute > 59) return null;
  if (mark === "nn" || mark === "noon") return hour === 12 ? 12 * 60 + minute : null;
  if (mark === "mn" || mark === "midnight") return hour === 12 ? 24 * 60 : null;
  if (mark === "am") hour = hour === 12 ? 0 : hour;
  if (mark === "pm") hour = hour === 12 ? 12 : hour + 12;

  return hour * 60 + minute;
}

/** The start and end, in minutes, when the office's words say them plainly. */
export function readTimes(text: string): { start: number; end: number | null } | null {
  const parts = text.split(/\s*(?:–|—|-|to|until)\s*/i).filter(Boolean);
  if (parts.length === 0 || parts.length > 2) return null;

  const start = minutesOf(parts[0]);
  if (start === null) return null;

  const end = parts[1] ? minutesOf(parts[1]) : null;
  if (parts[1] && (end === null || end <= start)) return null;

  return { start, end };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A Manila wall-clock moment as the UTC stamp a calendar file wants. */
function utcStamp(date: string, minutes: number): string {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d, 0, minutes) - MANILA_OFFSET_HOURS * 3_600_000);

  return `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}T${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}00Z`;
}

const escapeIcs = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function eventIcs(event: CalendarEvent): string {
  const day = event.date.slice(0, 10).replace(/-/g, "");
  const times = event.time ? readTimes(event.time) : null;
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  let when: string[];
  if (times) {
    /* No end given: two hours, which is what a barangay event usually is. */
    const end = times.end ?? times.start + 120;
    when = [`DTSTART:${utcStamp(event.date, times.start)}`, `DTEND:${utcStamp(event.date, end)}`];
  } else {
    const [y, m, d] = event.date.slice(0, 10).split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    when = [
      `DTSTART;VALUE=DATE:${day}`,
      `DTEND;VALUE=DATE:${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`,
    ];
  }

  const note = [event.time && !times ? `Time: ${event.time}` : "", event.description, event.url]
    .filter(Boolean)
    .join("\n\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Barangay Natumolan//News//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:news-${event.id}@barangay-natumolan`,
    `DTSTAMP:${stamp}`,
    ...when,
    `SUMMARY:${escapeIcs(event.title)}`,
    ...(event.location ? [`LOCATION:${escapeIcs(event.location)}`] : []),
    `DESCRIPTION:${escapeIcs(note)}`,
    `URL:${event.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** Hands the file to the browser, which gives it to the calendar. */
export function downloadIcs(event: CalendarEvent): void {
  const blob = new Blob([eventIcs(event)], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `barangay-event-${event.id}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

/**
 * Shares the page's link: the phone's own share sheet where there is one,
 * otherwise onto the clipboard — including over plain http on the office
 * LAN, where the clipboard API is not offered.
 */
export async function shareLink(title: string, url: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  const nav = navigator as Navigator & { share?: (data: { title: string; url: string }) => Promise<void> };

  if (typeof nav.share === "function") {
    try {
      await nav.share({ title, url });

      return "shared";
    } catch {
      return "cancelled";
    }
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);

      return "copied";
    }
  } catch {
    /* falls through to the old way */
  }

  const box = document.createElement("textarea");
  box.value = url;
  box.setAttribute("readonly", "");
  box.style.position = "fixed";
  box.style.opacity = "0";
  document.body.appendChild(box);
  box.select();
  const ok = document.execCommand("copy");
  box.remove();

  return ok ? "copied" : "failed";
}
