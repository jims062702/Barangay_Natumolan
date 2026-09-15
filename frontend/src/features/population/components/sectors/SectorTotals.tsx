import { FiUsers, FiAlertCircle, FiTag } from "react-icons/fi";
import RevealGroup from "../../../../shared/ui/RevealGroup";
import Card from "../../../../shared/ui/Card";
import CountUp from "../../../../shared/ui/CountUp";
import type { SectorReportState } from "../../hooks/useSectorReport";

/**
 * Three numbers, and the reason there are three.
 */
export function SectorTotals({ ctx }: { ctx: SectorReportState }) {
  const { report, setSelected, setPage } = ctx;

  return (
    <RevealGroup className="mb-6 grid gap-4 sm:grid-cols-3">
      <Card>
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <FiUsers className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-3xl font-bold text-dark">
              {report ? <CountUp value={report.people_on_a_list} repeat /> : "—"}
            </p>
            <p className="text-sm font-medium text-dark">on at least one list</p>
            <p className="mt-0.5 text-xs text-gray-500">
              out of {report ? <CountUp value={report.population} repeat /> : "—"} residents
            </p>
          </div>
        </div>
      </Card>

      {/*
        The one worth acting on. A resident on no list is usually one nobody
        has got to yet, and the office cannot see them any other way.
      */}
      <Card className={report?.people_on_no_list ? "border-warning/40" : undefined}>
        <div className="flex items-start gap-3">
          <span
            className={`rounded-xl p-2.5 ${
              report?.people_on_no_list
                ? "bg-warning/15 text-amber-700"
                : "bg-secondary text-gray-400"
            }`}
          >
            <FiAlertCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-3xl font-bold text-dark">
              {report ? <CountUp value={report.people_on_no_list} repeat /> : "—"}
            </p>
            <p className="text-sm font-medium text-dark">on no list at all</p>
            {report && report.people_on_no_list > 0 ? (
              <button
                type="button"
                onClick={() => { setSelected("untagged"); setPage(1); }}
                className="mt-0.5 cursor-pointer text-xs font-semibold text-primary hover:underline"
              >
                See who they are
              </button>
            ) : (
              <p className="mt-0.5 text-xs text-gray-500">Everybody is accounted for.</p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-secondary p-2.5 text-gray-500">
            <FiTag className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-3xl font-bold text-dark">
              {report ? <CountUp value={report.tags} repeat /> : "—"}
            </p>
            <p className="text-sm font-medium text-dark">sector tags</p>
            <p className="mt-0.5 text-xs text-gray-500">
              More than the people: one person can be on several lists.
            </p>
          </div>
        </div>
      </Card>
    </RevealGroup>
  );
}
