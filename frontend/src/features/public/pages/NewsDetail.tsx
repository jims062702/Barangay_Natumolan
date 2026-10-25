import { useEffect, useState } from "react";
import {
  FiAlertTriangle, FiArrowLeft, FiArrowRight, FiCalendar, FiCheck, FiChevronRight, FiClock,
  FiEdit3, FiMapPin, FiPhone, FiShare2, FiUser, FiUsers,
} from "react-icons/fi";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { scrollToLandingSection } from "../lib/landingSection";
import { downloadIcs, shareLink } from "../lib/calendar";
import { news as staticNews } from "../data/news";
import { KIND, URGENCY_TONE, badgeFor, daysUntil, kindOf, postDate, whenLabel } from "../../content/lib/postKinds";
import type { Announcement } from "../../content/types";
import { publicApi } from "../api";
import NewsDetailSkeleton from "../components/NewsDetailSkeleton";
import { Byline, Facts, KindBadge, StatusChips, summaryOf } from "../sections/News";

/*
 * A fact's icon, by NAME. The view travels in the router's history state when
 * a related post is opened, and history can only hold plain data: an icon
 * component in it made the browser refuse the move ("could not be cloned"),
 * so a related post of another kind — an Event, with its organiser and
 * contact — opened nothing at all when clicked.
 */
const FACT_ICON = { users: FiUsers, phone: FiPhone, clock: FiClock, calendar: FiCalendar } as const;
type FactIcon = keyof typeof FACT_ICON;

interface ApiAnnouncement {
  id: number;
  title: string;
  body: string;
  excerpt?: string | null;
  category?: string | null;
  author_name?: string | null;
  byline?: string | null;
  location?: string | null;
  event_at?: string | null;
  event_time?: string | null;
  organizer?: string | null;
  contact_info?: string | null;
  registration_deadline?: string | null;
  completed_at?: string | null;
  participants?: string | null;
  effective_at?: string | null;
  expires_at?: string | null;
  urgency?: string | null;
  image_url?: string | null;
  published_at?: string | null;
}

/** Display shape shared by API posts and the bundled fallback items. */
interface NewsView {
  id: number | string;
  title: string;
  category?: string | null;
  author?: string | null;
  date: string;
  time: string;
  /**
   * Empty when the post has no venue.
   *
   * It used to default to "Barangay Natumolan", which put a place under
   * every post including the ones that are not held anywhere — an invented
   * fact printed with the same confidence as a real one.
   */
  location: string;
  description: string;
  image: string;
  /** Kept so the badge can tell an event that has passed from one that has not. */
  eventAt?: string | null;
  /** The rest of what this KIND carries, ready to render as a list. */
  facts: { icon: FactIcon; label: string; value: string }[];
  urgency?: string | null;
  /** The post as the server sent it — plain data, for its status and dates. */
  raw?: ApiAnnouncement | null;
}

function toView(a: ApiAnnouncement, index = 0): NewsView {
  const kind = kindOf(a.category);

  /*
   * Only what this kind actually has. An Event names its organiser and how
   * to register; an Activity names who took part; an Advisory names when it
   * stops applying. Showing all of them on every post is how a page ends up
   * asserting things nobody entered.
   */
  const facts: NewsView["facts"] = [];

  if (kind === "Event") {
    if (a.organizer) facts.push({ icon: "users", label: "Organised by", value: a.organizer });
    if (a.contact_info) facts.push({ icon: "phone", label: "Contact", value: a.contact_info });
    if (a.registration_deadline) {
      facts.push({ icon: "clock", label: "Register by", value: postDate(a.registration_deadline) });
    }
  }

  if (kind === "Activity" && a.participants) {
    facts.push({ icon: "users", label: "Who took part", value: a.participants });
  }

  if (kind === "Advisory") {
    if (a.effective_at) facts.push({ icon: "calendar", label: "In effect from", value: postDate(a.effective_at) });
    if (a.expires_at) facts.push({ icon: "clock", label: "Until", value: postDate(a.expires_at) });
  }

  if (kind === "Program") {
    if (a.contact_info) facts.push({ icon: "phone", label: "Contact", value: a.contact_info });
    if (a.registration_deadline) {
      facts.push({ icon: "clock", label: "Register by", value: postDate(a.registration_deadline) });
    }
  }

  const when = whenLabel(a);

  return {
    id: a.id,
    title: a.title,
    category: a.category,
    author: a.byline ?? a.author_name,
    eventAt: a.event_at,
    /* The date SAYING what it is: "On …" an event, "Held …" an activity. */
    date: when ? `${when.prefix} ${when.text}` : "",
    time: a.event_time ?? "",
    location: a.location ?? "",
    description: a.body,
    image: a.image_url || staticNews[index % staticNews.length].image,
    facts,
    urgency: a.urgency,
    raw: a,
  };
}

