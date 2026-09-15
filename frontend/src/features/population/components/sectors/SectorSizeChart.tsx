import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell, LabelList, Line } from "recharts";
import Card from "../../../../shared/ui/Card";
import CountUp from "../../../../shared/ui/CountUp";
import ReplayOnView from "../../../../shared/ui/ReplayOnView";
import { BRAND, GRID, AXIS } from "./chartStyle";
import { SectorTip } from "./SectorTip";
import type { SectorReportState } from "../../hooks/useSectorReport";

/**
 * Every sector, largest first.
 */
export function SectorSizeChart({ ctx }: { ctx: SectorReportState }) {
  const { report, sectorData, pickSector, selected } = ctx;

  return (
    <Card className="mb-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-dark">Every sector, largest first</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Click a column to open that list below
          </p>
        </div>

        {report && (
          <p className="text-right text-xs text-gray-500">
            <span className="text-2xl font-bold text-dark">
              <CountUp value={report.tags} repeat />
            </span>{" "}
            tags across{" "}
            <span className="font-semibold text-dark">
              <CountUp value={report.people_on_a_list} repeat />
            </span>{" "}
            people
          </p>
        )}
      </div>

      {sectorData.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">No sector lists yet.</p>
      ) : (
        <ReplayOnView className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={sectorData}
              margin={{ top: 20, right: 8, bottom: 8, left: -20 }}
            >
              <defs>
                {/*
                  The columns sit back at low opacity and the line runs at
                  full strength on top — the same relationship the area
                  chart above has between its fill and its line.
                */}
                <linearGradient id="sectorFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={BRAND} stopOpacity={0.12} />
                </linearGradient>
              </defs>

              {/* Hairline, solid, one shade off the surface — never dashed. */}
              <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />

              <XAxis
                dataKey="short"
                interval={0}
                angle={-35}
                textAnchor="end"
                height={70}
                tickLine={false}
                axisLine={{ stroke: GRID }}
                tick={{ fill: AXIS, fontSize: 10 }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fill: AXIS, fontSize: 11 }}
              />

              <Tooltip
                cursor={{ fill: BRAND, fillOpacity: 0.06 }}
                content={<SectorTip />}
              />

              <Bar
                dataKey="count"
                barSize={26}
                radius={[4, 4, 0, 0]}
                className="cursor-pointer"
                onClick={(entry: unknown) => pickSector(entry)}
              >
                {/*
                  The chosen sector goes solid. Identity never rests on the
                  colour alone — the axis label names every column, and the
                  chips below say which list is open.
                */}
                {sectorData.map((row) => (
                  <Cell
                    key={row.sector_type}
                    fill={selected === row.sector_type ? BRAND : "url(#sectorFill)"}
                  />
                ))}

                {/*
                  Thirteen small integers above thirteen columns. The guide
                  would normally label selectively, but the count IS what
                  the office reads off this page, and hiding it behind a
                  hover was the complaint that started the rebuild.
                */}
                <LabelList
                  dataKey="count"
                  position="top"
                  offset={8}
                  fill="#1F2937"
                  fontSize={11}
                  fontWeight={700}
                />
              </Bar>

              <Line
                type="monotone"
                dataKey="count"
                stroke={BRAND}
                strokeWidth={2}
                dot={{ r: 3, fill: "#ffffff", stroke: BRAND, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: BRAND, stroke: "#ffffff", strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ReplayOnView>
      )}

      {report && (
        <p className="mt-2 border-t border-gray pt-3 text-[11px] leading-relaxed text-gray-400">
          Hover a column for what the list is used for. Percentages are of the{" "}
          {report.population} residents on the register, and add up to more than 100
          because one person can be on several lists.
        </p>
      )}
    </Card>
  );
}
