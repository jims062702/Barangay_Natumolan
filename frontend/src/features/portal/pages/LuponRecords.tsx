import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { FiCalendar } from "react-icons/fi";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import Modal from "../../../shared/ui/Modal";
import PageHeader from "../../../shared/ui/PageHeader";
import StatusBadge from "../../../shared/ui/StatusBadge";
import { RowsSkeleton } from "../../../shared/ui/Skeleton";
import { formatWallClock } from "../../../shared/lib/datetime";
import { portalApi } from "../api";
import type { PortalKpCase } from "../types";

/**
 * A resident's own Katarungang Pambarangay record.
 *
 * FOUR TABLES OVER ONE FETCH, chosen by the address:
 *
 *   Cases I Filed    — complaints they brought
 *   Cases Against Me — complaints naming them; they will be summoned
 *   Hearings         — ONE ROW PER CASE, the next sitting; the rest in a modal
 *   Case History     — ONE ROW PER EVENT, across every case
 *
 * The two sides are two entries because they are two different pieces of
 * news. "Somebody filed a complaint against me" is what a person opens the
 * portal to find out, and under one heading it read as a case they had
 * brought themselves.
 *
 * Never VAWC. See Portal\CaseController for why a survivor's case is not
 * readable from a portal anybody in the house can open.
 */

type View = "filed" | "against-me" | "hearings" | "history";

type Sitting = NonNullable<PortalKpCase["hearings"]>[number];

const VIEWS: Record<View, { label: string; blurb: string; empty: string }> = {
  filed: {
    label: "Cases I Filed",
    blurb: "Complaints you brought to the Lupon, and where each one has reached.",
    empty: "You have not filed a complaint with the Lupon.",
  },
  "against-me": {
    label: "Cases Against Me",
    blurb: "View complaints filed against you and track their progress.",
    empty: "Nobody has filed a complaint against you.",
  },
  hearings: {
    label: "Hearings",
    blurb: "One line per case, showing the sitting you have to attend next.",
    empty: "No sitting has been set on any of your cases yet.",
  },
  history: {
    label: "Case History",
    blurb: "Everything that has happened on your cases, oldest first.",
    empty: "Nothing has been recorded on your cases yet.",
  },
};

/**
 * What each stage means, for somebody who has never heard the word.
 *
 * "Conciliation" is a term of art. A resident reading their own case is
 * entitled to know it means a panel rather than the captain.
 */
const STAGE_MEANS: Record<string, string> = {
  Filed: "Received. Nothing is scheduled yet.",
  Mediation: "The Punong Barangay is hearing it.",
  Conciliation: "A Lupon panel is hearing it.",
  Settled: "An agreement was reached.",
  Dismissed: "Closed without an agreement.",
  Referred: "Sent on to another office.",
};

