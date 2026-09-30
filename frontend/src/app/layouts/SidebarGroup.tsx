import { useState, type Dispatch, type SetStateAction } from "react";
import { FiChevronDown } from "react-icons/fi";
import { NavLink } from "react-router-dom";
import type { MenuItem } from "../../shared/navigation/menu";

/**
 * A menu entry that opens into others.
 *
 * The parent is a BUTTON, not a link. It carries no page of its own worth
 * going to — "My cases" is the two entries under it — and a row that both
 * navigated and expanded meant one click did two things, only one of which
 * the person wanted.
 *
 * OPEN BY DEFAULT WHEN YOU ARE INSIDE IT. Arriving on "Filed against me" from
 * a notification and finding the group shut would hide where you are; the
 * chevron would then be the only clue, and a clue is not a signal.
 */
export function SidebarGroup({
  item,
  badges,
  activePath,
  setSidebarOpen,
}: {
  item: MenuItem;
  badges: Record<string, number>;
  activePath: string;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const children = item.children ?? [];
  const inside = children.some((child) => child.to === activePath) || item.to === activePath;
  const [open, setOpen] = useState(inside);

  /*
   * What the whole group is waiting on, shown while it is shut.
   *
   * A collapsed group with a count inside it and nothing on its own row is a
   * group somebody never opens. Summed rather than listed: the point of the
   * number on a closed row is "there is something in here", and the split is
   * one click away.
   */
  const total = children.reduce((sum, child) => sum + (badges[child.to] ?? 0), 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          inside && !open
            ? "bg-white/15 text-white"
            : "text-white/85 hover:bg-white/10 hover:text-white"
        }`}
      >
        <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
        {/* Wraps like the children below it rather than being cut off:
            "Child Health & Nutrition" came out as "Child Health & Nutri…". */}
        <span className="flex-1 text-left leading-snug">{item.label}</span>

        {/* The count belongs on the closed row; open, each child carries its own. */}
        {!open && total > 0 && (
          <span className="shrink-0 rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">
            {total > 99 ? "99+" : total}
          </span>
        )}

        <FiChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul className="mt-1 space-y-1 border-l border-white/15 pl-3">
          {children.map((child) => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                onClick={() => setSidebarOpen(false)}
                aria-label={
                  badges[child.to] > 0
                    ? `${child.label} — ${badges[child.to]} waiting`
                    : undefined
                }
                aria-current={child.to === activePath ? "page" : undefined}
                className={`relative flex items-start gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors ${
                  child.to === activePath
                    ? "bg-white text-primary shadow-sm"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <child.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {/*
                  A CHILD'S NAME WRAPS; it is not cut off.

                  "Punong Barangay Hearing" came out as "Punong Barangay …"
                  beside its badge — the one word that says WHOSE hearings
                  these are was the word that got dropped. A second line
                  costs a few pixels; a name nobody can read costs more.
                */}
                <span className="flex-1 leading-snug">{child.label}</span>
                {badges[child.to] > 0 && (
                  <span className="shrink-0 rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">
                    {badges[child.to] > 99 ? "99+" : badges[child.to]}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
