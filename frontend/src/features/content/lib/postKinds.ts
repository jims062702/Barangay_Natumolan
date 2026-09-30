/**
 * The five kinds of post, named once.
 *
 * A barangay does not publish "news". It publishes five different things, and
 * a resident wants them for five different reasons — so the badge, the colour
 * and the wording live here rather than being retyped on the public page, the
 * detail page, the portal and the staff form, where they would drift apart
 * within a month.
 *
 * The distinction that does the most work is Event against Activity: the same
 * medical mission is an Event before it happens and an Activity after, and
 * only one of the two belongs on a resident's calendar.
 */

export type PostKind = "Announcement" | "Event" | "Activity" | "Advisory" | "Program";

export const POST_KINDS: PostKind[] = [
  "Announcement",
  "Event",
  "Activity",
  "Advisory",
  "Program",
];

interface KindMeta {
  /** What the chip on the public page says — plural, because it filters. */
  plural: string;
  /** What the badge on a card says. */
  badge: string;
  /** One line for the staff form, so the kind is chosen on purpose. */
  purpose: string;
  /** Badge colours. Never the only signal: the badge always carries words. */
  tone: string;
  /** The colour of the card's own accent — a rule, a ring. */
  accent: string;
}

export const KIND: Record<PostKind, KindMeta> = {
  Announcement: {
    plural: "Announcements",
    badge: "Announcement",
    purpose: "Something residents need to know — office hours, a new policy, a schedule.",
    tone: "bg-primary/10 text-primary",
    accent: "border-primary/30",
  },
  Event: {
    plural: "Events",
    /* Plain "Event" — badgeFor() adds "Upcoming" only when it still is. */
    badge: "Event",
    purpose: "Something coming up that residents can join. Give the date, time and venue.",
    tone: "bg-teal-50 text-teal-700",
    accent: "border-teal-200",
  },
  Activity: {
    plural: "Activities",
    badge: "Activity",
    purpose: "Something the barangay has already done — a recap, with the date it happened.",
    tone: "bg-secondary text-gray-600",
    accent: "border-gray",
  },
  Advisory: {
    plural: "Advisories",
    badge: "Advisory",
    purpose: "Something urgent. Give when it starts and when it ends, or it never looks over.",
    tone: "bg-danger/10 text-danger",
    accent: "border-danger/40",
  },
  Program: {
    plural: "Programs",
    badge: "Program",
    purpose: "A service residents can come and claim — a mission, a training, an assistance.",
    tone: "bg-warning/15 text-amber-700",
    accent: "border-warning/40",
  },
};

/**
 * Today, as the plain YYYY-MM-DD the dates are stored in.
 *
 * Compared as strings rather than as Date objects on purpose: an event date
 * has no time and no timezone, and `new Date("2026-07-13")` is parsed as
 * midnight UTC — which is the 12th of July for anybody reading in Manila.
 */
