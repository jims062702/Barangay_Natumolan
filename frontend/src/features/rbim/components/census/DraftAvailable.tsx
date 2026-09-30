import { useEffect, useState } from "react";
import { FiArrowRight, FiClipboard } from "react-icons/fi";
import { Link } from "react-router-dom";
import { rbimApi } from "../../api";

type Draft = {
  id: number;
  census_no: string | null;
  household_head_name: string | null;
  updated_at: string | null;
};

/**
 * "Draft available" — at the top of a NEW census form, when this account
 * already has one it has not finished.
 *
 * Continue Draft opens THAT census (its own record, the one the form saved
 * as it was typed), never a new blank sheet. Starting a new form anyway is
 * the form below — a different household is a different sheet.
 */
export function DraftAvailable() {
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    let live = true;
    rbimApi
      .censuses({ params: { status: "Draft", mine: 1 } })
      .then((r) => {
        if (live) setDrafts(r.data.data.data ?? []);
      })
      /* Offline, or unreadable: nothing is claimed. */
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, []);

  if (drafts.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3" data-testid="draft-available">
      <p className="flex items-center gap-2 text-sm font-bold text-dark">
        <FiClipboard className="h-4 w-4 text-primary" aria-hidden="true" /> Draft available
      </p>
      <p className="mt-1 text-sm text-gray-600">
        You have {drafts.length === 1 ? "an unfinished RBIM Census Form" : `${drafts.length} unfinished RBIM Census Forms`}.
        Continue where you left off — or start a new household's form below.
      </p>
      <ul className="mt-2 space-y-1.5">
        {drafts.slice(0, 3).map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
            <span className="text-sm text-dark">
              <span className="font-semibold">{d.census_no || "No form number yet"}</span>
              {d.household_head_name ? ` · ${d.household_head_name}` : ""}
              {d.updated_at && (
                <span className="text-xs text-gray-500"> · saved {new Date(d.updated_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</span>
              )}
            </span>
            <Link
              to={`/population/rbim/${d.id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
            >
              Continue Draft <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
