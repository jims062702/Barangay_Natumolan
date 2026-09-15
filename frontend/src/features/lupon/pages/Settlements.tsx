import { FiAlertTriangle, FiCheckCircle, FiClock, FiFileText } from "react-icons/fi";
import StatTile from "../../../shared/ui/StatTile";
import PageHeader from "../../../shared/ui/PageHeader";
import RevealGroup from "../../../shared/ui/RevealGroup";
import { useSettlementDocket } from "../hooks/useSettlementDocket";
import { SettlementTable } from "../components/settlements/SettlementTable";
import { SettlementDetailModal } from "../components/settlements/SettlementDetailModal";

export default function Settlements() {
  const ctx = useSettlementDocket();
  const {
    inWindow, overdue, complied, certificates,
  } = ctx;

  return (
    <div>
      <PageHeader
        title="Settlement, Compliance & Execution"
        subtitle="Repudiation windows, compliance deadlines, execution and KP certificates"
      />

      <div className="mb-4 rounded-2xl border border-gray bg-secondary px-4 py-3 text-xs text-gray-500">
        An amicable settlement becomes final once the ten-day repudiation
        period lapses without a proper repudiation. Lapsed windows are
        finalized automatically when this register is opened.
      </div>

      <RevealGroup className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="In repudiation window" value={inWindow} icon={FiClock} tone="warning" />
        <StatTile label="Compliance overdue" value={overdue} icon={FiAlertTriangle} tone="danger" />
        <StatTile label="Complied / executed" value={complied} icon={FiCheckCircle} tone="success" />
        <StatTile label="CFA / CBA issued" value={certificates} icon={FiFileText} />
      </RevealGroup>

      <SettlementTable ctx={ctx} />

      <SettlementDetailModal ctx={ctx} />
    </div>
  );
}

