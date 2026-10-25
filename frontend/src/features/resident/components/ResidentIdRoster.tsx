import { useEffect, useMemo, useState } from "react";
import { FiCheckSquare, FiCreditCard, FiDownload, FiRefreshCw, FiUsers } from "react-icons/fi";
import { Link } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/api";
import { confirmAction, confirmWithReason } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import type { ResidentCardData } from "../../../shared/residentCard/drawCard";
import { downloadResidentCard } from "../../../shared/residentCard/downloadCard";
import { residentApi } from "../api";

export interface RosterPerson {
  id: number;
  name: string;
  /** Under the name: resident number, age, a census line. */
  detail?: string;
  /** What they are to the household — "Head", "Son". */
  badge?: string;
  highlight?: boolean;
}

interface Standing {
  resident_id: number;
  found: boolean;
  eligible: boolean;
  card: ResidentCardData | null;
  issued_count: number;
}

const issuedOn = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-PH", { dateStyle: "medium" }) : "");

/**
 * Resident IDs for a list of people at once — a census form's people, a
 * household's members.
 *
 * WHAT EACH ONE HOLDS IS THE SERVER'S ANSWER, not a guess from a file on the
 * device: somebody with an active card shows Download and Issue a New Card;
 * somebody without one shows Issue Resident ID. Issuing to "all eligible" or
 * to a selection sends only the people without a card, and the server skips
 * anybody who turns out to have one — nobody is ever given a second active
 * card from here.
 */
