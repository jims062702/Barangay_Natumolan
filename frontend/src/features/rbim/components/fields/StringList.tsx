import { FiX, FiPlus } from "react-icons/fi";
import { inputClasses } from "../../../../shared/ui/FormField";
import { CharsLeft } from "./CharsLeft";

/**
 * A question the paper gives three blanks and life sometimes gives more.
 *
 * Q56 and Q57 are printed with three lines each. Three is what fits on the
 * page, not what a household has to say, so rows are added as they are needed
 * and the empty ones are never sent.
 */
export function StringList({
  label,
  hint,
  placeholder,
  values,
  onChange,
  addLabel,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  values: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
}) {
  const rows = values.length ? values : [""];

  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <p className="mb-1.5 text-sm font-medium text-dark">{label}</p>
      {hint && <p className="mb-2 text-xs text-gray-400">{hint}</p>}

      <div className="space-y-2">
        {rows.map((one, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-3 w-5 shrink-0 text-xs font-semibold text-gray-400">{i + 1}.</span>
            <span className="min-w-0 flex-1">
              <input
                type="text"
                maxLength={80}
                value={one}
                placeholder={placeholder}
                onChange={(e) => onChange(rows.map((old, j) => (j === i ? e.target.value : old)))}
                className={inputClasses}
              />
              <CharsLeft value={one} max={80} />
            </span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                aria-label={`Remove line ${i + 1}`}
                className="mt-1.5 shrink-0 cursor-pointer rounded-lg p-2 text-gray-400 transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <FiX className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...rows, ""])}
        className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
      >
        <FiPlus className="h-3.5 w-3.5" aria-hidden="true" />
        {addLabel}
      </button>
    </div>
  );
}
