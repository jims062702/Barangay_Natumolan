import { MONTH_NAMES } from "./chartStyle";
import type { CoveragePoint } from "./types";

/** Both numbers for the month under the pointer, named in words. */
export function CoverageTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CoveragePoint }>;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;

  return (
    <div className="rounded-xl border border-gray bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-dark">
        {MONTH_NAMES[Number(point.month.slice(5, 7)) - 1]} {point.month.slice(0, 4)}
      </p>
      <p className="mt-1 text-sm font-bold text-dark">
        {point.on_a_list} <span className="font-medium text-gray-500">on a list</span>
      </p>
      <p className="text-[11px] text-gray-500">
        {point.joined > 0 ? `${point.joined} added this month` : "none added this month"}
      </p>
    </div>
  );
}
