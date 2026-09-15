/**
 * The landing page content the SK office keeps.
 */

/**
 * A post on News & Announcements.
 *
 * One row shape for five kinds of post — see lib/postKinds. Which of the
 * optional fields are filled in depends on the kind, and the server clears
 * the ones that do not belong to it, so a post changed from Event to
 * Announcement cannot keep showing a stale venue.
 */
export interface Announcement {
  id: number;
  title: string;
  body: string;
  /** One of the five kinds. Typed loosely because the server owns the list. */
  category: string;
  /** The byline the barangay puts its name to — "SK Secretary". */
  author_name?: string | null;
  /** What to actually print: author_name, or the account that posted it. */
  byline?: string | null;
  /** One line for the card, so a card is not a truncated essay. */
  excerpt?: string | null;
  status: "Draft" | "Published" | "Archived";
  image_path?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  sort_order?: number;

  /** Event, Activity and Program all use a venue. */
  location?: string | null;

  /** Event. */
  event_at?: string | null;
  event_time?: string | null;
  organizer?: string | null;
  contact_info?: string | null;
  registration_deadline?: string | null;

  /** Activity. */
  completed_at?: string | null;
  participants?: string | null;

  /** Advisory. */
  effective_at?: string | null;
  expires_at?: string | null;
  urgency?: string | null;
}

export interface HeroSlide {
  id: number;
  title?: string | null;
  subtitle?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  sort_order: number;
  is_active: boolean;
}
