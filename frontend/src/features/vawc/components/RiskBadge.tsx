/**
 * How urgent a case is, said in words.
 *
 * Colour carries it too, but never alone: a colour is nothing to a screen
 * reader and two of these are indistinguishable to a colour-blind officer —
 * and this is the field that decides who gets visited tonight.
 *
 * "Not assessed" is its own state and is not dressed as Low. A case nobody
 * has judged is not a safe case; it is an unjudged one, and the docket should
 * say which.
 */
export function RiskBadge({ level }: { level?: string | null }) {
  if (!level) {
    return <span className="text-xs text-gray-400">Not assessed</span>;
  }

  const tone: Record<string, string> = {
    Critical: "bg-danger text-white",
    High: "bg-danger/15 text-danger",
    Medium: "bg-warning/20 text-amber-700",
    Low: "bg-secondary text-gray-600",
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone[level] ?? "bg-secondary text-gray-600"}`}>
      {level}
    </span>
  );
}
