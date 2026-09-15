export function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value?: string | null;
  /** A qualification on the value — why it reads the way it does. */
  hint?: string;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray/60 py-2.5 text-sm last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-dark">
        {value || "—"}
        {hint && <span className="mt-0.5 block text-xs font-normal text-gray-400">{hint}</span>}
      </span>
    </div>
  );
}