function todayISO(): string {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Still to come, counting the whole of the day it falls on. */
export function isUpcoming(date?: string | null): boolean {
  return Boolean(date) && String(date).slice(0, 10) >= todayISO();
}

/**
 * What the badge says.
 *
 * An Event whose date has gone by is still an Event — it is not upcoming, and
 * a card that keeps saying UPCOMING EVENT over a date two months old is the
 * page telling a resident something it can plainly see is untrue. The office
 * can re-file it as an Activity; until they do, the badge is honest.
 */
export function badgeFor(post: { category?: string | null; event_at?: string | null }): string {
  const kind = kindOf(post.category);

  if (kind !== "Event") return KIND[kind].badge;

  return isUpcoming(post.event_at) ? "Upcoming Event" : "Event";
}

/** An unknown kind from an older row must not crash a page. */
export function kindOf(value: unknown): PostKind {
  return POST_KINDS.includes(value as PostKind) ? (value as PostKind) : "Announcement";
}

/**
 * Which fields each kind carries. Mirrors Announcement::FIELDS on the server,
 * which is the side that enforces it.
 */
export const KIND_FIELDS: Record<PostKind, string[]> = {
  Announcement: [],
  Event: ["event_at", "event_time", "location", "organizer", "contact_info", "registration_deadline"],
  Activity: ["completed_at", "location", "participants"],
  Advisory: ["effective_at", "expires_at", "urgency"],
  Program: ["location", "contact_info", "registration_deadline"],
};

export const URGENCIES = ["Low", "Medium", "High", "Critical"] as const;

/** How loudly an advisory is drawn. Colour plus the word, never colour alone. */
export const URGENCY_TONE: Record<string, string> = {
  Low: "bg-secondary text-gray-600",
  Medium: "bg-warning/15 text-amber-700",
  High: "bg-orange-100 text-orange-700",
  Critical: "bg-danger/15 text-danger",
};

/**
 * A date the way a barangay notice writes it.
 *
 * Read from the stored string rather than through `new Date(...)` where only
 * the day matters: parsing a UTC timestamp and formatting it back in local
 * time moves an early-morning event to the day before.
 */
/**
 * The calendar day a value falls on HERE, as [year, month, day].
 *
 * Two shapes come from the server. A date column (an event's day) arrives as
 * midnight UTC — "2026-09-29T00:00:00.000000Z" — and its day is simply the
 * first ten characters. A moment (when a post was published) arrives in UTC
 * too, and its first ten characters are the day in LONDON: a post published
 * at 7 in the morning in Manila read as the day before. A moment is turned
 * into this device's own day instead.
 */
export function dayOf(value?: string | null): [number, number, number] | null {
  if (!value) return null;

  const dateOnly = /^\d{4}-\d{2}-\d{2}(?:[T ]00:00:00(?:\.0+)?Z?)?$/.test(value);
  if (dateOnly || !/[T ]\d{2}:\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);

    return y && m && d ? [y, m, d] : null;
  }

  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return null;

  return [at.getFullYear(), at.getMonth() + 1, at.getDate()];
}

