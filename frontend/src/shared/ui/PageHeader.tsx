import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { menuFor, type MenuItem } from "../navigation/menu";
import { useAuth } from "../auth/AuthContext";
import Breadcrumbs, { type Crumb } from "./Breadcrumbs";
import { useReveal, revealProps } from "../hooks/useReveal";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /**
   * A trail this page works out for itself.
   *
   * For the handful that know something the route cannot say — a resident's
   * name on their own detail page, say. Everything else is derived.
   */
  crumbs?: Crumb[];
  /** For a page that is its own root: the dashboard, and the public site. */
  noCrumbs?: boolean;
}

/**
 * Where a page sits, worked out from the menu that put it there.
 *
 * Breadcrumbs used to be hand-written, and so four screens out of fifty-four
 * had them. Hand-adding the other fifty would have fixed today and drifted
 * again by the next page somebody wrote — so the trail is derived here, once,
 * from the sidebar itself. A page reachable from the menu has a trail because
 * it is in the menu; nobody has to remember.
 *
 * The menu is the right source rather than a second table of route names: it
 * is already filtered by role and office, so the trail can never name a
 * section this user cannot open.
 */
function trailFor(pathname: string, sections: ReturnType<typeof menuFor>, title: string): Crumb[] {
  type Found = { heading?: string; parent?: MenuItem; item: MenuItem };
  let best: Found | null = null;

  /*
   * THE TRAIL FOLLOWS THE MENU ALL THE WAY DOWN, INCLUDING CHILDREN.
   *
   * It used to read only the top level, so every screen under one parent
   * reported the parent and then its own page title. The hearing room has
   * six entries — For Summons, Today's Hearing, Upcoming, Past, Cancelled,
   * CFA Cases — and all six shared one title, so all six breadcrumbs read
   * "Secretariat > Hearing & Mediation > Hearing & KP Forms". The one line
   * on the page whose whole job is to say WHERE YOU ARE said the same thing
   * in six different places.
   */
  const consider = (item: MenuItem, heading?: string, parent?: MenuItem) => {
    const exact = pathname === item.to;
    const inside = pathname.startsWith(item.to + "/");

    if (!exact && !inside) return;

    // The longest match wins: /lupon/hearings/past beats /lupon/hearings.
    if (!best || item.to.length > best.item.to.length) {
      best = { heading, parent, item };
    }
  };

  for (const section of sections) {
    for (const item of section.items) {
      consider(item, section.heading);
      for (const child of item.children ?? []) {
        consider(child, section.heading, item);
      }
    }
  }

  if (!best) return [];
  const found: Found = best;

  const crumbs: Crumb[] = [];

  /*
   * The section heading is not a link — there is no page behind "Population
   * Office", only a group of them. A crumb that looks clickable and is not
   * is worse than a plain one.
   */
  if (found.heading) {
    crumbs.push({ label: found.heading });
  }

  /*
   * The parent, where the match was one of its children. Not a link when it
   * leads to the same address as the child does — several parents exist only
   * to open a group and point at their own first entry, and two crumbs in a
   * row going to one place is a trail that reads like a stutter.
   */
  if (found.parent && found.parent.to !== found.item.to) {
    crumbs.push({ label: found.parent.label, to: found.parent.to });
  }

  const atTheItem = pathname === found.item.to;

  crumbs.push({ label: found.item.label, to: atTheItem ? undefined : found.item.to });

  /*
   * A page deeper than the menu goes — a case, a resident, a form — names
   * itself with its own title, which is the only thing that knows what it is.
   */
  if (!atTheItem) {
    crumbs.push({ label: title });
  }

  return crumbs;
}

export default function PageHeader({
  title,
  subtitle,
  actions,
  crumbs,
  noCrumbs = false,
}: PageHeaderProps) {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const trail = crumbs ?? (user && !noCrumbs ? trailFor(pathname, menuFor(user), title) : []);

  /*
   * The title moves too, and first — it is the top of the page, so it is
   * what the reveal should look like it started from. `once` here: a header
   * that re-animates every time the office scrolls back up is a header that
   * gets in the way.
   */
  const { ref, shown } = useReveal<HTMLDivElement>({ once: true });
  const reveal = revealProps(shown);

  return (
    <div ref={ref} style={reveal.style} className={`mb-6 ${reveal.className}`}>
      {/*
        One crumb is the page you are already on, which tells nobody
        anything. The trail earns its space from two.
      */}
      {/* On paper the page title names the table; the trail, the subtitle and
          the buttons are screen furniture and are left off. */}
      {trail.length > 1 && <div className="print-hide"><Breadcrumbs items={trail} /></div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark print:text-lg">{title}</h1>
          {subtitle && <p className="print-hide mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {actions && <div className="print-hide flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
