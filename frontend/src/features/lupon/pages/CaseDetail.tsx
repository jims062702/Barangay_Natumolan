import { FiArrowLeft } from "react-icons/fi";
import { Link } from "react-router-dom";
import StatusBadge from "../../../shared/ui/StatusBadge";
import PageHeader from "../../../shared/ui/PageHeader";
import { EXIT_GUIDE, STAGES, STAGE_GUIDE, reachedStages } from "../lib/caseStages";
import { useLuponCase } from "../hooks/useLuponCase";
import { StageTracker } from "../components/case/StageTracker";
import { ComplaintCard } from "../components/case/ComplaintCard";
import { HearingsCard } from "../components/case/HearingsCard";
import { SettlementCard } from "../components/case/SettlementCard";
import { FeeAndScheduleCard } from "../components/case/FeeAndScheduleCard";
import { MediationModal } from "../components/case/MediationModal";
import { ConciliationModal } from "../components/case/ConciliationModal";
import { SettlementModal } from "../components/case/SettlementModal";
import { PageLoading } from "../../../shared/ui/PageLoad";

export default function CaseDetail() {
  const ctx = useLuponCase();
  const {
    caseData,
  } = ctx;

  if (!caseData) return <PageLoading load={ctx.pageLoad} onRetry={ctx.load} />;

  const settlement = caseData.settlement;
  const stageIndex = STAGES.indexOf(caseData.current_stage);
  const reached = reachedStages(caseData);

  return (
    <div>
      <Link to="/lupon/cases" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
        <FiArrowLeft aria-hidden="true" /> Back to docket
      </Link>

      <PageHeader
        title={`${caseData.case_number} — ${caseData.case_title}`}
        subtitle={`${caseData.case_classification} · filed ${new Date(caseData.date_filed).toLocaleDateString("en-PH", { dateStyle: "long" })}`}
        actions={<StatusBadge status={caseData.current_stage} />}
      />

      {/*
        The Katarungang Pambarangay path, with the steps this case actually
        took. Three states, because "we went through it", "we are in it" and
        "we never got there" are three different things — and a bar that
        could only say two of them was what made a referred case unreadable.
      */}
      <StageTracker caseData={caseData} reached={reached} />

      {/* What the current stage means and how long the law allows for it. */}
      {STAGE_GUIDE[caseData.current_stage] && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm font-semibold text-dark">
            Stage {stageIndex + 1} of {STAGES.length}: {caseData.current_stage}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {STAGE_GUIDE[caseData.current_stage].what}
          </p>
          <p className="mt-1 text-xs font-medium text-primary">
            Period allowed: {STAGE_GUIDE[caseData.current_stage].period}
          </p>
        </div>
      )}

      {/*
        What the exit means and what happens next. The banner used to say
        only that the case had left the track, which is the one thing the
        badge beside the title already said.
      */}
      {EXIT_GUIDE[caseData.current_stage] && (
        <div className="mb-6 rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3">
          <p className="text-sm font-semibold text-dark">{caseData.current_stage}</p>
          <p className="mt-1 text-sm text-gray-700">
            {EXIT_GUIDE[caseData.current_stage].what}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            {EXIT_GUIDE[caseData.current_stage].next}
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <ComplaintCard caseData={caseData} onChanged={ctx.load} />

        <FeeAndScheduleCard ctx={ctx} caseData={caseData} />

        <HearingsCard ctx={ctx} caseData={caseData} />

        <SettlementCard ctx={ctx} settlement={settlement} />
      </div>

      {/* Mediation modal */}
      <MediationModal ctx={ctx} />

      {/* Conciliation modal */}
      <ConciliationModal ctx={ctx} />

      {/* Settlement modal */}
      <SettlementModal ctx={ctx} />
    </div>
  );
}