export default function LuponRecords() {
  const { pathname } = useLocation();
  const view: View = pathname.endsWith("/hearings")
    ? "hearings"
    : pathname.endsWith("/history")
      ? "history"
      : pathname.endsWith("/against-me")
        ? "against-me"
        : "filed";

  const [cases, setCases] = useState<PortalKpCase[]>([]);
  const [loading, setLoading] = useState(true);
  /** The case whose full schedule is open, or null. */
  const [viewing, setViewing] = useState<PortalKpCase | null>(null);

  useEffect(() => {
    portalApi.cases()
      .then((r) => setCases(r.data.data.kp_cases ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const chosen = VIEWS[view];

  /* `my_role` is worked out per case by the server, so this is a filter
     rather than a second fetch. */
  const shown = cases.filter((c) =>
    view === "against-me" ? c.my_role === "Respondent" : c.my_role === "Complainant",
  );

  /*
   * The hearings table is ONE ROW PER CASE.
   *
   * Listing every sitting made a resident with two cases read six rows to
   * answer "where do I have to be?". Only cases that have a calendar appear;
   * the whole schedule is behind View.
   */
  const withSittings = cases.filter((c) => (c.hearings ?? []).length > 0);

  /* Every event across every case, oldest first, each still naming its case. */
  const history = cases
    .flatMap((c) =>
      (c.history ?? []).map((e, i) => ({
        ...e,
        key: `${c.case_number}-${i}`,
        case_number: c.case_number,
        title: c.title,
      })),
    )
    .sort((a, b) => a.on.localeCompare(b.on));

  return (
    <div>
      <PageHeader title={chosen.label} subtitle={chosen.blurb} />

      {loading ? (
        <Card>
          <RowsSkeleton rows={4} what="your Lupon record" />
        </Card>
      ) : (
        <Card>
          {view === "hearings" ? (
            <DataTable
              numbered
              columns={[
                { header: "Case", render: (c: PortalKpCase) => <CaseCell row={c} /> },
                {
                  header: "Next hearing",
                  render: (c: PortalKpCase) =>
                    c.next_hearing ? (
                      <div className="leading-tight">
                        <span className="whitespace-nowrap text-sm font-medium text-dark">
                          {formatWallClock(c.next_hearing.scheduled_at, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {c.next_hearing.type}
                          {c.next_hearing.type === "Mediation"
                            ? " · Punong Barangay"
                            : " · Lupon panel"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">None ahead</span>
                    ),
                },
                {
                  header: "Hearing status",
                  render: (c: PortalKpCase) => {
                    /* The sitting that matters: the one coming, or the last
                       one held if nothing is ahead. */
                    const sittings = c.hearings ?? [];
                    const next = sittings.find((h) => h.status === "Scheduled");
                    const which = next ?? sittings[sittings.length - 1];

                    return which ? (
                      <div className="leading-tight">
                        <StatusBadge status={which.status} />
                        <span className="mt-1 block text-xs text-gray-500">
                          {sittings.filter((h) => h.status === "Completed").length} of{" "}
                          {sittings.length} held
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    );
                  },
                },
                {
                  /*
                   * THEIR attendance, not both sides'. Null means the sitting
                   * has not been minuted — which is not "did not attend", and
                   * saying so would accuse somebody of missing a hearing the
                   * office simply has not written up yet.
                   */
                  header: "Attendance",
                  render: (c: PortalKpCase) => {
                    const held = (c.hearings ?? []).filter((h) => h.status === "Completed");
                    const minuted = held.filter(
                      (h) => h.i_attended !== null && h.i_attended !== undefined,
                    );

                    if (minuted.length === 0) {
                      return <span className="text-xs text-gray-400">Not recorded yet</span>;
                    }

                    const attended = minuted.filter((h) => h.i_attended).length;

                    return (
                      <span
                        className={`whitespace-nowrap text-xs font-semibold ${
                          attended === minuted.length ? "text-success" : "text-danger"
                        }`}
                      >
                        Attended {attended} of {minuted.length}
                      </span>
                    );
                  },
                },
                {
                  header: "Action",
                  render: (c: PortalKpCase) => (
                    <button
                      type="button"
                      onClick={() => setViewing(c)}
                      className="cursor-pointer whitespace-nowrap rounded-full border border-primary/40 px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                    >
                      View schedule
                    </button>
                  ),
                },
              ]}
              rows={withSittings}
              rowKey={(c) => c.case_number}
              emptyMessage={VIEWS.hearings.empty}
            />
          ) : view === "history" ? (
            <DataTable
              numbered
              columns={[
                {
                  header: "Date",
                  render: (e: (typeof history)[number]) => (
                    <span className="whitespace-nowrap font-medium text-dark">
                      {new Date(e.on).toLocaleDateString("en-PH")}
                    </span>
                  ),
                },
                {
                  header: "Event",
                  render: (e: (typeof history)[number]) => (
                    <span className="whitespace-nowrap text-sm text-dark">{e.event}</span>
                  ),
                },
                {
                  header: "Status",
                  render: (e: (typeof history)[number]) => <StatusBadge status={e.status} />,
                },
                {
                  header: "Description",
                  render: (e: (typeof history)[number]) => (
                    <span className="text-sm text-gray-600">{e.description}</span>
                  ),
                },
                {
                  header: "Case",
                  render: (e: (typeof history)[number]) => (
                    <div className="leading-tight">
                      <span className="text-sm text-gray-600">{e.title}</span>
                      <span className="block font-mono text-[11px] text-gray-400">
                        {e.case_number}
                      </span>
                    </div>
                  ),
                },
              ]}
              rows={history}
              rowKey={(e) => e.key}
              emptyMessage={VIEWS.history.empty}
            />
          ) : (
            <DataTable
              numbered
              columns={[
                { header: "Case", render: (c: PortalKpCase) => <CaseCell row={c} /> },
                {
                  /* Named from the reader's side: on their own complaint the
                     other party is who it is AGAINST; on one brought against
                     them it is who FILED it. */
                  header: view === "against-me" ? "Filed by" : "Against",
                  render: (c: PortalKpCase) => (
                    <span className="text-sm text-dark">{c.other_party || "—"}</span>
                  ),
                },
                {
                  header: "Date filed",
                  render: (c: PortalKpCase) => (
                    <span className="whitespace-nowrap text-sm text-gray-600">
                      {c.date_filed ? new Date(c.date_filed).toLocaleDateString("en-PH") : "—"}
                    </span>
                  ),
                },
                {
                  header: "Status",
                  render: (c: PortalKpCase) => (
                    <div className="leading-tight">
                      <StatusBadge status={c.stage} />
                      <span className="mt-1 block text-xs text-gray-500">
                        {STAGE_MEANS[c.stage] ?? ""}
                      </span>
                    </div>
                  ),
                },
                {
                  header: "Next step",
                  render: (c: PortalKpCase) =>
                    c.next_hearing ? (
                      <div className="leading-tight">
                        <span className="text-xs font-semibold text-primary">
                          Appear at the {c.next_hearing.type.toLowerCase()}
                        </span>
                        <span className="block text-xs text-gray-600">
                          {formatWallClock(c.next_hearing.scheduled_at, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    ) : c.settlement ? (
                      <span className="text-xs text-success">
                        Settled {c.settlement.agreed_on} — nothing further
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">
                        Nothing set. The office will send word.
                      </span>
                    ),
                },
              ]}
              rows={shown}
              rowKey={(c) => c.case_number}
              emptyMessage={chosen.empty}
            />
          )}
        </Card>
      )}

      {/* The whole schedule of one case, off the main table. */}
      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.title} · ${viewing.case_number}` : "Hearing schedule"}
        wide
      >
        <div className="p-5">
          {viewing && (viewing.hearings ?? []).length > 0 ? (
            <DataTable
              numbered
              columns={[
                {
                  header: "When",
                  render: (h: Sitting) => (
                    <span className="whitespace-nowrap font-medium text-dark">
                      {formatWallClock(h.scheduled_at, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  ),
                },
                {
                  header: "Sitting",
                  render: (h: Sitting) => (
                    <div className="leading-tight">
                      <span className="text-sm text-dark">{h.type}</span>
                      <span className="block text-xs text-gray-500">
                        {h.type === "Mediation"
                          ? "With the Punong Barangay"
                          : "With the Lupon panel"}
                      </span>
                    </div>
                  ),
                },
                { header: "Status", render: (h: Sitting) => <StatusBadge status={h.status} /> },
                {
                  header: "Summons",
                  render: (h: Sitting) =>
                    h.summons_served ? (
                      <span className="whitespace-nowrap text-xs text-gray-600">
                        Served {h.summons_served}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    ),
                },
                {
                  header: "You attended",
                  render: (h: Sitting) =>
                    h.i_attended === null || h.i_attended === undefined ? (
                      <span className="text-xs text-gray-400">
                        {h.status === "Scheduled" ? "Not yet held" : "Not recorded"}
                      </span>
                    ) : h.i_attended ? (
                      <span className="text-xs font-semibold text-success">Yes</span>
                    ) : (
                      <span className="text-xs font-semibold text-danger">No</span>
                    ),
                },
              ]}
              rows={viewing.hearings ?? []}
              rowKey={(h) => `${h.type}-${h.scheduled_at}`}
              emptyMessage="No sitting is on this case."
            />
          ) : (
            <p className="flex items-center justify-center gap-2 py-8 text-center text-sm text-gray-400">
              <FiCalendar aria-hidden="true" className="h-4 w-4" />
              No sitting is on this case.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

/**
 * The case, named once.
 *
 * The classification is shown only when it ADDS something. A case titled
 * "Theft" and classified "Theft" printed the word twice, which reads as a
 * bug in the page rather than as two facts that happen to agree.
 */
function CaseCell({ row }: { row: PortalKpCase }) {
  const sameWord =
    row.classification?.trim().toLowerCase() === row.title?.trim().toLowerCase();

  return (
    <div className="leading-tight">
      <span className="font-medium text-dark">{row.title}</span>
      <span className="block text-xs text-gray-500">
        {!sameWord && row.classification && <>{row.classification} · </>}
        <span className="font-mono text-[11px] text-gray-400">{row.case_number}</span>
      </span>
    </div>
  );
}
