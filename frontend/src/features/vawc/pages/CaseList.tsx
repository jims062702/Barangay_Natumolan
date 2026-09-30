import { FiPlus } from "react-icons/fi";
import NeedsConnection from "../../../shared/offline/NeedsConnection";
import PageHeader from "../../../shared/ui/PageHeader";
import PeriodFilter from "../../../shared/ui/PeriodFilter";
import { useCaseRegistry } from "../hooks/useCaseRegistry";
import { CaseTable } from "../components/cases/CaseTable";
import { IntakeModal } from "../components/cases/IntakeModal";
import { EditCaseModal } from "../components/cases/EditCaseModal";
import { PageLoading } from "../../../shared/ui/PageLoad";

export default function CaseList() {
  const ctx = useCaseRegistry();
  const {
    period, windowLabel, years, periodCounts, total, setIntakeOpen, changePeriod, offline,
  } = ctx;

  if (ctx.pageLoad.state !== "ready") return <PageLoading load={ctx.pageLoad} onRetry={() => ctx.load()} />;

  return (
    <div>
      <PageHeader
        title="Confidential Cases"
        subtitle="Cases are identified by case code — access is logged"
        actions={
          <button
            type="button"
            onClick={() => setIntakeOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" /> Confidential intake
          </button>
        }
      />

      {offline && (
        <NeedsConnection what="the VAWC docket" why="The VAWC desk's records are never kept on this device: the server encrypts them with a key this browser never holds, which is what keeps a survivor's case off a laptop." />
      )}

      <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-dark">
        <strong>Reminder:</strong> VAWC cases are never mediated at the Lupon.
        Coordinate protective services immediately for high-risk situations.
      </div>

      <PeriodFilter
        value={period}
        onChange={changePeriod}
        years={years}
        counts={periodCounts}
        showing={windowLabel}
        count={total}
      />

      <CaseTable ctx={ctx} />

      <IntakeModal ctx={ctx} />

      {/* Correct an intake. The survivor link and report date are deliberately
          not editable here — re-pointing a case at a different person would
          rewrite history that the access trail cannot explain. */}
      <EditCaseModal ctx={ctx} />
    </div>
  );
}

