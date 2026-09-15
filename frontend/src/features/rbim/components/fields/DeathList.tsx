import { FiX, FiPlus } from "react-icons/fi";
import { inputClasses } from "../../../../shared/ui/FormField";
import { onlyDigits } from "../../lib/format";
import { CharsLeft } from "./CharsLeft";
import type { DeathRow } from "../../types";

/**
 * Q54 and Q55 - deaths in the household in the past twelve months.
 *
 * The paper has room for one of each, and a household that lost two people
 * had nowhere to say so. Recorded as one, the second death simply never
 * happened as far as the barangay's own figures are concerned - and these are
 * the figures a maternal or under-five death is noticed in.
 */
export function DeathList({
  label,
  hint,
  rows,
  onChange,
  addLabel,
  maxAge,
  sexes,
}: {
  label: string;
  hint?: string;
  rows: DeathRow[];
  onChange: (next: DeathRow[]) => void;
  addLabel: string;
  maxAge: number;
  /** Only Q55 asks the sex; Q54 is about a woman by definition. */
  sexes?: Record<string, string>;
}) {
  const at = (i: number, patch: Partial<DeathRow>) =>
    onChange(rows.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <p className="mb-1.5 text-sm font-medium text-dark">{label}</p>
      {hint && <p className="mb-2 text-xs text-gray-400">{hint}</p>}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray px-3 py-3 text-xs text-gray-400">
          None reported.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="w-5 shrink-0 text-xs font-semibold text-gray-400">{i + 1}.</span>

              <input
                type="text"
                inputMode="numeric"
                placeholder="Age"
                value={row.age ?? ""}
                onChange={(e) => {
                  const only = onlyDigits(e.target.value, 3);
                  if (only !== "" && Number(only) > maxAge) return;
                  at(i, { age: only });
                }}
                className={`${inputClasses} w-20 shrink-0`}
              />

              {sexes && (
                <select
                  value={row.sex ?? ""}
                  onChange={(e) => at(i, { sex: e.target.value })}
                  className={`${inputClasses} w-32 shrink-0`}
                >
                  <option value="">Sex</option>
                  {Object.entries(sexes).map(([code, text]) => (
                    <option key={code} value={code}>
                      {code} · {text}
                    </option>
                  ))}
                </select>
              )}

              <span className="min-w-40 flex-1">
                <input
                  type="text"
                  maxLength={80}
                  placeholder="Cause of death"
                  value={row.cause ?? ""}
                  onChange={(e) => at(i, { cause: e.target.value })}
                  className={inputClasses}
                />
                <CharsLeft value={row.cause} max={80} />
              </span>

              <button
                type="button"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                aria-label={`Remove line ${i + 1}`}
                className="shrink-0 cursor-pointer rounded-lg p-2 text-gray-400 transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <FiX className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onChange([...rows, { age: "", cause: "" }])}
        className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
      >
        <FiPlus className="h-3.5 w-3.5" aria-hidden="true" />
        {addLabel}
      </button>
    </div>
  );
}
