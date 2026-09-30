import { FiCheckCircle, FiClock } from "react-icons/fi";
import StatTile from "../../../shared/ui/StatTile";
import PageHeader from "../../../shared/ui/PageHeader";
import RevealGroup from "../../../shared/ui/RevealGroup";
import { useSettlementDocket } from "../hooks/useSettlementDocket";
import { SettlementTable } from "../components/settlements/SettlementTable";
import { SettlementDetailModal } from "../components/settlements/SettlementDetailModal";
import { PageLoading } from "../../../shared/ui/PageLoad";

export default function Settlements() {
  const ctx = useSettlementDocket();
  const { inWindow, complied } = ctx;

  if (ctx.pageLoad.state !== "ready") return <PageLoading load={ctx.pageLoad} onRetry={() => ctx.load()} />;

  return (
    <div>
      <PageHeader
        title="Settlements"
        subtitle="What the parties agreed to, the ten days either may repudiate it in, and how it was carried out"
      />

      <div className="mb-4 rounded-2xl border border-gray bg-secondary px-4 py-3 text-xs text-gray-500">
        An amicable settlement becomes final once the ten-day repudiation
        period lapses without a proper repudiation. Lapsed windows are
        finalized automatically when this register is opened.
      </div>

      <RevealGroup className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatTile label="In repudiation window" value={inWindow} icon={FiClock} tone="warning" />
        <StatTile label="Complied / executed" value={complied} icon={FiCheckCircle} tone="success" />
      </RevealGroup>

      <SettlementTable ctx={ctx} />

      <SettlementDetailModal ctx={ctx} />
    </div>
  );
}

