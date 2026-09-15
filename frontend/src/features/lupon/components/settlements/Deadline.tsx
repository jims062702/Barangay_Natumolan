import { daysUntil, asDate } from "../../lib/settlements";

export function Deadline({ date, active }: { date?: string | null; active: boolean }) {
  const days = daysUntil(date);
  if (days === null) return <span className="text-gray-400">—</span>;
  if (!active) return <span className="text-gray-500">{asDate(date)}</span>;
  if (days < 0)
    return (
      <span className="font-semibold text-danger">
        {asDate(date)} · {Math.abs(days)}d overdue
      </span>
    );
  if (days === 0) return <span className="font-semibold text-warning">{asDate(date)} · today</span>;
  return (
    <span className="text-dark">
      {asDate(date)} · <span className="text-gray-500">{days}d left</span>
    </span>
  );
}
