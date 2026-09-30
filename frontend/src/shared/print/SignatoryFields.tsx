import { useEffect, useState } from "react";
import { FiRotateCcw } from "react-icons/fi";
import { inputClasses } from "../ui/FormField";

export interface Signatory {
  key: string;
  label: string;
  /** What the roster or the barangay's settings say. */
  value: string;
}

const STORE = "report-signatories";

function readOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * The names a printed report carries, correctable before it prints.
 *
 * Each starts as the roster (Punong Barangay, Secretary) or the barangay's
 * settings (the judge, the MLGOO, the VAW Desk person) say. A correction is
 * kept on this device for the next report, and "↺" puts the official one
 * back — the roster stays the place a name is changed for good.
 */
export function useSignatories(defaults: Signatory[]) {
  const [overrides, setOverrides] = useState<Record<string, string>>(readOverrides);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(overrides));
    } catch {
      /* A private window: the correction lasts for this visit only. */
    }
  }, [overrides]);

  const names = Object.fromEntries(defaults.map((d) => [d.key, overrides[d.key] ?? d.value]));

  const set = (key: string, value: string) => setOverrides((prev) => ({ ...prev, [key]: value }));
  const reset = (key: string) =>
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  return { names, overrides, set, reset };
}

/**
 * The names a printed report carries, shown and NOT correctable here.
 *
 * For forms whose signers are fixed — the official names, as the roster and
 * the barangay's settings hold them, whatever was typed on another report on
 * this device. A wrong name is changed where it is kept, once.
 */
export function SignatoryNames({ names, note }: { names: Signatory[]; note?: string }) {
  return (
    <fieldset className="mb-4 rounded-xl bg-secondary/60 p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Names on the form</legend>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {names.map((d) => (
          <div key={d.key}>
            <dt className="mb-1 text-xs font-medium text-dark">{d.label}</dt>
            <dd className="rounded-xl border border-gray bg-white/70 px-4 py-2 text-sm text-dark" data-signatory={d.key}>
              {d.value || <span className="text-gray-400">Not set</span>}
            </dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-2 text-xs text-gray-500">{note}</p>}
    </fieldset>
  );
}

export function SignatoryFields({ defaults, state }: {
  defaults: Signatory[];
  state: ReturnType<typeof useSignatories>;
}) {
  return (
    <fieldset className="mb-4 rounded-xl bg-secondary/60 p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Names on the form</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {defaults.map((d) => (
          <label key={d.key} className="block">
            <span className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-dark">
              {d.label}
              {state.overrides[d.key] !== undefined && state.overrides[d.key] !== d.value && (
                <button
                  type="button"
                  onClick={() => state.reset(d.key)}
                  title={`Use ${d.value || "the official name"}`}
                  aria-label={`Put back ${d.value || "the official name"}`}
                  className="cursor-pointer text-primary hover:text-primary-dark"
                >
                  <FiRotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </span>
            <input
              value={state.names[d.key] ?? ""}
              onChange={(e) => state.set(d.key, e.target.value)}
              className={`${inputClasses} py-2`}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
