import { Link } from "react-router-dom";
import { FiCalendar } from "react-icons/fi";
import Card from "../../../shared/ui/Card";
import { formatWallClock } from "../../../shared/lib/datetime";
import type { PortalKpCase } from "../types";

/**
 * "Do I have to be anywhere?" — answered on the dashboard.
 *
 * A summons is the one thing on this portal a resident can be PENALISED for
 * missing, and it lived two clicks away behind a menu they had no reason to
 * open unless they already knew. So it comes to the front page.
 *
 * THREE GROUPS, because they are three different pieces of news:
 *
 *   Today     — leave the house
 *   Upcoming  — put it in your diary
 *   Past      — what already happened, so "did I miss one?" has an answer
 *
 * A group with nothing in it is not drawn. Three empty headings teach a
 * reader that this card never says anything.
 */

type Group = "today" | "upcoming" | "past";

interface Sitting {
  key: string;
  type: string;
  scheduled_at?: string | null;
  status: string;
  case_number: string;
  title: string;
}

const GROUPS: { key: Group; label: string; tone: string }[] = [
  { key: "today", label: "Today", tone: "text-danger" },
  { key: "upcoming", label: "Coming up", tone: "text-primary" },
  { key: "past", label: "Already held", tone: "text-gray-400" },
];

/**
 * The resident's sittings, from the cases the portal home already fetched.
 *
 * It used to fetch them itself, after the page had appeared, and draw its
 * own skeleton in the middle of a page that had finished loading — a
 * second loading state. The home asks once, and this only lays the answer
 * out.
 */
export default function MyHearingsCard({ cases }: { cases: PortalKpCase[] }) {
  const sittings: Sitting[] = cases.flatMap((c) =>
    (c.hearings ?? []).map((h, i) => ({
      key: `${c.case_number}-${i}`,
      type: h.type,
      scheduled_at: h.scheduled_at,
      status: h.status,
      case_number: c.case_number,
      title: c.title,
    })),
  );

  /*
   * Grouped on the CALENDAR DAY, not on the instant.
   *
   * A sitting at 9am is still "today" at 2pm — somebody checking after lunch
   * needs to see they were due this morning, not have it silently move into
   * "already held" while the rest of the day runs.
   */
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local

  const dayOf = (at?: string | null) => (at ? at.slice(0, 10) : "");

  const grouped: Record<Group, Sitting[]> = {
    today: sittings.filter((s) => dayOf(s.scheduled_at) === today && s.status === "Scheduled"),
    upcoming: sittings.filter((s) => dayOf(s.scheduled_at) > today && s.status === "Scheduled"),
    /* Stood-down sittings sit here too: "it was cancelled" is the answer to
       "why did nobody turn up?", and hiding it leaves a gap in the story. */
    past: sittings.filter((s) => dayOf(s.scheduled_at) < today || s.status !== "Scheduled"),
  };

  const anything = sittings.length > 0;

  return (
    <Card
      title="My hearings"
      action={
        anything ? (
          <Link
            to="/resident/lupon/hearings"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        ) : undefined
      }
    >
      {!anything ? (
        <p className="flex items-center justify-center gap-2 py-6 text-center text-sm text-gray-400">
          <FiCalendar aria-hidden="true" className="h-4 w-4" />
          You have no hearing to attend.
        </p>
      ) : (
        <div className="space-y-4">
          {GROUPS.map(({ key, label, tone }) =>
            grouped[key].length === 0 ? null : (
              <div key={key}>
                <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${tone}`}>
                  {label} · {grouped[key].length}
                </p>
                <ul className="space-y-2">
                  {/* Newest first among past sittings; soonest first ahead. */}
                  {[...grouped[key]]
                    .sort((a, b) =>
                      key === "past"
                        ? (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? "")
                        : (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""),
                    )
                    .slice(0, 3)
                    .map((s) => (
                      <li
                        key={s.key}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-dark">
                            {s.type}
                            <span className="ml-2 font-mono text-[11px] font-normal text-gray-400">
                              {s.case_number}
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {formatWallClock(s.scheduled_at, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                        {key === "today" && (
                          <span className="shrink-0 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">
                            Bring a valid ID
                          </span>
                        )}
                        {key === "past" && s.status !== "Completed" && (
                          <span className="shrink-0 text-xs text-gray-400">{s.status}</span>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ),
          )}
        </div>
      )}
    </Card>
  );
}
