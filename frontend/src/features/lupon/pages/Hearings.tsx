import { FiAlertCircle, FiCalendar, FiCheckCircle, FiMail } from "react-icons/fi";
import StatTile from "../../../shared/ui/StatTile";
import PageHeader from "../../../shared/ui/PageHeader";
import { useHearingCalendar } from "../hooks/useHearingCalendar";
import { HearingTable } from "../components/hearings/HearingTable";
import { SummonsModal } from "../components/hearings/SummonsModal";
import { OutcomeModal } from "../components/hearings/OutcomeModal";
import { RescheduleModal } from "../components/hearings/RescheduleModal";
import { KpFormsModal } from "../components/hearings/KpFormsModal";
import type { View } from "../lib/hearings";

export default function Hearings() {
  const ctx = useHearingCalendar();
  const {
    view, setView, setPage, scheduled, awaitingService, noShows, completed,
  } = ctx;

  return (
    <div>
      <PageHeader
        title="Hearing Calendar, Summons & KP Forms"
        subtitle="Schedules across the whole docket — summons, proof of service, attendance and prescribed forms"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Scheduled" value={scheduled} icon={FiCalendar} />
        <StatTile
          label="Awaiting service"
          value={awaitingService}
          icon={FiMail}
          tone="warning"
          hint="Summons with no proof of service"
        />
        <StatTile label="No-shows" value={noShows} icon={FiAlertCircle} tone="danger" />
        <StatTile label="Completed" value={completed} icon={FiCheckCircle} tone="success" />
      </div>

      {/* Wraps on a phone: three pill tabs in a row need ~360px. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["today", "Today's hearings"],
            ["upcoming", "Upcoming hearings"],
            ["past", "Past hearings"],
          ] as [View, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setPage(1);
              setView(key);
            }}
            className={`cursor-pointer rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              view === key
                ? "bg-primary text-white"
                : "border border-gray bg-white text-dark hover:border-primary hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <HearingTable ctx={ctx} />

      {/* Summons & proof of service */}
      <SummonsModal ctx={ctx} />

      {/* Attendance + outcome */}
      <OutcomeModal ctx={ctx} />

      {/* Reschedule */}
      <RescheduleModal ctx={ctx} />

      {/* Prescribed KP forms */}
      <KpFormsModal ctx={ctx} />
    </div>
  );
}

