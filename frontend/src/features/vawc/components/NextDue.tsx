/**
 * When the case is next due, and whether that day has passed.
 *
 * A date on its own does not say "this one is late" — and late is the only
 * reason to read this column.
 */
export function NextDue({ on }: { on?: string | null }) {
  if (!on) {
    return <span className="text-xs text-gray-400">None scheduled</span>;
  }

  const due = new Date(on);
  const overdue = due.setHours(23, 59, 59, 999) < Date.now();

  return (
    <span className={`text-xs ${overdue ? "font-bold text-danger" : "text-dark"}`}>
      {new Date(on).toLocaleDateString("en-PH", { dateStyle: "medium" })}
      {overdue && " · overdue"}
    </span>
  );
}
