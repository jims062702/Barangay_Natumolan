import { FiCalendar, FiClock, FiFileText } from "react-icons/fi";
import { Link } from "react-router-dom";
import PageHeader from "../../../../shared/ui/PageHeader";
import { PageLoading } from "../../../../shared/ui/PageLoad";
import StatTile from "../../../../shared/ui/StatTile";
import Card from "../../../../shared/ui/Card";
import type { FrontDeskDashboardState } from "../../hooks/useFrontDeskDashboard";
import type { LuponHearing } from "../../../lupon/types";

/**
 * The Punong Barangay's view: the table they sit at, and nothing else.
 *
 * IT USED TO OPEN ON SOMEBODY ELSE'S WORK. "Most requested services" counted
 * the certificates residents ask the Clerk for, and "Latest announcements"
 * listed what the Secretary had published — neither of which the Punong
 * Barangay does, and a dashboard that reports another office's work invites
 * the reader to start doing it.
 *
 * What they do is preside. So the page opens on today's sittings: the hour
 * each is set for, who is coming, and what the case is about — and then the
 * ones after, so a Tuesday with four cases is not a surprise on the Tuesday.
 *
 * Nothing here writes. Every case opens on the calendar, which is the one
 * screen this office has.
 */
export function ExecutiveView({ ctx }: { ctx: FrontDeskDashboardState }) {
  const { pageLoad, firstLoad, kpCounts, todaySittings, nextSittings } = ctx;

  const standing = todaySittings.filter((h) => h.status === "Scheduled");

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={firstLoad} />;

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        subtitle="The sittings you preside over — today first, then what is coming"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {/* THE NUMBER OF ROWS ON THE CARD BELOW. It counted only the
            sittings still standing, so a day whose one hearing had been
            held read "0" directly above a card listing it. */}
        <StatTile
          label="Sittings today"
          value={todaySittings.length}
          icon={FiCalendar}
          tone={standing.length > 0 ? "warning" : undefined}
          hint={
            standing.length > 0
              ? `Next at ${clock(standing[0].scheduled_at)}`
              : todaySittings.length > 0
                ? "All held or stood down"
                : "Nothing is set for today"
          }
        />
        <StatTile label="Still ahead" value={nextSittings.length} icon={FiClock} hint="The next sittings booked" />
        {/* Settlements they attested that the parties may still take
            back. The ten days are the PB's own window, not the desk's. */}
        <StatTile
          label="Within the 10 days to repudiate"
          value={kpCounts.repudiation}
          icon={FiFileText}
          hint="Settlements not yet final"
        />
      </div>

      <div className="mt-6">
        <Card title="Today's Hearing">
          <Sittings
            rows={todaySittings}
            empty="No sitting is set for today."
          />
        </Card>
      </div>

      <div className="mt-6">
        <Card title="The sittings after today">
          <Sittings rows={nextSittings} empty="Nothing further is on the calendar." withDate />
        </Card>
      </div>
    </div>
  );
}

/**
 * A list of sittings, as the person presiding needs to read them.
 *
 * The hour, the case, and BOTH parties by name. A row that gave only a case
 * number would send the reader to another screen to find out who is walking
 * in, which on the morning of a sitting is the one thing they do not have
 * time to do.
 */
function Sittings({ rows, empty, withDate = false }: {
  rows: LuponHearing[];
  empty: string;
  withDate?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">{empty}</p>;
  }

  return (
    <ul className="divide-y divide-gray/70">
      {rows.map((h) => (
        <li key={h.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-dark">
              {h.lupon_case?.complainant_display_name ?? "—"}
              <span className="text-gray-400"> vs. </span>
              {h.lupon_case?.respondent_display_names || "—"}
            </p>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {/* The calendar is where a case is read in full; this is the
                  door to it, and the only link on the page. */}
              <Link to="/lupon/hearings/calendar" className="font-medium text-primary hover:underline">
                {h.lupon_case?.case_number ?? "—"}
              </Link>
              {h.lupon_case?.case_title ? ` · ${h.lupon_case.case_title}` : ""}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="whitespace-nowrap text-sm font-semibold text-dark">
              {withDate ? `${day(h.scheduled_at)}, ` : ""}{window(h.scheduled_at)}
            </p>
            {h.status !== "Scheduled" && (
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{h.status}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/*
 * READ OFF THE STRING, NEVER PARSED.
 *
 * The column holds Manila wall-clock and the server serialises it with a
 * "Z" it has not earned, so `new Date(...)` reads a nine o'clock sitting as
 * nine UTC and shifts it eight hours.
 */
const clock = (iso: string) => {
  const h = Number(iso.slice(11, 13));
  if (Number.isNaN(h)) return "—";
  return `${h % 12 === 0 ? 12 : h % 12}:${iso.slice(14, 16)} ${h < 12 ? "AM" : "PM"}`;
};

/** The window, because a sitting is allowed an hour and a half. */
const window = (iso: string) => {
  const from = Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
  if (Number.isNaN(from)) return "—";
  const face = (mins: number) => {
    const h = Math.floor(mins / 60) % 24;
    return `${h % 12 === 0 ? 12 : h % 12}:${String(mins % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  };
  return `${face(from)} – ${face(from + 90)}`;
};

/** "Oct 6" — the date part, read off the string for the same reason. */
const day = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
