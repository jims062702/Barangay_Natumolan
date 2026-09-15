import { PURPOSE } from "./chartStyle";
import type { SectorPoint } from "./types";

/**
 * The column under the pointer, in full.
 *
 * The axis had to shorten the name to fit; this is where it comes back whole,
 * with the count, the share of the register, and — the line that turns a tally
 * into something an officer plans from — what the list is actually used for.
 */
export function SectorTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: SectorPoint }>;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;

  return (
    <div className="max-w-56 rounded-xl border border-gray bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-dark">{point.sector_type}</p>
      <p className="mt-1 text-sm font-bold text-dark">
        {point.count} <span className="font-medium text-gray-500">residents</span>
        {point.share > 0 && (
          <span className="ml-1.5 text-[11px] font-medium text-gray-400">
            {point.share}% of the register
          </span>
        )}
      </p>
      {PURPOSE[point.sector_type] && (
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
          {PURPOSE[point.sector_type]}
        </p>
      )}
    </div>
  );
}
