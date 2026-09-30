import NeedsConnection, { useNeedsConnection } from "../../../shared/offline/NeedsConnection";
import { useEffect } from "react";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { useSettledState } from "../../../shared/hooks/useSettledState";
import Card from "../../../shared/ui/Card";
import PageHeader from "../../../shared/ui/PageHeader";
import BandChart from "../../../shared/ui/BandChart";
import CountUp from "../../../shared/ui/CountUp";
import ReplayOnView from "../../../shared/ui/ReplayOnView";
import RatioRing from "../../../shared/ui/RatioRing";
import { vawcApi } from "../api";
import { SAFETY_STATUSES, violenceLabel } from "../lib/caseOptions";
import { DeskFormsCards } from "../components/DeskFormsCards";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

interface Stats {
  total_cases_active: number;
  total_cases_year: number;
  referrals_made: number;
  referrals_acknowledged: number;
  cases_with_children: number;
  pending_followups: number;
  overdue_followups: number;
  protection_orders_issued: number;
  protection_orders_in_effect: number;
  documents_on_file: number;
  average_response_days: number;
  cases_by_violence_type: { violence_type: string; count: number }[];
  safety_status: Record<string, number>;
  protection_order_status: Record<string, number>;
}

/** Object map → rows, biggest first, zero counts dropped. */
const toRows = (map: Record<string, number> | undefined) =>
  Object.entries(map ?? {})
    .map(([label, count]) => ({ label, count }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

/**
 * Safety, in the order it gets worse.
 *
 * The one breakdown on this page NOT sorted by size. Safe, Ongoing concern
 * and Immediate danger are a scale, and putting the biggest first would tell an officer
 * scanning it that the order means nothing.
 *
 * The colour was green/amber/red, which is what everybody reaches for and
 * which does not survive being checked: run against colour-blind vision, the
 * green and the amber come out 5.7 apart on a scale where 8 is the target —
 * to a red-green colour-blind reader, "Safe" and "Ongoing concern" are the same bar.
 * Darkening them only trades that for amber against red, which is worse.
 *
 * So the order and the label carry the scale, and ONE colour marks the one
 * row an officer must not miss. Two colour classes 25 apart under every kind
 * of colour vision, instead of four that blur into two.
 */
const SAFETY_ORDER = SAFETY_STATUSES;

const CRITICAL = "#DC2626";

/** 2.7 — anonymized periodic reporting and VAW Desk functionality. */
export default function Reports() {
  const { offline, noteOffline } = useNeedsConnection();
  /*
   * Compared by VALUE, not by reference.
   *
   * The poll re-fetches the same figures every twenty seconds and hands
   * back a brand-new object each time, so the charts redrew themselves
   * and the numbers counted up again on a page nobody had touched.
   */
  const [stats, setStats] = useSettledState<Stats | null>(null);
  const year = new Date().getFullYear();

  /* Its skeleton until the figures are in — it drew every chart at zero
     first, then again with the numbers. See PageLoad. */
  const pageLoad = usePageLoad();

  const load = () => {
    vawcApi.statistics()
      .then((r) => {
        setStats(r.data.data);
        pageLoad.done();
      })
      .catch((error) => {
        noteOffline(error);
        /* No line: the page, with the notice that says why the figures are
           missing — they are never kept on this device. */
        if (!(error as { response?: unknown })?.response) pageLoad.done();
        else pageLoad.fail(error);
      });
  };

  useEffect(load, []);
  useAutoRefresh(load, REFRESH.dashboard);

  /* And within a second when somebody else touches one. */
  usePulse("vawc_cases", load);

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle={`Anonymized statistics for ${year} — safe to share with the barangay council`}
      />

      {offline && (
        <NeedsConnection what="these figures" why="The VAWC desk's records are never kept on this device: the server encrypts them with a key this browser never holds, which is what keeps a survivor's case off a laptop." />
      )}

      {/*
        Five counts, so one chart.

        They share a unit — every one of them is a number of things the desk
        handled this year — which is what makes putting them on one scale
        honest. The row of tiles said the same numbers and made none of them
        comparable.
      */}
      <Card title={`Case summary — ${year}`}>
        <ReplayOnView>
          <BandChart
            data={[
              { label: "Active cases", count: stats?.total_cases_active ?? 0 },
              { label: "Cases this year", count: stats?.total_cases_year ?? 0 },
              { label: "Referrals provided", count: stats?.referrals_made ?? 0 },
              { label: "Cases with children", count: stats?.cases_with_children ?? 0 },
              { label: "BPOs issued", count: stats?.protection_orders_issued ?? 0 },
              { label: "BPOs in effect now", count: stats?.protection_orders_in_effect ?? 0 },
            ]}
            unit="cases"
            minHeight={260}
            angledLabels
          />
        </ReplayOnView>
      </Card>

      {/*
        Days, a percentage and three counts — three different kinds of thing,
        so three charts and not one. Bars side by side would invite a
        comparison between a number of days and a number of cases.
      */}
      <Card title="Desk responsiveness" className="mt-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* A percentage is a part of a whole, which is what a ring is for. */}
          <div>
            <p className="mb-1 text-sm font-semibold text-dark">Referrals acknowledged</p>
            <ReplayOnView>
              <RatioRing
                value={stats?.referrals_acknowledged ?? 0}
                of={stats?.referrals_made ?? 0}
                caption={`of ${stats?.referrals_made ?? 0} referrals made`}
              />
            </ReplayOnView>
          </div>

          {/* Days against no target is not a shape — it is a number. */}
          <div className="flex flex-col">
            <p className="mb-1 text-sm font-semibold text-dark">Time to first action</p>
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-secondary py-6">
              <p className="text-4xl font-extrabold leading-none text-primary">
                <CountUp value={stats?.average_response_days ?? 0} repeat />
              </p>
              <p className="mt-1 text-xs font-medium text-gray-500">days on average</p>
            </div>
          </div>

          {/* Three counts, one unit. */}
          <div>
            <p className="mb-1 text-sm font-semibold text-dark">Follow-ups</p>
            <ReplayOnView>
              <BandChart
                data={[
                  { label: "Scheduled", count: stats?.pending_followups ?? 0 },
                  {
                    label: "Overdue",
                    count: stats?.overdue_followups ?? 0,
                    /* The one an officer must not miss. */
                    tone: (stats?.overdue_followups ?? 0) > 0 ? CRITICAL : undefined,
                  },
                ]}
                unit="follow-ups"
                minHeight={220}
                angledLabels
              />
            </ReplayOnView>
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-400">
          Response time counts the days from intake to the first protective
          action on the case — a BPO, a referral or a follow-up, whichever came
          first. Cases with no action yet are excluded.
        </p>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Classification of cases" className="flex h-full flex-col">
          <ReplayOnView className="flex min-h-0 flex-1 flex-col">
            <BandChart
              data={(stats?.cases_by_violence_type ?? []).map((row) => ({
                label: violenceLabel(row.violence_type),
                count: row.count,
              }))}
              empty="No cases this year."
              unit="cases"
              angledLabels
            />
          </ReplayOnView>
        </Card>

        <Card title="Safety status — open cases" className="flex h-full flex-col">
          {/*
            In severity order, not by size. These are a scale, and sorting the
            biggest first would tell an officer scanning it that the order
            means nothing.
          */}
          <ReplayOnView className="flex min-h-0 flex-1 flex-col">
            <BandChart
              data={SAFETY_ORDER.filter((name) => (stats?.safety_status?.[name] ?? 0) > 0).map(
                (name) => ({
                  label: name,
                  count: stats?.safety_status?.[name] ?? 0,
                  /* Only Immediate danger is coloured. The rest are the one hue the
                     rest of the app uses for a count. */
                  tone: name === "Immediate danger" ? CRITICAL : undefined,
                })
              )}
              empty="No follow-up visits recorded."
              unit="cases"
              angledLabels
            />
          </ReplayOnView>
          <p className="mt-4 text-xs text-gray-400">
            Based on the most recent visit for each open case.
          </p>
        </Card>

        <Card title="Protection order status — open cases" className="flex h-full flex-col">
          <ReplayOnView className="flex min-h-0 flex-1 flex-col">
            <BandChart
              data={toRows(stats?.protection_order_status)}
              empty="No follow-up visits recorded."
              unit="cases"
              angledLabels
            />
          </ReplayOnView>
          <p className="mt-4 text-xs text-gray-400">
            {stats?.documents_on_file ?? 0} confidential document(s) on file this year.
          </p>
        </Card>
      </div>

      <p className="mt-6 rounded-xl bg-secondary px-4 py-3 text-xs text-gray-500">
        Per the barangay access-control policy, no personally identifiable
        survivor information appears in the figures above or in any general
        dashboard. The VAW-C Cases report below names each victim-survivor,
        as the form requires: it opens only at this desk, and every time it is
        drawn up it is written to each case's access log.
      </p>

      {/* The printed forms — never part of the page's own print. */}
      <div className="print-hide">
        <DeskFormsCards />
      </div>
    </div>
  );
}
