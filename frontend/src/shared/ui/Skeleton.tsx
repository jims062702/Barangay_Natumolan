import RouteSkeleton from "./RouteSkeleton";
import logo from "../../assets/logo/barangay-logo.png";
import backdrop from "../../assets/logo/officials-backdrop.jpg";

/**
 * The shape of what is coming, while it comes.
 *
 * A spinner says "wait" and nothing else: the screen is blank, then it is
 * full, and the jump between the two is the whole experience. A skeleton says
 * where the tiles will be and how many, so the eye has already found the
 * headcount by the time the number lands — and a slow connection reads as a
 * page filling in rather than as a page that might be broken.
 *
 * Everything here is `aria-hidden`. A screen reader is told the region is
 * busy by the live region at the top of each skeleton; being read a list of
 * empty grey boxes helps nobody.
 */

/** One grey block. Give it a size with `className`, or with `style` when the
 *  size is worked out rather than written down. */
export default function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`block animate-pulse rounded-lg bg-gray ${className}`}
    />
  );
}

/**
 * The word a screen reader gets instead of the boxes.
 *
 * Placed once per skeleton region rather than on every block, so the
 * announcement is "Loading the dashboard", not "loading" forty times.
 */
function Busy({ what }: { what: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      Loading {what}
    </span>
  );
}

/**
 * Rows with no card chrome, for a placeholder that is already inside a Card.
 *
 * ListSkeleton draws its own border; nesting that inside a Card gives two
 * borders a pixel apart, which reads as a rendering fault rather than as a
 * page loading.
 */
export function RowsSkeleton({ rows = 4, what = "the list" }: { rows?: number; what?: string }) {
  return (
    <div className="py-1">
      <Busy what={what} />
      <div className="divide-y divide-gray/70">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-3">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Cards in a grid — an officials list, a slide list. */
export function CardGridSkeleton({ cards = 4, height = 140 }: { cards?: number; height?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Busy what="the list" />
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray bg-white p-5">
          <Skeleton className="mb-4 h-4 w-40" />
          <Skeleton className="w-full rounded-xl" style={{ height }} />
        </div>
      ))}
    </div>
  );
}

/**
 * The whole application, before the session is known.
 *
 * EVERYTHING THAT DOES NOT DEPEND ON WHO IS SIGNED IN IS DRAWN FOR REAL.
 *
 * This used to be a purple column with grey bars in it, so a hard reload
 * showed one shell, then the real shell replaced it wholesale: the logo
 * arrived, the barangay's name arrived, the photograph behind the menu
 * arrived, the footer arrived. The office reported it as "one skeleton,
 * then a different skeleton" — which is exactly what it was.
 *
 * But almost none of that chrome depends on the session. The seal, the
 * name, the officials behind the menu, "View public site", the town at the
 * foot: all fixed. Only the MENU ITEMS differ by office, and those are the
 * only things still drawn as grey bars. When the session lands, the labels
 * appear in place and nothing else moves.
 *
 * The body is the shape of the page being opened — see RouteSkeleton.
 */
export function AppShellSkeleton({ withPage = true }: {
  /** The page's skeleton in the body — not for a page this account cannot open. */
  withPage?: boolean;
} = {}) {
  return (
    <div className="min-h-screen bg-secondary">
      <Busy what="the page" />

      {/* The real sidebar, minus the names only the session knows. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 overflow-hidden bg-primary-dark text-white lg:block">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
          style={{ backgroundImage: `url(${backdrop})` }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary-dark/85 via-primary-dark/65 to-primary-dark/90"
        />

        <div className="relative flex h-full flex-col">
          <div className="flex shrink-0 items-center gap-3 px-5 py-5">
            <img src={logo} alt="" aria-hidden="true" className="h-10 w-10 shrink-0" />
            <span className="min-w-0 leading-tight">
              <span className="block text-sm font-bold">Barangay Natumolan</span>
              <span className="block text-[11px] text-white/70">Management System</span>
            </span>
          </div>

          {/* The one part that waits: which pages this account may open. */}
          <div className="flex-1 space-y-2 px-3 pt-2">
            <span className="mx-2 block h-2 w-20 animate-pulse rounded bg-white/15" />
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="block h-9 animate-pulse rounded-xl bg-white/10" />
            ))}
          </div>

          <div className="border-t border-white/15 px-5 py-4 text-[11px] text-white/60">
            Tagoloan, Misamis Oriental
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-gray bg-white/90 px-4 backdrop-blur-md sm:px-6">
          <Skeleton className="h-8 w-28 rounded-full" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="hidden h-4 w-32 sm:block" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </header>

        <main className="p-4 sm:p-6">
          {withPage && <RouteSkeleton />}
        </main>
      </div>
    </div>
  );
}

/**
 * What a PUBLIC page downloads behind.
 *
 * Deliberately shapeless. The sign-in page, the landing page and the
 * certificate check share nothing but a background, and the app shell — a
 * sidebar, a row of stat tiles, two charts — was being shown in front of all
 * three. A skeleton that promises a dashboard to somebody opening the login
 * page is not a loading state; it is a wrong answer that then jumps.
 */
export function PublicPageSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary">
      <Busy what="the page" />
      <div className="flex flex-col items-center gap-4">
        <span className="h-14 w-14 animate-pulse rounded-full bg-primary/15" />
        <span className="h-3 w-40 animate-pulse rounded-full bg-gray" />
      </div>
    </div>
  );
}

/**
 * The sign-in page's own shape: the picture panel and the form beside it.
 *
 * This one IS worth drawing, because the layout is fixed and known — two
 * panels on a wide screen, the form alone on a phone — so the page that
 * arrives lands exactly where the skeleton said it would.
 */
export function LoginSkeleton() {
  return (
    <div className="flex min-h-screen bg-white">
      <Busy what="the sign-in page" />

      {/* The panel is a solid brand block, as it is on the real page. */}
      <div className="hidden w-1/2 bg-primary-dark lg:block">
        <div className="flex h-full flex-col justify-between p-12">
          <span className="h-4 w-32 animate-pulse rounded bg-white/20" />
          <div className="space-y-4">
            <span className="block h-20 w-20 animate-pulse rounded-full bg-white/20" />
            <span className="block h-10 w-80 animate-pulse rounded bg-white/20" />
            <span className="block h-5 w-56 animate-pulse rounded bg-white/15" />
            <span className="block h-16 w-72 animate-pulse rounded bg-white/10" />
          </div>
          <span className="h-3 w-48 animate-pulse rounded bg-white/15" />
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-secondary px-4 py-10 lg:w-1/2 lg:bg-white">
        <div className="w-full max-w-md space-y-6">
          {/* On a phone the branding sits above the form instead. */}
          <div className="space-y-3 text-center lg:hidden">
            <Skeleton className="mx-auto h-16 w-16 rounded-full" />
            <Skeleton className="mx-auto h-6 w-52" />
          </div>

          <div className="hidden space-y-3 lg:block">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>

          <div className="space-y-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>

          <Skeleton className="h-12 w-full rounded-full" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
