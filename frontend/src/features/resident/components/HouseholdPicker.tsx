import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiSearch, FiX } from "react-icons/fi";
import { inputClasses } from "../../../shared/ui/FormField";
import SearchInput from "../../../shared/ui/SearchInput";
import type { Household } from "../../../shared/types";
import { residentApi } from "../api";

/** "HH-2026-0003 · Purok 3 · Owner: Juan Dela Cruz" */
export function householdLabel(h: Household): string {
  const owner = h.head ? `${h.head.first_name} ${h.head.last_name}` : "no owner set";
  return `${h.household_number} · ${h.zone_purok ?? "—"} · Owner: ${owner}`;
}

interface Props {
  /** Selected household_id as a string ("" = none). */
  value: string;
  /** The selected household object, used to show its label. */
  selected: Household | null;
  onSelect: (household: Household | null) => void;
  /** Optional "+ Register new household" action shown in the panel footer. */
  onAddNew?: () => void;
  placeholder?: string;
}

/**
 * Searchable household combobox. Instead of dumping every household into a
 * native <select> (which does not scale to a 20k+ registry — huge payload,
 * thousands of DOM nodes, endless scrolling), it queries the server as the
 * user types and only ever renders a small, capped result set.
 */
export default function HouseholdPicker({ value, selected, onSelect, onAddNew, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Household[]>([]);
  const [loading, setLoading] = useState(false);
  /** True while the list on screen came off this device, not the server. */
  const [offline, setOffline] = useState(false);
  /** The last unfiltered page the server gave, to search with no line. */
  const held = useRef<Household[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside the widget.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Debounced server search while the panel is open (empty q = first page).
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      residentApi.householdOptions({ params: query.trim() ? { q: query.trim() } : {} })
        .then((r) => {
          if (!active) return;
          const rows = (r.data.data ?? []) as Household[];
          setResults(rows);
          /* Kept so a search with no line can narrow THESE rather than
             empty the list. Only the unfiltered page: it is the only one
             that stands for "the households this device has seen". */
          if (!query.trim()) held.current = rows;
          setOffline(false);
        })
        .catch((error) => {
          if (!active) return;
          /*
           * A refusal is the server talking and the old behaviour — an
           * empty list — is right for it. A request that never arrived is
           * not: emptying the list there told a clerk registering someone
           * with no line that the household does not exist.
           *
           * The register the device holds carries no household links (see
           * OfflineSyncController), so there is nothing fuller to search.
           * What there is gets searched, and the panel says as much.
           */
          if ((error as { response?: unknown })?.response) {
            setResults([]);
            setOffline(false);
            return;
          }
          const term = query.trim().toLowerCase();
          setResults(term
            ? held.current.filter((h) => householdLabel(h).toLowerCase().includes(term))
            : held.current);
          setOffline(true);
        })
        .finally(() => active && setLoading(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, open]);

  const openPanel = () => {
    setOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const choose = (h: Household | null) => {
    onSelect(h);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={boxRef} className="relative">
      {/* Trigger showing the current selection */}
      <button
        type="button"
        onClick={open ? () => setOpen(false) : openPanel}
        className={`${inputClasses} flex w-full cursor-pointer items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${selected ? "text-dark" : "text-gray-400"}`}>
          {selected ? householdLabel(selected) : placeholder ?? "Search by household number, street or owner…"}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {selected && (
            <FiX
              aria-label="Clear household"
              className="text-gray-400 hover:text-danger"
              onClick={(e) => {
                e.stopPropagation();
                choose(null);
              }}
            />
          )}
          <FiChevronDown className="text-gray-400" />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-2xl border border-gray bg-white p-2 shadow-lg">
          <div className="relative mb-2">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search by household number, street or owner…"
            />
          </div>

          {offline && (
            <p className="mb-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-[11px] leading-relaxed text-gray-600">
              No connection — only the households already opened on this device can be searched.
              The rest come back with the line.
            </p>
          )}

          <div className="max-h-64 overflow-auto">
            <button
              type="button"
              onClick={() => choose(null)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary ${
                !value ? "font-semibold text-primary" : "text-gray-500"
              }`}
            >
              — No household —
            </button>

            {loading ? (
              <p className="px-3 py-3 text-center text-xs text-gray-400">Searching…</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-3 text-center text-xs text-gray-400">
                {query.trim() ? "No matching households." : "No households yet."}
              </p>
            ) : (
              results.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => choose(h)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary ${
                    String(h.id) === value ? "bg-secondary font-semibold text-primary" : "text-dark"
                  }`}
                >
                  {householdLabel(h)}
                </button>
              ))
            )}
          </div>

          {onAddNew && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAddNew();
              }}
              className="mt-2 w-full cursor-pointer rounded-lg border border-primary/40 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
            >
              + Register new household
            </button>
          )}
        </div>
      )}
    </div>
  );
}
