import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, ComposedChart, XAxis, YAxis, Bar, LabelList } from "recharts";
import Card from "../../../../shared/ui/Card";
import ReplayOnView from "../../../../shared/ui/ReplayOnView";
import BandChart from "../../../../shared/ui/BandChart";
import { GENDER_COLORS, tooltipStyle, AXIS, PRIMARY } from "./chartStyle";
import type { PopulationDashboardState } from "../../hooks/usePopulationDashboard";

/**
 * Age and sex distribution, and this year's demographic events.
 */
export function AgeSexEvents({ ctx }: { ctx: PopulationDashboardState }) {
  const { ageData, genderData, events } = ctx;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card title="Age distribution" className="flex h-full flex-col">
          <p className="-mt-2 mb-3 text-xs text-gray-500">
            Residents in each band, and the shape the bands make.
          </p>
          {ageData.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-20 text-sm text-gray-400">
              No birthdates recorded yet.
            </p>
          ) : (
            <ReplayOnView className="flex min-h-0 flex-1 flex-col">
              <BandChart data={ageData} minHeight={260} unit="residents" />
            </ReplayOnView>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Sex distribution">
          {genderData.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">No data yet.</p>
          ) : (
            <ReplayOnView>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={genderData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={76}
                  paddingAngle={2}
                  stroke="#fff"
                  strokeWidth={2}
                  isAnimationActive
                  animationDuration={900}
                  labelLine={false}
                  label={(props: {
                    cx?: number; cy?: number; midAngle?: number;
                    innerRadius?: number; outerRadius?: number; value?: number;
                  }) => {
                    const rad = Math.PI / 180;
                    const cx = props.cx ?? 0;
                    const cy = props.cy ?? 0;
                    const mid = props.midAngle ?? 0;
                    const inner = props.innerRadius ?? 0;
                    const outer = props.outerRadius ?? 0;
                    const r = inner + (outer - inner) / 2;
                    const x = cx + r * Math.cos(-mid * rad);
                    const y = cy + r * Math.sin(-mid * rad);
                    return (
                      <text x={x} y={y} fill="#fff" fontSize={12} fontWeight={700} textAnchor="middle" dominantBaseline="central">
                        {props.value}
                      </text>
                    );
                  }}
                >
                  {genderData.map((d) => (
                    <Cell key={d.name} fill={GENDER_COLORS[d.name] ?? "#9CA3AF"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v} residents`, n]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            </ReplayOnView>
          )}
        </Card>

        <Card title="Demographic events (this year)">
          {events.length === 0 ? (
            <p className="py-3 text-center text-sm text-gray-400">No events recorded.</p>
          ) : (
            <ReplayOnView>
            <ResponsiveContainer width="100%" height={Math.max(90, events.length * 42)}>
              <ComposedChart layout="vertical" data={events} margin={{ top: 4, right: 28, bottom: 0, left: 8 }} barCategoryGap="28%">
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="event_type" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} width={104} />
                <Tooltip cursor={{ fill: "rgba(114,62,195,0.06)" }} contentStyle={tooltipStyle} formatter={(v) => [`${v}`, "Count"]} />
                <Bar dataKey="count" fill={PRIMARY} radius={[0, 4, 4, 0]} barSize={16}>
                  <LabelList dataKey="count" position="right" fontSize={11} fill="#4B5563" />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
            </ReplayOnView>
          )}
        </Card>
      </div>
    </div>
  );
}