export function postDate(value?: string | null): string {
  const day = dayOf(value);
  if (!day) return "";
  const [y, m, d] = day;

  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** The line a card leads with: the date that matters for THAT kind. */
export function whenOf(post: {
  category?: string;
  event_at?: string | null;
  completed_at?: string | null;
  effective_at?: string | null;
  published_at?: string | null;
}): string {
  switch (kindOf(post.category)) {
    case "Event":
      return postDate(post.event_at) || postDate(post.published_at);
    case "Activity":
      return postDate(post.completed_at) || postDate(post.published_at);
    case "Advisory":
      return postDate(post.effective_at) || postDate(post.published_at);
    default:
      return postDate(post.published_at);
  }
}

/* ------------------------------------------------------------------ *
 | What a resident reads at a glance                                   |
 * ------------------------------------------------------------------ */

/**
 * What each kind means, in a resident's words — said under the filter, so
 * "Activity" and "Event" are not two words for the same thing to somebody
 * who has never had to tell them apart.
 */
export const KIND_FOR_RESIDENTS: Record<PostKind | "All", string> = {
  All: "Everything the barangay has posted, newest first.",
  Announcement: "Notices from the barangay — schedules, office hours, new rules.",
  Event: "Things coming up that you can attend or join, with the date, time and place.",
  Activity: "What the barangay has already done — clean-up drives, meetings, outreach.",
  Advisory: "Urgent notices in effect now — road closures, water or power interruptions, weather.",
  Program: "Services and assistance you can apply for or claim.",
};

/** Whole days from today to a date (YYYY-MM-DD…); negative once it has passed. */
export function daysUntil(value?: string | null): number | null {
  const day = dayOf(value);
  if (!day) return null;
  const [y, m, d] = day;

  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((Date.UTC(y, m - 1, d) - today) / 86_400_000);
}

/** "Sep 29" — the short date a chip has room for. */
export function shortDate(value?: string | null): string {
  const day = dayOf(value);
  if (!day) return "";
  const [y, m, d] = day;

  return new Date(y, m - 1, d).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export interface PostStatus {
  label: string;
  tone: string;
}

const STATUS_TONE = {
  now: "bg-danger/10 text-danger",
  today: "bg-teal-600 text-white",
  soon: "bg-teal-50 text-teal-700",
  open: "bg-success/10 text-success",
  closed: "bg-gray/60 text-gray-500",
};

interface Datable {
  category?: string | null;
  event_at?: string | null;
  completed_at?: string | null;
  effective_at?: string | null;
  expires_at?: string | null;
  registration_deadline?: string | null;
  published_at?: string | null;
}

/**
 * Where a post stands TODAY, in words — the question a date alone leaves the
 * reader to work out. "September 29" says nothing about whether that is this
 * Tuesday or already over; "Tomorrow" and "Ended" do.
 *
 * Only what the post's own dates say: nothing is concluded that the office
 * did not enter.
 */
export function statusesOf(post: Datable): PostStatus[] {
  const kind = kindOf(post.category);
  const out: PostStatus[] = [];

  const registration = () => {
    const left = daysUntil(post.registration_deadline);

    if (left === null) return;
    if (left < 0) out.push({ label: "Registration closed", tone: STATUS_TONE.closed });
    else if (left === 0) out.push({ label: "Last day to register", tone: STATUS_TONE.now });
    else out.push({ label: `Register by ${shortDate(post.registration_deadline)}`, tone: STATUS_TONE.open });
  };

  if (kind === "Event") {
    const days = daysUntil(post.event_at);

    if (days !== null) {
      if (days < 0) out.push({ label: "Ended", tone: STATUS_TONE.closed });
      else if (days === 0) out.push({ label: "Today", tone: STATUS_TONE.today });
      else if (days === 1) out.push({ label: "Tomorrow", tone: STATUS_TONE.soon });
      else if (days <= 14) out.push({ label: `In ${days} days`, tone: STATUS_TONE.soon });
    }
    /* Registration matters only while the event is still to come. */
    if (days === null || days >= 0) registration();
  }

  if (kind === "Program") registration();

  if (kind === "Advisory") {
    const from = daysUntil(post.effective_at);
    const until = daysUntil(post.expires_at);

    if (from !== null && from > 0) out.push({ label: `Starts ${shortDate(post.effective_at)}`, tone: STATUS_TONE.soon });
    else if (until !== null && until < 0) out.push({ label: "Ended", tone: STATUS_TONE.closed });
    else out.push({ label: until === 0 ? "In effect — ends today" : "In effect now", tone: STATUS_TONE.now });
  }

  return out;
}

/** Posted within the last three days. */
export function isNew(post: { published_at?: string | null }): boolean {
  const at = post.published_at ? Date.parse(post.published_at) : NaN;

  return Number.isFinite(at) && Date.now() - at < 3 * 86_400_000;
}

/**
 * The post's main date, and what that date IS. A bare date under a title
 * reads as when it was posted — which for an event is exactly the wrong
 * date to be reading.
 */
export function whenLabel(post: Datable): { prefix: string; text: string } | null {
  const posted = postDate(post.published_at);

  switch (kindOf(post.category)) {
    case "Event":
      return post.event_at ? { prefix: "On", text: postDate(post.event_at) } : posted ? { prefix: "Posted", text: posted } : null;
    case "Activity":
      return post.completed_at ? { prefix: "Held", text: postDate(post.completed_at) } : posted ? { prefix: "Posted", text: posted } : null;
    case "Advisory":
      if (post.effective_at && post.expires_at) {
        return { prefix: "In effect", text: `${shortDate(post.effective_at)} – ${postDate(post.expires_at)}` };
      }
      if (post.effective_at) return { prefix: "In effect from", text: postDate(post.effective_at) };
      if (post.expires_at) return { prefix: "In effect until", text: postDate(post.expires_at) };

      return posted ? { prefix: "Posted", text: posted } : null;
    default:
      return posted ? { prefix: "Posted", text: posted } : null;
  }
}

/**
 * How long ago, in words — "today", "yesterday", "3 days ago". Beside a date,
 * it answers the question the date leaves: is this still news?
 */
export function agoOf(value?: string | null): string {
  const days = daysUntil(value);
  if (days === null || days > 0) return "";

  const past = -days;
  if (past === 0) return "today";
  if (past === 1) return "yesterday";
  if (past < 7) return `${past} days ago`;
  if (past < 30) {
    const weeks = Math.floor(past / 7);

    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  if (past < 365) {
    const months = Math.floor(past / 30);

    return months === 1 ? "1 month ago" : `${months} months ago`;
  }

  const years = Math.floor(past / 365);

  return years === 1 ? "1 year ago" : `${years} years ago`;
}
