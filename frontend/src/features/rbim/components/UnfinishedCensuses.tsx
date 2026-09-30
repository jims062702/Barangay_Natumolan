import { useEffect, useState } from "react";
import { FiArrowRight, FiClipboard } from "react-icons/fi";
import { Link } from "react-router-dom";
import { rbimApi } from "../api";

type Draft = {
  id: number;
  census_no: string | null;
  household_head_name: string | null;
  updated_at: string | null;
  recorder?: { name: string } | null;
};

/**
 * Census forms started and not yet submitted.
 *
 * The Households table used to carry a "Census form" column, and it was the
 * only way back into a form saved half-done. With that column gone, a draft
 * would be reachable from nowhere — an interview that happened, sitting in
 * the database where nobody can finish it. So the drafts are named here,
 * where the census is started, and ONLY when there are any: an office with
 * nothing unfinished sees nothing.
 */
export default function UnfinishedCensuses() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let live = true;

    rbimApi
      .censuses({ params: { status: "Draft" } })
      .then((r) => {
        if (!live) return;
        setDrafts(r.data.data.data ?? []);
        setCount(r.data.data.counts?.Draft ?? 0);
      })
      /* Offline, or the list could not be read: say nothing rather than
         something wrong. The forms are still there when it can. */
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  if (count === 0) return null;

  /*
   * "Draft available" — the forms saved as they were typed and not yet
   * submitted. Continue Draft opens that census itself, never a new sheet.
   */
  return (
    <div className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3" data-testid="drafts-available">
      <p className="flex items-center gap-2 text-sm font-bold text-dark">
        <FiClipboard className="h-4 w-4 text-amber-700" aria-hidden="true" />
        Draft available
      </p>
      <p className="mt-0.5 text-sm text-gray-600">
        {count === 1 ? "An RBIM Census Form is" : `${count} RBIM Census Forms are`} unfinished — not yet submitted.
      </p>
      <ul className="mt-2 space-y-1.5">
        {drafts.slice(0, 5).map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2">
            <span className="text-sm text-dark">
              <span className="font-semibold">{d.census_no || "No form number yet"}</span>
              {d.household_head_name ? ` · ${d.household_head_name}` : ""}
              <span className="text-xs text-gray-500">
                {d.recorder?.name ? ` · ${d.recorder.name}` : ""}
                {d.updated_at ? ` · saved ${new Date(d.updated_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}` : ""}
              </span>
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
      {count > 5 && (
        <p className="mt-1 text-xs text-gray-500">…and {count - 5} more.</p>
      )}
    </div>
  );
}