export function ResidentIdRoster({ people, heading = "Resident IDs", renderExtraActions }: { people: RosterPerson[]; heading?: string; renderExtraActions?: (person: RosterPerson) => React.ReactNode }) {
  const [standing, setStanding] = useState<Record<number, Standing>>({});
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | "bulk" | null>(null);
  const ids = useMemo(() => people.map((p) => p.id), [people]);
  const key = ids.join(",");

  const load = () => {
    if (ids.length === 0) {
      setLoaded(true);
      return;
    }
    residentApi.cardStanding({ params: { ids } })
      .then((r) => {
        const map: Record<number, Standing> = {};
        (r.data.data as Standing[]).forEach((s) => { map[s.resident_id] = s; });
        setStanding(map);
        setSelected((was) => new Set([...was].filter((id) => map[id]?.eligible && !map[id]?.card)));
      })
      .catch((err) => toast(errorMessage(err), "error"))
      .finally(() => setLoaded(true));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [key]);

  const without = people.filter((p) => standing[p.id]?.eligible && !standing[p.id]?.card);
  const withCard = people.filter((p) => standing[p.id]?.card);

  const issueOne = async (person: RosterPerson) => {
    if (!(await confirmAction({
      title: "Issue Resident ID?",
      text: `This will issue a Barangay Resident Identification Card for ${person.name}. Continue?`,
      confirmText: "Issue ID",
    }))) return;
    setBusy(person.id);
    try {
      const r = await residentApi.issueResidentCard(person.id);
      toast(r.data.message);
    } catch (err) {
      /* 409: they already hold one — shown now, with Download. */
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
      load();
    }
  };

  const reissue = async (person: RosterPerson) => {
    const reason = await confirmWithReason({
      title: "Issue a new card?",
      text: `${person.name}'s current card will stop working the moment the new one is issued. Its record stays in the history.`,
      placeholder: "Why? e.g. lost, damaged, details changed (optional)",
      confirmText: "Issue a new card",
      optional: true,
    });
    if (reason === null) return;
    setBusy(person.id);
    try {
      const r = await residentApi.reissueResidentCard(person.id, { reason: reason || undefined });
      toast(r.data.message);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
      load();
    }
  };

  const issueMany = async (targets: RosterPerson[]) => {
    if (targets.length === 0) return;
    if (!(await confirmAction({
      title: "Issue Resident IDs?",
      text: `You are about to issue Resident IDs to ${targets.length} eligible ${targets.length === 1 ? "member" : "members"}. Residents who already have an active ID will be skipped.`,
      confirmText: "Issue IDs",
    }))) return;
    setBusy("bulk");
    try {
      const r = await residentApi.issueCards({ resident_ids: targets.map((t) => t.id) });
      toast(r.data.message);
      setSelected(new Set());
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
      load();
    }
  };

  const download = async (person: RosterPerson) => {
    const card = standing[person.id]?.card;
    if (!card) return;
    setBusy(person.id);
    try {
      await downloadResidentCard(card);
    } catch {
      toast("The Resident ID could not be drawn. Please try again.", "error");
    } finally {
      setBusy(null);
    }
  };

  const toggle = (id: number) => setSelected((was) => {
    const next = new Set(was);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div data-testid="resident-id-roster">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-dark">{heading}</p>
          <p className="text-xs text-gray-500">
            {loaded
              ? `${withCard.length} of ${people.length} hold an active ID · ${without.length} still to issue`
              : "Checking who already holds an ID…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => issueMany(without.filter((p) => selected.has(p.id)))}
            disabled={busy !== null || selected.size === 0}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-primary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FiCheckSquare className="h-3.5 w-3.5" aria-hidden="true" /> Issue IDs to selected ({selected.size})
          </button>
          <button
            type="button"
            onClick={() => issueMany(without)}
            disabled={busy !== null || without.length === 0}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FiUsers className="h-3.5 w-3.5" aria-hidden="true" /> Issue IDs to All Eligible ({without.length})
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {people.map((person) => {
          const s = standing[person.id];
          const card = s?.card ?? null;
          const canIssue = Boolean(s?.eligible && !card);

          return (
            /*
              The buttons keep their place on the right whatever the status
              says: the text on the left wraps inside its own column instead
              of pushing them onto a new line (a reissued card's "· 1 earlier"
              used to). On a phone the two stack, once, the same for every row.
            */
            <li
              key={person.id}
              data-testid="roster-row"
              data-resident={person.id}
              className="flex flex-col gap-3 rounded-xl border border-gray px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <input
                  type="checkbox"
                  aria-label={`Select ${person.name}`}
                  checked={selected.has(person.id)}
                  onChange={() => toggle(person.id)}
                  disabled={!canIssue || busy !== null}
                  className="mt-1 h-4 w-4 disabled:opacity-30"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/population/residents/${person.id}`} className="text-sm font-semibold text-primary hover:underline">
                      {person.name}
                    </Link>
                    {person.badge && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${person.highlight ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>
                        {person.badge}
                      </span>
                    )}
                  </div>
                  {person.detail && <p className="mt-0.5 text-xs text-gray-500">{person.detail}</p>}
                  <p className="mt-1 text-xs" data-testid="roster-status">
                    {!s ? (
                      <span className="text-gray-400">…</span>
                    ) : card ? (
                      <span className="font-semibold text-success">
                        ID issued · {card.card_no} · {issuedOn(card.issued_at)}
                        {s.issued_count > 1 && <span className="font-normal text-gray-500"> · {s.issued_count - 1} earlier</span>}
                      </span>
                    ) : s.eligible ? (
                      <span className="font-semibold text-warning">No Resident ID yet</span>
                    ) : (
                      <span className="text-gray-500">Not eligible — not an active resident of the barangay</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                {renderExtraActions && renderExtraActions(person)}
                {card ? (
                  <>
                    <button
                      type="button"
                      onClick={() => download(person)}
                      disabled={busy !== null}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-40"
                    >
                      <FiDownload className="h-3.5 w-3.5" aria-hidden="true" /> {busy === person.id ? "Preparing…" : "Download Resident ID"}
                    </button>
                    <button
                      type="button"
                      onClick={() => reissue(person)}
                      disabled={busy !== null}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray px-3 py-1.5 text-xs font-semibold text-dark transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                    >
                      <FiRefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Issue a New Card
                    </button>
                  </>
                ) : canIssue ? (
                  <button
                    type="button"
                    onClick={() => issueOne(person)}
                    disabled={busy !== null}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-40"
                  >
                    <FiCreditCard className="h-3.5 w-3.5" aria-hidden="true" /> {busy === person.id ? "Issuing…" : "Issue Resident ID"}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
