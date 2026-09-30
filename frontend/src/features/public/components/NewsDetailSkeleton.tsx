/**
 * An announcement page before it has arrived — its breadcrumb, its picture,
 * its title — inside the public site's own navbar and footer.
 *
 * ONE drawing for both waits: the page's code downloading (MainLayout's
 * Suspense) and the announcement itself (NewsDetail, until it answers). The
 * code download used to blank the whole public site, navbar and all, behind
 * a logo in the middle of the screen, and then the page drew this shape
 * itself: two loading states for one click.
 */
export default function NewsDetailSkeleton() {
  return (
    <div className="bg-secondary pb-20 pt-28" data-page-skeleton="NewsDetailSkeleton" aria-busy="true">
      <span role="status" aria-live="polite" className="sr-only">Loading the announcement</span>
      <div aria-hidden="true" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex h-5 items-center gap-2">
          <span className="h-3 w-12 animate-pulse rounded-full bg-gray/60" />
          <span className="h-3 w-3 animate-pulse rounded-full bg-gray/60" />
          <span className="h-3 w-44 animate-pulse rounded-full bg-gray/60" />
          <span className="h-3 w-3 animate-pulse rounded-full bg-gray/60" />
          <span className="h-3 w-56 animate-pulse rounded-full bg-gray/60" />
        </div>
        <div className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-primary/5">
          <div className="h-72 animate-pulse bg-gray/60 sm:h-[30rem]" />
          <div className="space-y-4 p-6 sm:p-10">
            <div className="h-6 w-28 animate-pulse rounded-full bg-gray/60" />
            <div className="h-9 w-2/3 animate-pulse rounded-full bg-gray/60" />
            <div className="h-4 w-1/3 animate-pulse rounded-full bg-gray/60" />
            <div className="h-28 animate-pulse rounded-2xl bg-gray/60" />
          </div>
        </div>
      </div>
    </div>
  );
}
