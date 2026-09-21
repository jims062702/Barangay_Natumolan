import { useEffect, useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import SearchInput from "../../../shared/ui/SearchInput";
import { searchResidentsOffline } from "../../../shared/offline/residentCache";
import type { Resident } from "../../../shared/types";
import { residentApi } from "../api";

interface Props {
  value: Resident[];
  onChange: (residents: Resident[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Residents named on the other side of the case — never offered here. */
  excludeIds?: number[];
  /**
   * Leave out people who live outside the barangay.
   *
   * For a RESPONDENT. Both the Lupon's jurisdiction and a barangay
   * protection order follow where the person complained of lives: a case
   * against somebody from another barangay is not this barangay's to hear,
   * and a settlement or an order made in it is one no court will honour.
   *
   * The complainant is deliberately not restricted anywhere — a person
   * wronged by a resident may complain whoever they are and wherever they
   * live. It is the respondent's residence that decides venue, and only
   * the respondent's.
   *
   * The server refuses either way; this stops the clerk getting that far
   * and filling in a whole complaint that cannot be filed.
   */
  residentsOnly?: boolean;
}

const fullName = (r: Resident) =>
  [r.first_name, r.middle_name, r.last_name, r.suffix].filter(Boolean).join(" ");

const ageOf = (birthdate?: string | null) => {
  if (!birthdate) return null;
  return Math.floor((Date.now() - new Date(birthdate).getTime()) / 31557600000);
};

/**
 * Picks several residents at once — used where a record involves more than one
 * person (VAWC dependents, multiple respondents). Selected people show as
 * removable chips so the set is visible without opening anything.
 */
export default function ResidentMultiPicker({
  value,
  onChange,
  placeholder = "Search by name or resident number…",
  disabled,
  excludeIds = [],
  residentsOnly = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length === 0) {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const seq = ++latest.current;
    const timer = setTimeout(() => {
      /*
       * The device's copy answers first, and the server corrects it — the
       * same order as ResidentPicker, and for the same reason.
       *
       * This one was left on the server alone, which made a Lupon complaint
       * half-fillable with no line: the complainant could be found and the
       * respondent could not, so the case could not be filed at all.
       */
      void searchResidentsOffline(term)
        .then((rows) => {
          if (seq === latest.current) setOptions(rows as Resident[]);
        })
        .catch(() => {
          /* No IndexedDB. The server request below is the only hope. */
        });

      residentApi.search({ params: { q: term }, timeout: 8000 })
        .then((r) => {
          if (seq === latest.current) setOptions(r.data.data ?? []);
        })
        .catch(() => {
          /* Left alone: whatever the device found is already on screen, and
             emptying it because the line is down is the failure itself. */
        })
        .finally(() => {
          if (seq === latest.current) setLoading(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const add = (resident: Resident) => {
    if (!value.some((r) => r.id === resident.id)) onChange([...value, resident]);
    setQuery("");
    setOptions([]);
  };

  const remove = (id: number) => onChange(value.filter((r) => r.id !== id));

  // Already-picked people, and anyone on the other side of the case, drop
  // out of the suggestions.
  const suggestions = options.filter(
    (o) => !value.some((r) => r.id === o.id) && !excludeIds.includes(o.id)
      && !(residentsOnly && o.record_type === "Non-resident")
  );

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 py-1 pl-3 pr-1.5 text-xs"
            >
              <span className="font-medium text-dark">{fullName(r)}</span>
              {ageOf(r.birthdate) !== null && (
                <span className="text-gray-400">{ageOf(r.birthdate)} yrs</span>
              )}
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${fullName(r)}`}
                  onClick={() => remove(r.id)}
                  className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <FiX className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={placeholder}
          label="Search residents to add"
        />
        {loading && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            Searching…
          </span>
        )}
        {suggestions.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-gray bg-white shadow-lg">
            {suggestions.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => add(r)}
                  className="w-full cursor-pointer px-3.5 py-2 text-left text-sm hover:bg-primary/5"
                >
                  <span className="block">
                    <span className="font-medium text-dark">{fullName(r)}</span>{" "}
                    <span className="text-xs text-gray-500">{r.resident_number}</span>
                  </span>
                  {(ageOf(r.birthdate) !== null || r.zone_purok) && (
                    <span className="block text-xs text-gray-400">
                      {[ageOf(r.birthdate) !== null ? `${ageOf(r.birthdate)} yrs` : null, r.zone_purok]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