/** The status chips for a view — only a post from the server has the dates for them. */
function Status({ view, className = "" }: { view: NewsView; className?: string }) {
  return view.raw ? <StatusChips post={view.raw as unknown as Announcement} className={className} /> : null;
}

export default function NewsDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  // The carousel passes its item along — used as a fallback so the bundled
  // sample posts (not in the database) still open properly.
  const passed = (useLocation().state as { item?: NewsView } | null)?.item;

  const [item, setItem] = useState<NewsView | null>(null);
  const [related, setRelated] = useState<NewsView[]>([]);
  const [missing, setMissing] = useState(false);
  /* What Share just did, said beside the button for a moment. */
  const [shared, setShared] = useState<"" | "copied" | "failed">("");

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setItem(null);
    setRelated([]);
    setMissing(false);

    publicApi.announcement(id)
      .then((r) => {
        setItem(toView(r.data.data.announcement));
        setRelated((r.data.data.related as ApiAnnouncement[]).map(toView));
      })
      .catch(() => {
        if (passed) {
          // Bundled sample post — show it, with the other samples as related.
          setItem(passed);
          setRelated(
            staticNews
              .filter((n) => String(n.id) !== String(passed.id))
              .slice(0, 6)
              .map((n) => ({ ...n, category: "Announcement", facts: [], author: null }))
          );
        } else {
          setMissing(true);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* The same skeleton the page's code downloaded behind — one wait, not two. */
  if (!item && !missing) return <NewsDetailSkeleton />;

  const raw = item?.raw ?? null;
  /* A calendar entry only for an event still to come, with its date. */
  const canAddToCalendar = Boolean(
    raw && kindOf(raw.category) === "Event" && raw.event_at && (daysUntil(raw.event_at) ?? -1) >= 0,
  );
  const posted = raw?.published_at ? postDate(raw.published_at) : "";

  /* Why these posts are shown: the server puts the same kind first. */
  const kindHere = item ? kindOf(item.category) : "Announcement";
  const sameKind = related.filter((r) => kindOf(r.category) === kindHere).length;
  const plural = KIND[kindHere].plural.toLowerCase();
  const relatedIntro = sameKind === related.length
    ? `More ${plural} from the barangay.`
    : sameKind > 0
      ? `More ${plural} first, then other news from the barangay.`
      : "The latest news from the barangay.";

  const share = async () => {
    if (!item) return;
    const result = await shareLink(item.title, window.location.href);
    if (result === "copied" || result === "failed") {
      setShared(result);
      setTimeout(() => setShared(""), 2500);
    }
  };

  return (
    <div className="bg-secondary pb-20 pt-28">
      {/* max-w-7xl and the same padding as the navbar, so the breadcrumb starts
          flush with the logo. */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500">
            <li>
              <Link to="/" className="transition-colors hover:text-primary">Home</Link>
            </li>
            <li aria-hidden="true"><FiChevronRight className="h-4 w-4" /></li>
            <li>
              {/* A plain "/#news" reloads the app and still lands on Home,
                  because the section is not in the DOM when the browser
                  resolves the fragment. */}
              <a
                href="/#news"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/");
                  scrollToLandingSection("news");
                }}
                className="transition-colors hover:text-primary"
              >
                News &amp; Announcements
              </a>
            </li>
            <li aria-hidden="true"><FiChevronRight className="h-4 w-4" /></li>
            <li aria-current="page" className="max-w-[16rem] truncate font-medium text-dark sm:max-w-md">
              {item?.title ?? "Not found"}
            </li>
          </ol>
        </nav>

        {missing && (
          <div className="rounded-3xl bg-white p-10 text-center shadow-lg shadow-primary/5">
            <p className="text-lg font-semibold text-dark">Announcement not found</p>
            <p className="mt-2 text-sm text-gray-500">
              It may have been removed or unpublished.
            </p>
            <a
              href="/#news"
              onClick={(e) => {
                e.preventDefault();
                navigate("/");
                scrollToLandingSection("news");
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <FiArrowLeft aria-hidden="true" /> Back to News &amp; Announcements
            </a>
          </div>
        )}

        {item && (
          <article className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-primary/5">
            <img
              src={item.image}
              alt={item.title}
              className="h-72 w-full object-cover sm:h-[30rem]"
            />
            <div className="p-6 sm:p-10">
              <span className="flex flex-wrap items-center gap-2">
                {item.category && (
                  <span
                    className={`inline-block rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wide ${
                      KIND[kindOf(item.category)].tone
                    }`}
                  >
                    {badgeFor({ category: item.category, event_at: item.eventAt })}
                  </span>
                )}
                {item.urgency && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                      URGENCY_TONE[item.urgency] ?? "bg-secondary text-gray-600"
                    }`}
                  >
                    <FiAlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.urgency} urgency
                  </span>
                )}
                {/* Today, Tomorrow, Ended, In effect now, New… */}
                <Status view={item} />
              </span>
              <h1 className="mt-3 text-3xl font-extrabold leading-tight text-dark sm:text-4xl break-words [overflow-wrap:anywhere]">
                {item.title}
              </h1>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-b border-gray pb-5 text-sm text-gray-500">
                {item.date && (
                  <span className="inline-flex items-center gap-2">
                    <FiCalendar className="shrink-0 text-primary" aria-hidden="true" /> {item.date}
                  </span>
                )}
                {item.time && (
                  <span className="inline-flex items-center gap-2">
                    <FiClock className="shrink-0 text-primary" aria-hidden="true" /> {item.time}
                  </span>
                )}
                {/* Only when there IS one. */}
                {item.location && (
                  <span className="inline-flex items-center gap-2">
                    <FiMapPin className="shrink-0 text-primary" aria-hidden="true" /> {item.location}
                  </span>
                )}
                {item.author && (
                  <span className="inline-flex items-center gap-2">
                    <FiUser className="shrink-0 text-primary" aria-hidden="true" /> By {item.author}
                  </span>
                )}
                {/* When it was posted, where the main date is something else —
                    an event's day, an activity's, an advisory's. */}
                {posted && !item.date.startsWith("Posted") && (
                  <span className="inline-flex items-center gap-2">
                    <FiEdit3 className="shrink-0 text-primary" aria-hidden="true" /> Posted {posted}
                  </span>
                )}
              </div>

              {/* Keep it, or pass it on. */}
              {raw && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {canAddToCalendar && (
                    <button
                      type="button"
                      onClick={() => downloadIcs({
                        id: raw.id,
                        title: raw.title,
                        date: raw.event_at as string,
                        time: raw.event_time ?? "",
                        location: raw.location ?? "",
                        description: raw.body ?? "",
                        url: window.location.href,
                      })}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
                    >
                      <FiCalendar className="h-4 w-4" aria-hidden="true" /> Add to calendar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void share()}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray px-4 py-2 text-sm font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
                  >
                    {shared === "copied" ? (
                      <><FiCheck className="h-4 w-4 text-success" aria-hidden="true" /> Link copied</>
                    ) : (
                      <><FiShare2 className="h-4 w-4" aria-hidden="true" /> Share</>
                    )}
                  </button>
                  {shared === "failed" && (
                    <span className="text-xs text-gray-500">Copy the address from the browser bar to share it.</span>
                  )}
                </div>
              )}

              {/* What this kind of post carries, and nothing else. */}
              {item.facts.length > 0 && (
                <dl className="mt-5 grid gap-3 rounded-2xl bg-secondary/60 p-5 sm:grid-cols-2">
                  {item.facts.map((fact) => {
                    const Icon = FACT_ICON[fact.icon] ?? FiCalendar;

                    return (
                    <div key={fact.label} className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <div className="min-w-0">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {fact.label}
                        </dt>
                        <dd className="text-sm font-medium text-dark">{fact.value}</dd>
                      </div>
                    </div>
                    );
                  })}
                </dl>
              )}
              <div className="mt-6 whitespace-pre-line text-base sm:text-lg leading-relaxed text-gray-700 break-words [overflow-wrap:anywhere]">
                {item.description}
              </div>
            </div>
          </article>
        )}

        {/* Related news */}
        {item && related.length > 0 && (
          <section aria-label="Related news" className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-dark">Related News &amp; Announcements</h2>
                <span aria-hidden="true" className="mt-2 block h-1 w-12 rounded-full bg-primary" />
                {/* Why these three: the same kind first, then the latest. */}
                <p className="mt-3 text-sm text-gray-500">{relatedIntro}</p>
              </div>
              <a
                href="/#news"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/");
                  scrollToLandingSection("news");
                }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                See all news <FiArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => {
                /* The list's own pieces, so a card reads the same wherever it is. */
                const post = r.raw ? (r.raw as unknown as Announcement) : null;
                const summary = post ? summaryOf(post) : r.description.slice(0, 180);

                return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/news/${r.id}`, { state: { item: r } })}
                  /*
                    The layout said outright. Left to itself a button lays its
                    content out as it likes: on a phone the picture sat beside
                    the text at whatever width the photo's own shape gave it —
                    191 px on one card, 108 on the next. Beside the text it
                    would also take the card's height, which now differs with
                    what each card says. So the picture sits on top on every
                    screen, in one box — the card's width, 144 px tall — with
                    the photo cropped to fill: every picture the same.
                  */
                  className="group flex h-full w-full cursor-pointer flex-col items-stretch overflow-hidden rounded-2xl bg-white text-left shadow-md transition-shadow duration-300 hover:shadow-xl hover:shadow-primary/15"
                  data-testid="related-card"
                >
                  <div className="relative h-36 w-full shrink-0 overflow-hidden bg-secondary" data-testid="related-picture">
                    <img
                      src={r.image}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                  {/* The full width, from the left edge: a button's own defaults shrink
                      its content to fit and centre it. */}
                  <div className="flex w-full min-w-0 flex-1 flex-col items-start gap-2 p-4 text-left" data-testid="related-body">
                    {/* What kind it is and where it stands, before the title:
                        an Event and an Announcement read the same otherwise. */}
                    {post ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <KindBadge post={post} />
                        <StatusChips post={post} />
                      </span>
                    ) : r.category ? (
                      <span className={`inline-block w-fit rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${KIND[kindOf(r.category)].tone}`}>
                        {badgeFor({ category: r.category, event_at: r.eventAt })}
                      </span>
                    ) : null}
                    <p className="line-clamp-2 font-semibold leading-snug text-dark group-hover:text-primary">
                      {r.title}
                    </p>
                    {/* The date saying what it is, how long ago, the time and the place. */}
                    {post ? (
                      <Facts post={post} className="text-xs text-gray-500" />
                    ) : (
                      r.date && <p className="text-xs text-gray-500">{r.date}</p>
                    )}
                    {/* What it is about, in the office's own words. */}
                    {summary && (
                      <p className="line-clamp-2 text-sm leading-relaxed text-gray-600" data-testid="related-summary">
                        {summary}
                      </p>
                    )}
                    <span className="mt-auto flex w-full items-center justify-between gap-2 pt-1">
                      {post ? <Byline post={post} className="text-xs text-gray-400" /> : <span />}
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-primary">
                        Read more
                        <FiArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                      </span>
                    </span>
                  </div>
                </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
