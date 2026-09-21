/**
 * The numbers behind a chart, for the page that gets filed.
 *
 * A bar chart printed on a barangay's mono laser is a row of identical grey
 * blocks: the hue that carried the measure is gone, and the figures that were
 * labels on screen come out too small to read. The office files these reports
 * and reads them back a year later, so what goes on paper has to be the
 * figures themselves.
 *
 * Hidden on screen, shown on paper — the chart does the opposite. Same
 * numbers, each in the form its medium can actually carry.
 */
export default function PrintableFigures({
  rows,
  caption,
  unitHeader = "Count",
  labelHeader = "Item",
}: {
  rows: { label: string; count: number }[];
  /** What this table counts, printed above it. */
  caption?: string;
  unitHeader?: string;
  labelHeader?: string;
}) {
  if (rows.length === 0) {
    return null;
  }

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <table className="print-only w-full text-sm">
      {caption && (
        <caption className="mb-1 text-left text-sm font-semibold">{caption}</caption>
      )}
      <thead>
        <tr>
          <th className="border-b border-black py-1 text-left font-semibold">{labelHeader}</th>
          <th className="border-b border-black py-1 text-right font-semibold">{unitHeader}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td className="border-b border-gray-300 py-1">{row.label}</td>
            <td className="border-b border-gray-300 py-1 text-right tabular-nums">{row.count}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td className="border-t border-black py-1 font-semibold">Total</td>
          <td className="border-t border-black py-1 text-right font-semibold tabular-nums">
            {total}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
