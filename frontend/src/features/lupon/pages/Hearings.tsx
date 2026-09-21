import { FiCalendar, FiCheckCircle, FiMail, FiPrinter, FiSlash } from "react-icons/fi";
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
    view, setView, setPage, scheduled, awaitingService, completed, cancelled,
  } = ctx;

  return (
    <div>
      <PageHeader
        title="Hearing Calendar, Summons & KP Forms"
        subtitle="Schedules across the whole docket — summons, proof of service, attendance and prescribed forms"
        actions={
          /*
           * The Secretary takes the minutes at these sittings and writes the
           * report on them. Printing what is on screen — this window's
           * sittings, with their parties, dates and outcomes — is that
           * report, so it does not have to be typed a second time.
           */
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPrinter className="h-4 w-4" aria-hidden="true" /> Print report
          </button>
        }
      />

      {/*
        The tiles follow the tab, because a count of something that cannot
        happen in this window is noise. "Completed" on Today's list is
        always the sittings that already ran today — read as a total it
        looked like the day was over; "Awaiting service" on Past is a
        summons nobody will serve now.
      */}
      <div className={`mb-6 grid grid-cols-1 gap-4 ${
        view === "today" ? "sm:grid-cols-1" : "sm:grid-cols-2"
      }`}>
        {view !== "past" && (
          <StatTile label="Scheduled" value={scheduled} icon={FiCalendar} />
        )}
        {view === "upcoming" && (
          <StatTile
            label="Awaiting service"
            value={awaitingService}
            icon={FiMail}
            tone="warning"
            hint="Summons with no proof of service"
          />
        )}
        {view === "past" && (
          <>
            <StatTile label="Completed" value={completed} icon={FiCheckCircle} tone="success" />
            <StatTile label="Cancelled" value={cancelled} icon={FiSlash} tone="danger" />
          </>
        )}
      </div>

      {/* Wraps on a phone: three pill tabs in a row need ~360px. */}
      <div className="mb-4 flex flex-wrap gap-2 print-hide">
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

