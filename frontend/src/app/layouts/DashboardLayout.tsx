import { Suspense, useEffect, useState } from "react";
import { FiLogOut, FiMenu, FiSidebar, FiX } from "react-icons/fi";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../shared/auth/AuthContext";
import { useSignOut } from "../../shared/auth/useSignOut";
import RouteSkeleton from "../../shared/ui/RouteSkeleton";
import OfflineBanner from "../../shared/offline/OfflineBanner";
import PortalOfflineBanner from "../../shared/offline/PortalOfflineBanner";
import QueuePanel from "../../shared/offline/QueuePanel";
import UpdateBanner from "../../shared/offline/UpdateBanner";
import OfflineReadiness from "../../shared/offline/OfflineReadiness";
import { menuFor } from "../../shared/navigation/menu";
import { useAutoRefresh, REFRESH } from "../../shared/hooks/useAutoRefresh";
import { useOfflineData } from "../../shared/offline/useOfflineData";
import ErrorBoundary from "../ErrorBoundary";
import ChatWidget from "../../features/chat/components/ChatWidget";
import { NotificationsBell } from "./NotificationsBell";
import { Sidebar } from "./Sidebar";
import { dashboardApi } from "../../features/dashboard/api";

/** Remembers the collapsed rail across page loads and sessions. */
const COLLAPSE_KEY = "bn-sidebar-collapsed";

