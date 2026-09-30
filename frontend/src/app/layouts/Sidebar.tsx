import type { Dispatch, SetStateAction } from "react";
import { FiExternalLink } from "react-icons/fi";
import { Link, NavLink } from "react-router-dom";
import { homePathFor } from "../../shared/auth/AuthContext";
import type { User } from "../../shared/types";
import type { MenuSection } from "../../shared/navigation/menu";
import { SidebarGroup } from "./SidebarGroup";
import logo from "../../assets/logo/barangay-logo.png";
import backdrop from "../../assets/logo/officials-backdrop.jpg";

/**
 * The sidebar: the office's menu with its counts, and the account at the foot.
 *
 * `compact` is the icon-only rail. The mobile drawer always renders the full
 * sidebar — collapsing a drawer the user just opened makes no sense — so the
 * rail is a desktop-only state.
 */
export function Sidebar({ compact, user, sections, setSidebarOpen, badges, activePath }: {
  compact: boolean;
  user: User;
  sections: MenuSection[];
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  badges: Record<string, number>;
  activePath: string;
}) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-primary-dark text-white">
      {/*
        The barangay's own officials behind the menu.
        Held at the TOP and cropped rather than squeezed to fit: a group
        photograph stretched to a 256px column turns eleven people into
        eleven smears. It sits far back — the menu is what this column is
        for, and every label on it has to stay legible over the picture,
        so the image is dimmed and a gradient runs over it.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
        style={{ backgroundImage: `url(${backdrop})` }}
      />
      {/*
        The scrim. Without it a white polo shirt sits under a white menu
        label and the label disappears — so the picture keeps a wash of the
        barangay's own purple over it, heavier at the top and bottom where
        the brand and the footer text sit.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary-dark/85 via-primary-dark/65 to-primary-dark/90"
      />

      {/* Everything below sits over the picture. */}
      <div className="relative flex h-full min-h-0 flex-col">
      {/*
        Brand only — collapsed this is the logo and nothing else.
        The collapse control lives in the TOPBAR rather than here: sharing this
        row with a 36px button left only 140px for a name that needs 173px, and
        "Barangay Natum…" is not an acceptable way to show a barangay's own
        name. In the topbar it also keeps one fixed position in both states.
      */}
      <div
        className={`flex shrink-0 items-center py-5 ${compact ? "justify-center px-2" : "px-5"}`}
      >
        <Link to={homePathFor(user)} className="flex min-w-0 items-center gap-3">
          <img src={logo} alt="Barangay Natumolan logo" className="h-10 w-10 shrink-0" />
          {!compact && (
            <span className="min-w-0 leading-tight">
              <span className="block text-sm font-bold">Barangay Natumolan</span>
              <span className="block text-[11px] text-white/70">
                {user.role === "Resident" ? "Resident Portal" : "Management System"}
              </span>
            </span>
          )}
        </Link>
      </div>

      <nav
        aria-label="Sidebar"
        className={`flex-1 space-y-5 overflow-y-auto pb-6 ${compact ? "px-2" : "px-3"}`}
      >
        {sections.map((section, index) => (
          <div key={index}>
            {section.heading &&
              (compact ? (
                // No room for a heading in the rail — a rule keeps the grouping.
                <div aria-hidden="true" className="mx-2 mb-2 mt-3 border-t border-white/15" />
              ) : (
                <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  {section.heading}
                </p>
              ))}
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.to}>
                  {item.children && !compact ? (
                    <SidebarGroup
                      item={item}
                      badges={badges}
                      activePath={activePath}
                      setSidebarOpen={setSidebarOpen}
                    />
                  ) : (
                  <NavLink
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    // The only label left in the rail, so it has to be here.
                    title={compact ? item.label : undefined}
                    aria-label={
                      badges[item.to] > 0
                        ? `${item.label} — ${badges[item.to]} waiting`
                        : undefined
                    }
                    // Not NavLink's own isActive: it cannot express
                    // "longest match wins", which is the only rule that
                    // lights one item on both /residents/34 and
                    // /residents/non-residents.
                    aria-current={item.to === activePath ? "page" : undefined}
                    className={`relative flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors ${
                      compact ? "justify-center px-2" : "gap-3 px-3"
                    } ${
                      item.to === activePath
                        ? "bg-white text-primary shadow-sm"
                        : "text-white/85 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                    {!compact && <span className="flex-1 truncate">{item.label}</span>}
                    {/*
                      What is waiting behind this page. Shown only when there
                      is something — a row of zeros is a row of noise, and a
                      clerk learns to stop reading it within a day.

                      In the collapsed rail there is no room for a number, so
                      it becomes a dot: still says "look here", takes no space.
                    */}
                    {badges[item.to] > 0 &&
                      (compact ? (
                        <span
                          aria-hidden="true"
                          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger"
                        />
                      ) : (
                        <span className="shrink-0 rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">
                          {badges[item.to] > 99 ? "99+" : badges[item.to]}
                        </span>
                      ))}
                  </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/*
        The public site, from anywhere.
        
        It lived on the SK dashboard alone, which is the one office that
        edits the landing page — but every desk has reason to look at what a
        resident actually sees, and hunting for the one page that links to it
        is not a way to find out.

        In the sidebar rather than duplicated into seven dashboard headers:
        the same link on every page for every role, and one place to change.
      */}
      <div className={`shrink-0 border-t border-white/15 ${compact ? "px-2 py-3" : "px-3 py-3"}`}>
        <a
          href="/"
          target="_blank"
          /* noreferrer, not just noopener: the staff URL a clerk came from is
             nobody's business on the public side. */
          rel="noreferrer"
          title={compact ? "View public site" : undefined}
          aria-label="View public site (opens in a new tab)"
          className={`flex items-center rounded-xl py-2.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white ${
            compact ? "justify-center px-2" : "gap-3 px-3"
          }`}
        >
          <FiExternalLink className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
          {!compact && <span className="flex-1 truncate">View public site</span>}
        </a>
      </div>

      {!compact && (
        <div className="border-t border-white/15 px-5 py-4 text-[11px] text-white/60">
          Tagoloan, Misamis Oriental
        </div>
      )}
      </div>
    </div>
  );
}
