import { Link } from "react-router-dom";
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, Bar, LabelList } from "recharts";
import Card from "../../../../shared/ui/Card";
import ReplayOnView from "../../../../shared/ui/ReplayOnView";
import { AXIS, tooltipStyle, PRIMARY } from "./chartStyle";
import type { PopulationDashboardState } from "../../hooks/usePopulationDashboard";

/**
 * Sectoral counts, and the households that may need a visit.
 */
export function SectorsAndHouseholds({ ctx }: { ctx: PopulationDashboardState }) {
  const { sectorData, analytics } = ctx;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card
        title="Sectoral counts"
        className="h-full"
        action={
          <Link to="/population/sectors" className="text-xs font-semibold text-primary hover:underline">
            Open master lists
          </Link>
        }
      >
        {sectorData.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">No sectors assigned yet.</p>
        ) : (
          <ReplayOnView>
          <ResponsiveContainer width="100%" height={Math.max(120, sectorData.length * 30)}>
            <ComposedChart layout="vertical" data={sectorData} margin={{ top: 4, right: 32, bottom: 0, left: 8 }} barCategoryGap="26%">
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="sector_type" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} width={132} />
              <Tooltip cursor={{ fill: "rgba(114,62,195,0.06)" }} contentStyle={tooltipStyle} formatter={(v) => [`${v} residents`, "Count"]} />
              <Bar dataKey="count" fill={PRIMARY} radius={[0, 4, 4, 0]} barSize={14}>
                <LabelList dataKey="count" position="right" fontSize={11} fill="#4B5563" />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
          </ReplayOnView>
        )}
      </Card>

      <Card title="Households needing possible intervention" className="h-full">
        <div className="mb-4 rounded-2xl bg-secondary p-5 text-center">
          <p className="text-3xl font-extrabold text-primary">
            {analytics?.intervention.households_flagged ?? 0}
          </p>
          <p className="mt-1 text-xs font-medium text-gray-500">
            household(s) with at least one vulnerability indicator
          </p>
        </div>
        <dl className="divide-y divide-gray/70 text-sm">
          {Object.entries(analytics?.intervention.by_indicator ?? {})
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([indicator, count]) => (
              <div key={indicator} className="flex items-center justify-between py-2.5">
                <dt className="text-gray-500">{indicator}</dt>
                <dd className="font-semibold text-dark">{count}</dd>
              </div>
            ))}
        </dl>
        {Object.values(analytics?.intervention.by_indicator ?? {}).every((c) => c === 0) && (
          <p className="py-4 text-center text-sm text-gray-400">
            No households carry a priority-sector indicator yet.
          </p>
        )}
        <p className="mt-4 text-xs text-gray-400">
          An indicator-based shortlist for follow-up — not an official needs assessment. A
          household is counted once per indicator, however many members carry it.
        </p>
      </Card>
    </div>
  );
}