export default function DashboardLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  /*
   * The register, copied to this device so the counter keeps working.
   *
   * Above the early return below, with the other hooks, and for the same
   * reason: `user` is null on the first render of every load, and a hook
   * that runs on only some renders changes the hook order between them.
   *
   * Offices only. A resident has no register to search and no business
   * holding a copy of one.
   */
  const cache = useOfflineData(!!user && user.role !== "Resident");
  /*
   * Above the `if (!user) return null` below, and it has to stay there:
   * this calls hooks, and `user` is null on the first render of every
   * load. A hook that runs only on some renders changes the hook order
   * between them, which React refuses outright.
   */
  const signOut = useSignOut("/login");
  /*
   * How much is waiting behind each sidebar item, keyed by route. Refreshed
   * on the same beat as the notification bell: a number that is an hour old
   * is worse than none, because it is believed.
   */
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [badgeTick, setBadgeTick] = useState(0);
  useAutoRefresh(() => setBadgeTick((t) => t + 1), REFRESH.staff);

  useEffect(() => {
    void dashboardApi.badges()
      .then((response) => setBadges(response.data.data ?? {}))
      // A desk that cannot reach the counts still has a working sidebar.
      .catch(() => undefined);
  }, [badgeTick]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1"
  );

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      return !c;
    });
  };

  if (!user) return null;

  const sections = menuFor(user);

  /**
   * Which ONE menu item the current page belongs to.
   *
   * Prefix matching alone lights up two items at once: /residents matches
   * while /residents/non-residents is open. Exact matching fixes that and
   * breaks something else — /residents/34, a resident's own page, then lights
   * up nothing at all, and the sidebar goes blank on every detail page.
   *
   * Neither rule is right on its own. The one that is: among the items whose
   * path the current URL sits under, the LONGEST wins. /residents/34 belongs
   * to Residents; /residents/non-residents belongs to Non-residents, because
   * it is the more specific of the two matches.
   */
  const activePath = sections
    .flatMap((section) => section.items.flatMap(
      (item) => [item.to, ...(item.children ?? []).map((child) => child.to)],
    ))
    .filter((to) => pathname === to || pathname.startsWith(to + "/"))
    .sort((a, b) => b.length - a.length)[0];

  const handleLogout = () => void signOut();

  return (
    <div className="min-h-screen bg-secondary">
      {/* Desktop sidebar — full width, or the icon-only rail when collapsed */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 ease-out lg:block ${
          collapsed ? "w-[72px]" : "w-64"
        }`}
      >
        <Sidebar
          compact={collapsed}
          user={user}
          sections={sections}
          setSidebarOpen={setSidebarOpen}
          badges={badges}
          activePath={activePath}
        />
      </aside>

      {/* Mobile drawer — always the full sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-dark/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-72">
            <Sidebar
              compact={false}
              user={user}
              sections={sections}
              setSidebarOpen={setSidebarOpen}
              badges={badges}
              activePath={activePath}
            />
          </aside>
        </div>
      )}

      {/*
        The room kept for the sidebar goes on paper too. The sidebar itself is
        hidden in print, and without print:pl-0 its 256px were left as a blank
        band down the left of every printed page, pushing the table off the
        right edge of a portrait sheet.
      */}
      <div
        className={`transition-[padding] duration-200 ease-out print:pl-0 ${
          collapsed ? "lg:pl-[72px]" : "lg:pl-64"
        }`}
      >
        {/*
          Offices only, which is what the barangay asked for.

          A resident on their phone at home has nothing to gain from it:
          they came to check one request, and if the line is down there is
          nothing for them to keep doing. The offices are the ones with a
          queue of people in front of them.
        */}
        {/*
          For everyone, residents included: an old build is wrong for any
          user, and this is the only way a deployed fix reaches a device the
          service worker is still serving yesterday's files to.
        */}
        <UpdateBanner />

        {user.role !== "Resident"
          ? <OfflineBanner held={cache.held} syncing={cache.syncing} />
          : <PortalOfflineBanner />}

        {/* Topbar */}
        <header className="print-hide sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-gray bg-white/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              onClick={() => setSidebarOpen((o) => !o)}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-dark hover:bg-primary/10 lg:hidden"
            >
              {sidebarOpen ? <FiX className="h-5 w-5" /> : <FiMenu className="h-5 w-5" />}
            </button>

            {/* Collapse/expand the sidebar — desktop only, and in the same spot
                the mobile drawer button occupies at narrower widths. */}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden h-10 w-10 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-primary/10 hover:text-primary lg:flex"
            >
              <FiSidebar className="h-5 w-5" />
            </button>
            <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:inline-block">
              {user.role === "Resident" ? "Resident" : user.office}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <NotificationsBell />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-dark">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              {user.name.charAt(0)}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Logout"
              title="Logout"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <FiLogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/*
          Room at the bottom for the assistant to float over.

          The public site has a footer under its content, so the chat
          launcher and its greeting bubble sit over that. The dashboard has
          none — the page simply ends — so the launcher covered whatever the
          last row was, which on a list page is the Previous/Next pager. A
          resident on page 1 of their requests could not reach page 2.

          Padding rather than moving the widget: the assistant belongs in
          the corner it is in on both sites, and the bubble is wider than
          the launcher, so nudging it would only move the problem sideways.
          Only where the widget actually renders — staff do not have it and
          should not lose the space.
        */}
        <main
          className={`p-4 sm:p-6 lg:p-8 ${user.role === "Resident" ? "pb-28 sm:pb-28 lg:pb-28" : ""}`}
        >
          {/* Scoped so a failing page keeps the sidebar and topbar usable
              instead of blanking the whole screen. */}
          {/*
            Whether this device is actually ready to work with no line.
            
            On the dashboard only — it is a thing to check before a shift,
            not a banner to follow the office around all day. The component
            renders nothing when everything is in order, so a healthy
            device shows a clean dashboard.
          */}
          {user.role !== "Resident" && pathname === "/dashboard" && (
            <div className="mb-4">
              <OfflineReadiness />
            </div>
          )}

          <ErrorBoundary label="This page could not be displayed">
            {/*
              The page's own boundary, inside the shell.

              Without it a move between two pages fell all the way out to the
              router's fallback, which redraws the whole app shell — so the
              sidebar and topbar already on screen flickered away and came
              back to sit in exactly the same place. Only the body waits now.
            */}
            {/*
              THE SHAPE OF THE PAGE THAT IS COMING.
              This drew one heading over one list card whatever was being
              opened, so nearly every screen — and nearly every screen here
              is a toolbar over a table — was replaced wholesale when it
              arrived. RouteSkeleton reads the address, which is known
              before the chunk is.
            */}
            <Suspense fallback={<RouteSkeleton />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/*
        The assistant, for residents only.

        It lived on the public site alone, so a resident signed in to do the
        thing they came for — check a request, read an announcement — had to
        leave the portal and go back to the landing page to ask a question
        about it. Staff have the desk itself and do not need the widget.
      */}
      {user.role === "Resident" && <ChatWidget />}

      {/*
        What the office has done that the server does not have yet.

        Bottom LEFT, because the assistant already owns the bottom right on
        a resident's screen and the two must never sit on top of each other.
        It renders nothing at all when the queue is empty, so an office with
        a good line never sees it.
      */}
      {user.role !== "Resident" && <QueuePanel />}
    </div>
  );
}

