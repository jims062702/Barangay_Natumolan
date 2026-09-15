import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area } from "recharts";
import Card from "../../../../shared/ui/Card";
import CountUp from "../../../../shared/ui/CountUp";
import ReplayOnView from "../../../../shared/ui/ReplayOnView";
import { BRAND, GRID, AXIS } from "./chartStyle";
import { CoverageTip } from "./CoverageTip";
import type { SectorReportState } from "../../hooks/useSectorReport";

/**
 * How the lists have grown.
 */
export function SectorGrowthChart({ ctx }: { ctx: SectorReportState }) {
  const { coverage, grew } = ctx;

  return (
    <Card className="mb-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-dark">How the lists have grown</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Residents on at least one sector list, counted from the month each was first added
          </p>
        </div>

        {coverage.length > 0 && (
          <p className="text-right text-xs text-gray-500">
            <span className="text-2xl font-bold text-dark">
              <CountUp value={coverage[coverage.length - 1].on_a_list} repeat />
            </span>{" "}
            now
            {grew > 0 && (
              <span className="ml-2 font-semibold text-success">
                +<CountUp value={grew} repeat /> this year
              </span>
            )}
          </p>
        )}
      </div>

      {/*
        Wrapped so the draw happens when somebody is there to see it.

        Recharts animates on mount, and mount is when the fetch lands —
        which on this page is while the reader is still at the top. The
        chart below the fold finished drawing to an empty room.
      */}
      <ReplayOnView className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={coverage} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              {/*
                The fill fades out downward so the area reads as weight
                under the line rather than as a second, solid mark.
              */}
              <linearGradient id="coverageFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND} stopOpacity={0.28} />
                <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {/* Hairline, solid, one shade off the surface — never dashed. */}
            <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />

            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tick={{ fill: AXIS, fontSize: 11 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: AXIS, fontSize: 11 }}
            />

            {/*
              The hover layer, which an HTML chart gets by default: a
              crosshair and a tooltip naming the month and both numbers.
            */}
            <Tooltip
              cursor={{ stroke: GRID, strokeWidth: 1 }}
              content={<CoverageTip />}
            />

            <Area
              type="monotone"
              dataKey="on_a_list"
              stroke={BRAND}
              strokeWidth={2}
              fill="url(#coverageFill)"
              /* Markers appear on hover at 8px — big enough to aim at. */
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#ffffff", fill: BRAND }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ReplayOnView>

      <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
        The line only ever climbs: once somebody is on a list they stay counted, so this
        reads as coverage rather than as monthly churn.
      </p>
    </Card>
  );
}
