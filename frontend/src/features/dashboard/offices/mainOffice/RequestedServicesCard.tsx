import Card from "../../../../shared/ui/Card";
import ReplayOnView from "../../../../shared/ui/ReplayOnView";
import RankedBars from "../../../../shared/ui/RankedBars";

/**
 * What residents came in for this year, biggest first.
 *
 * ONE CARD, TWO DESKS. The Punong Barangay reads it to see what the barangay
 * is being asked for; the clerk reads it because they are the one issuing
 * these documents all day. Written once so the two cannot drift into showing
 * different figures for the same question.
 *
 * A chart rather than the list it replaces: as figures in a column, 108 and
 * 18 are two numbers to compare by reading. As bars they are a shape, and
 * "indigency is most of the counter's work" is visible before anything is
 * read at all.
 */
export function RequestedServicesCard({
  rows,
}: {
  rows: { service_type: string; count: number }[];
}) {
  const data = rows.map((row) => ({ label: row.service_type, count: row.count }));

  return (
    <Card title="Most requested services">
      <p className="-mt-2 mb-3 text-xs text-gray-500">
        Requests made this year, most asked for first.
      </p>
      {data.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">No requests this year.</p>
      ) : (
        <ReplayOnView>
          <RankedBars data={data} unit="requests" />
        </ReplayOnView>
      )}
    </Card>
  );
}
