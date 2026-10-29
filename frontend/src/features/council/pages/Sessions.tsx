import { FiPlus } from "react-icons/fi";
import PageHeader from "../../../shared/ui/PageHeader";
import PeriodFilter from "../../../shared/ui/PeriodFilter";
import { useSessionRecords } from "../hooks/useSessionRecords";
import { SessionTable } from "../components/sessions/SessionTable";
import { SessionEditor } from "../components/sessions/SessionEditor";
import { PageLoading } from "../../../shared/ui/PageLoad";

/**
 * The minutes of the Sangguniang Barangay.
 *
 * The one document a barangay secretary is personally answerable for, and
 * until now it lived outside this system entirely. Draft minutes are not a
 * record — the council adopts them at a later sitting — so the status is a
 * field the secretary sets and the adoption is a button only the Punong
 * Barangay has.
 */

export default function Sessions() {
  const ctx = useSessionRecords();
  const {
    total, period, windowLabel, years, periodCounts, changePeriod, startNew, user,
  } = ctx;

  const canCreate = user?.role === "Secretary" || user?.role === "Admin";

  if (ctx.pageLoad.state !== "ready") return <PageLoading load={ctx.pageLoad} onRetry={() => ctx.load()} />;

  return (
    <div>
      <PageHeader
        title="Barangay Sessions"
        subtitle="Minutes and attendance for every sitting of the Sangguniang Barangay"
        actions={
          canCreate ? (
            <button
              type="button"
              onClick={startNew}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <FiPlus className="h-4 w-4" aria-hidden="true" /> Record a session
            </button>
          ) : undefined
        }
      />

      <PeriodFilter
        value={period}
        onChange={changePeriod}
        years={years}
        counts={periodCounts}
        showing={windowLabel}
        count={total}
        noun="session"
      />

      <SessionTable ctx={ctx} />

      <SessionEditor ctx={ctx} />
    </div>
  );
}

