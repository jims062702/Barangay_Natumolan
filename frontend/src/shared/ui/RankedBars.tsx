import {
  Bar,
  ComposedChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * A ranked count across named things, biggest first.
 *
 * HORIZONTAL, and that is the whole reason this exists rather than reusing
 * BandChart. That one draws columns with a line across their tops, which is
 * right for categories read in a FIXED order — age bands, puroks — where the
 * shape of the curve is the point. This is a LEAGUE TABLE: the order carries
 * the meaning, there is no curve to read, and the labels are long
 * ("Barangay Clearance with Picture"). Under vertical columns those labels
 * either overlap or turn sideways, and a chart nobody can read the labels of
 * is a worse answer than the list it replaced.
 *
 * One hue, because this is one measure. A second colour would have to stand
 * for something, and here there is nothing for it to stand for — the bar's
 * LENGTH already says everything the chart knows.
 *
 * In shared/ui rather than in a dashboard folder: the counter that issues
 * these documents and the Punong Barangay who oversees them read the same
 * fact, and must not read it through two charts that drift apart.
 */

/** The app's own hue, checked against the card it sits on rather than picked. */
const PRIMARY = "#723EC3";
const AXIS = "#9CA3AF";
const GRID = "#ECEEF3";

const tooltipStyle = { borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 };

export interface RankedRow {
  label: string;
  count: number;
}

/**
 * How wide the names column has to be for the longest name in it.
 *
 * Measured from the data rather than set to a constant. recharts lays the
 * axis out before the text is drawn, so a width that is too small does not
 * wrap — it CLIPS, and "Barangay Clearance with Pictu" is the kind of thing
 * that reaches a user as a screenshot. ~6.2px per character at 11px covers
 * the app's font; the floor keeps short labels from hugging the bars and the
 * ceiling stops one long name from squeezing the bars off the card.
 */
function widthFor(data: RankedRow[]): number {
  const longest = data.reduce((most, row) => Math.max(most, row.label.length), 0);

  return Math.min(240, Math.max(110, Math.ceil(longest * 6.2) + 12));
}

export default function RankedBars({
  data,
  unit = "requests",
  /** Overrides the measured width, for a caller that knows better. */
  labelWidth,
}: {
  data: RankedRow[];
  unit?: string;
  labelWidth?: number;
}) {
  if (data.length === 0) {
    return null;
  }

  const namesWidth = labelWidth ?? widthFor(data);

  return (
    /*
     * Height follows the row count: a fixed height would stretch three bars
     * over a card built for six, and squeeze six into a card built for three.
     */
    <ResponsiveContainer width="100%" height={Math.max(96, data.length * 40)}>
      <ComposedChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 36, bottom: 0, left: 4 }}
        barCategoryGap="26%"
      >
        {/* Hidden: every bar is labelled with its own figure, so an axis of
            the same numbers would be the same information twice. */}
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 11, fill: AXIS }}
          axisLine={false}
          tickLine={false}
          width={namesWidth}
        />
        <Tooltip
          cursor={{ fill: "rgba(114,62,195,0.06)" }}
          contentStyle={tooltipStyle}
          formatter={(value) => [`${value} ${unit}`, ""]}
        />
        <Bar dataKey="count" fill={PRIMARY} radius={[0, 4, 4, 0]} barSize={16}>
          <LabelList dataKey="count" position="right" fontSize={11} fill="#4B5563" />
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
