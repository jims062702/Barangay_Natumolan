import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area } from "recharts";
import Card from "../../../../shared/ui/Card";
import CountUp from "../../../../shared/ui/CountUp";
import ReplayOnView from "../../../../shared/ui/ReplayOnView";
import { PRIMARY, GRID, AXIS } from "./chartStyle";
import { RegisterTip } from "./RegisterTip";
import type { PopulationDashboardState } from "../../hooks/usePopulationDashboard";

/**
 * How the register has grown.
 */
export function RegisterGrowth({ ctx }: { ctx: PopulationDashboardState }) {
  const { analytics, register, addedThisYear } = ctx;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6">
        <Card
          title={`Population growth — ${analytics?.growth.year ?? new Date().getFullYear()}`}
          className="flex-1"
        >
          <dl className="divide-y divide-gray/70 text-sm">
            {[
              ["Births", analytics?.growth.births ?? 0],
              ["Deaths", analytics?.growth.deaths ?? 0],
              ["Natural increase", analytics?.growth.natural_increase ?? 0],
              ["Newly registered", analytics?.growth.newly_registered ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between py-2.5">
                <dt className="text-gray-500">{label}</dt>
                <dd className="font-semibold text-dark">{value}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-gray-500">Growth rate</dt>
              <dd
                className={`font-bold ${
                  (analytics?.growth.growth_rate ?? 0) < 0 ? "text-danger" : "text-success"
                }`}
              >
                {(analytics?.growth.growth_rate ?? 0) > 0 ? "+" : ""}
                {analytics?.growth.growth_rate ?? 0}%
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-gray-400">
            Natural increase plus net migration, against the headcount at the start of the year.
          </p>
        </Card>

        <Card
          title={`Migration — ${analytics?.migration.year ?? new Date().getFullYear()}`}
          className="flex-1"
        >
          <dl className="divide-y divide-gray/70 text-sm">
            {[
              ["Transferred in", analytics?.migration.in_migration ?? 0],
              ["Transferred out", analytics?.migration.out_migration ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between py-2.5">
                <dt className="text-gray-500">{label}</dt>
                <dd className="font-semibold text-dark">{value}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-gray-500">Net migration</dt>
              <dd
                className={`font-bold ${
                  (analytics?.migration.net_migration ?? 0) < 0 ? "text-danger" : "text-success"
                }`}
              >
                {(analytics?.migration.net_migration ?? 0) > 0 ? "+" : ""}
                {analytics?.migration.net_migration ?? 0}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-gray-400">
            Counted from verified Transfer In / Transfer Out events recorded this year.
          </p>
        </Card>
      </div>

      {/*
        The only genuine TREND on this page, and so the only thing a
        line belongs on. Every other figure here is a snapshot — fifty
        residents, ninety households, today — and none of them says
        whether that fifty is growing, which is the question a health
        post or a feeding programme is planned against.
      */}
      <div className="lg:col-span-2">
        <Card className="flex h-full flex-col">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-dark">How the register has grown</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Residents on the register, counted from the month each was added
              </p>
            </div>

            {register.length > 0 && (
              <p className="text-right text-xs text-gray-500">
                <CountUp
                  value={register[register.length - 1].on_the_register}
                  repeat
                  className="text-2xl font-bold text-dark"
                />{" "}
                now
                {addedThisYear > 0 && (
                  <span className="ml-2 font-semibold text-success">
                    +{addedThisYear} this year
                  </span>
                )}
              </p>
            )}
          </div>

          <ReplayOnView className="min-h-0 w-full flex-1 [height:260px] [min-height:260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={register} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  {/*
                    The fill fades out downward so the area reads as
                    weight under the line rather than as a second mark.
                  */}
                  <linearGradient id="registerFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid stroke={GRID} vertical={false} />
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
                <Tooltip cursor={{ stroke: GRID, strokeWidth: 1 }} content={<RegisterTip />} />
                <Area
                  type="monotone"
                  dataKey="on_the_register"
                  stroke={PRIMARY}
                  strokeWidth={2}
                  fill="url(#registerFill)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#ffffff", fill: PRIMARY }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ReplayOnView>

          <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
            The line only ever climbs: it is the register as it stands today, laid out over
            the months it was built in. People who have since left are not carried.
          </p>
        </Card>
      </div>
    </div>
  );
}
