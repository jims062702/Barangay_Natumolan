import { useEffect, useRef, useState } from "react";
import SearchInput from "../../../shared/ui/SearchInput";
import { searchResidentsOffline } from "../../../shared/offline/residentCache";
import type { Resident } from "../../../shared/types";
import { residentApi } from "../api";

interface ResidentPickerProps {
  value: Resident | null;
  onChange: (resident: Resident | null) => void;
  /**
   * Residents who must not be offered — someone already named on the other
   * side of the same case cannot also be picked here.
   */
  excludeIds?: number[];
  /**
   * Leave out people who live outside the barangay.
   *
   * For anything the barangay ISSUES. A certificate says something about a
   * constituent, and a non-resident is on the register only so a family could
   * be recorded whole — offering them here invites a false document with a
   * real reference number on it. The server refuses either way; this stops
   * the clerk getting that far.
   */
  residentsOnly?: boolean;
  /**
   * ONLY people who live outside the barangay.
   *
   * The other side of `residentsOnly`, for the one question where a
   * non-resident is the right answer: naming a parent who lives elsewhere
   * and is already on file, so a second child by the same mother does not
   * mean typing her in again \u2014 and does not create a duplicate of her.
   */
  nonResidentsOnly?: boolean;
  /**
   * Only women, or only men — asked of the SERVER, where the limit is
   * applied, and checked again there when the record is saved. For a mother:
   * the health station's forms look for women only.
   */
  gender?: "Female" | "Male";
  /** Minimum age of resident in years (e.g. 5) */
  minAge?: number;
  /** Maximum age of resident in years (e.g. 51 means < 51) */
  maxAge?: number;
  /** What to say when nobody matches — who to see, for a form that cannot add a person itself. */
  notFound?: string;
  /** The search box's own words. */
  placeholder?: string;
}

const fullName = (r: Resident) =>
  [r.first_name, r.middle_name, r.last_name, r.suffix].filter(Boolean).join(" ");

const ageOf = (birthdate?: string | null) => {
  if (!birthdate) return null;
  const born = new Date(birthdate);
  const diff = Date.now() - born.getTime();
  return Math.floor(diff / 31557600000); // ms per average year
};

/**
 * What tells two namesakes apart: age and purok. Shown under every option so
 * picking the right "Juan Dela Cruz" doesn't depend on memorising numbers.
 */
const distinguisher = (r: Resident) => {
  const age = ageOf(r.birthdate);
  const isMinor = age !== null && age < 18;
  /*
   * The two facts that change what a clerk should do with the person they
   * just picked: someone who has died should not be having a certificate
   * filed for them, and someone who lives elsewhere is not a constituent.
   * Both are easy to miss when the names look identical.
   */
  const flag =
    r.life_status === "Deceased"
      ? "DECEASED"
      : r.record_type === "Non-resident"
        ? "Lives outside the barangay"
        : null;

  const ageLabel = isMinor ? `Minor (${age} yrs · Under 18)` : age !== null ? `${age} yrs` : null;

  return [flag, ageLabel, r.zone_purok].filter(Boolean).join(" · ");
};

