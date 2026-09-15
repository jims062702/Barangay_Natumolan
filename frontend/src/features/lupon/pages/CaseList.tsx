import { FiPlus } from "react-icons/fi";
import { Link } from "react-router-dom";
import PageHeader from "../../../shared/ui/PageHeader";
import PeriodFilter from "../../../shared/ui/PeriodFilter";
import { useLuponDocket } from "../hooks/useLuponDocket";
import { CaseTable } from "../components/docket/CaseTable";
import { ComplaintIntakeModal } from "../components/docket/ComplaintIntakeModal";

export default function CaseList() {
  const ctx = useLuponDocket();
  const {
    period, windowLabel, years, periodCounts, total, blocked, setIntakeOpen, changePeriod,
  } = ctx;

  return (
    <div>
      <PageHeader
        title="Katarungang Pambarangay — Case Docket"
        subtitle="Complaint intake, jurisdiction screening, mediation, and settlement"
        actions={
          <button
            type="button"
            onClick={() => setIntakeOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" /> File complaint
          </button>
        }
      />

      {blocked && (
        <div role="alert" className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3">
          <p className="text-sm font-bold text-danger">Outside KP jurisdiction — routed to VAWC Desk</p>
          <p className="mt-1 text-sm text-dark">{blocked}</p>
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-gray bg-secondary px-4 py-3 text-xs text-gray-500">
        A filed case is worked on its own page: jurisdiction screening →
        mediation by the Punong Barangay → Pangkat conciliation if that fails →
        settlement. Use <strong className="text-dark">Next step</strong> below
        to go straight to what the case needs; compliance after a settlement is
        tracked in{" "}
        <Link to="/lupon/settlements" className="font-semibold text-primary hover:underline">
          Settlements
        </Link>
        .
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

      <ComplaintIntakeModal ctx={ctx} />
    </div>
  );
}