/** Search-as-you-type resident selector (uses /residents/search). */
export default function ResidentPicker({
  value,
  onChange,
  excludeIds = [],
  residentsOnly = false,
  nonResidentsOnly = false,
  gender,
  minAge,
  maxAge,
  notFound,
  placeholder = "Search by Name or Resident Number…",
}: ResidentPickerProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  // Keeps a slow earlier response from overwriting a newer one.
  const latest = useRef(0);

  // Searches from the very first letter — a clerk typing "B" should already
  // see the B names rather than waiting for a second character.
  useEffect(() => {
    const term = query.trim();
    if (term.length === 0) {
      setOptions([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const seq = ++latest.current;
    const recordType = residentsOnly ? "Resident" : nonResidentsOnly ? "Non-resident" : undefined;

    const timer = setTimeout(() => {
      /*
       * The device's copy answers FIRST, and the server corrects it.
       */
      void searchResidentsOffline(term, { recordType, gender })
        .then((rows) => {
          if (seq !== latest.current) return;
          setOptions(rows as Resident[]);
          setSearched(true);
        })
        .catch(() => {
          /* No IndexedDB. The server request below is the only hope. */
        });

      residentApi.search({
          params: {
            q: term,
            record_type: recordType,
            gender,
            min_age: minAge,
            max_age: maxAge,
          },
          timeout: 8000,
        })
        .then((r) => {
          if (seq !== latest.current) return;
          setOptions((r.data.data ?? []) as Resident[]);
        })
        .catch(() => {
          /*
           * Left alone.
           */
        })
        .finally(() => {
          if (seq !== latest.current) return;
          setLoading(false);
          setSearched(true);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, residentsOnly, nonResidentsOnly, gender, minAge, maxAge]);

  const visible = options.filter(
    (o) => {
      if (excludeIds.includes(o.id)) return false;
      if (residentsOnly && o.record_type === "Non-resident") return false;
      if (nonResidentsOnly && o.record_type !== "Non-resident") return false;
      if (gender && (o.gender || "").toLowerCase() !== gender.toLowerCase()) return false;
      const age = ageOf(o.birthdate);
      if (minAge !== undefined && (age === null || age < minAge)) return false;
      if (maxAge !== undefined && (age === null || age >= maxAge)) return false;
      return true;
    }
  );

  if (value) {
    const age = ageOf(value.birthdate);
    const isMinor = age !== null && age < 18;
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2.5 text-sm">
        {/*
          The distinguisher stays after the pick, not only during it.

          The dropdown shows age and purok under every option so two people
          called James Gasang can be told apart — and then the chip that
          replaced it showed the name alone, so the one fact that separated
          them disappeared at the exact moment it became the answer. Naming
          the wrong namesake as a respondent is how a summons reaches the
          wrong house.
        */}
        <span className="min-w-0 font-medium text-dark">
          {fullName(value)}
          {value.resident_number && <span className="text-xs text-gray-500"> ({value.resident_number})</span>}
          {isMinor && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              Minor (Age: {age}) · Parent/Guardian Required
            </span>
          )}
          {distinguisher(value) && (
            <span className="block text-xs font-normal text-gray-500">{distinguisher(value)}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="cursor-pointer text-xs font-semibold text-danger hover:underline"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder={placeholder}
        label="Search residents"
      />
      {loading && (
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          Searching…
        </span>
      )}
      {visible.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray bg-white shadow-lg">
          {visible.map((resident) => (
            <li key={resident.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(resident);
                  setQuery("");
                  setOptions([]);
                }}
                className="w-full cursor-pointer px-3.5 py-2.5 text-left text-sm hover:bg-primary/5"
              >
                <span className="block">
                  <span className="font-medium text-dark">{fullName(resident)}</span>{" "}
                  <span className="text-xs text-gray-500">{resident.resident_number}</span>
                </span>
                {distinguisher(resident) && (
                  <span className="block text-xs text-gray-400">{distinguisher(resident)}</span>
                )}
              </button>
            </li>
          ))}
          {/*
            A full list means the cut-off was reached, and somebody who
            matched may be below it. Without this the clerk reads a list
            that ends and concludes the person is not registered — which is
            exactly what happened: "james" filled all the slots with three
            people and James Gasang, on the register, never appeared.
          */}
          {options.length >= 25 && (
            <li className="border-t border-gray bg-secondary/40 px-3.5 py-2 text-xs text-gray-500">
              More residents match “{query.trim()}”. Type more — a last name
              or resident number — to narrow the list.
            </li>
          )}
        </ul>
      )}
      {searched && !loading && visible.length === 0 && (
        <p className="absolute z-20 mt-1 w-full rounded-xl border border-gray bg-white px-3.5 py-2.5 text-xs text-gray-400 shadow-lg">
          No resident matches “{query.trim()}”.
          {notFound && <span className="mt-1 block text-gray-500">{notFound}</span>}
        </p>
      )}
    </div>
  );
}
