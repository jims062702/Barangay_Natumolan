import { FiCheck, FiDownload } from "react-icons/fi";
import { formatBirthdate } from "../../../../shared/lib/birthdate";
import SearchInput from "../../../../shared/ui/SearchInput";
import { inputClasses } from "../../../../shared/ui/FormField";
import { SECTORS } from "./options";
import { useZoneNames } from "../../../population/lib/useZones";
import type { RegisterTransferState } from "../../hooks/useRegisterTransfer";

/**
 * Taking the register out as a spreadsheet, narrowed or whole.
 */
export function ExportSection({ ctx }: { ctx: RegisterTransferState }) {
  const {
    setWho, who, search, setSearch, purok, setPurok, sector, setSector, counting, matchCount,
    matches, setFormat, format, busy, runExport,
  } = ctx;
  const zones = useZoneNames();

  return (
    <section className="space-y-4">
      <p className="text-xs leading-relaxed text-gray-500">
        A backup, or the barangay&rsquo;s data for somebody who asked for it. Narrow it
        down first, or take the lot — and check the names below before you do.
      </p>

      {/*
        Who. Three answers, because "residents" and "everybody" are not
        the same question and the third — non-residents alone — is the
        one somebody asks when they want the family members recorded
        from outside the barangay.
      */}
      <div>
        <p className="mb-1.5 text-sm font-medium text-dark">Who to include</p>
        <div className="flex flex-wrap gap-2">
          {([
            { value: "residents", label: "Residents" },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setWho(option.value)}
              aria-pressed={who === option.value}
              className="cursor-pointer rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/*
        The same three filters the registry list has, so what a clerk
        searched for on screen is what they can take away.
      */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SearchInput
          value={search}
          onChange={(value) => setSearch(value)}
          placeholder="Search by Name or Resident Number…"
          label="Search"
          className="max-w-sm flex-1"
        />
        <select
          value={purok}
          onChange={(e) => setPurok(e.target.value)}
          aria-label="Zone / Purok"
          className={inputClasses}
        >
          <option value="">Zone: All</option>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          aria-label="Sector"
          className={inputClasses}
        >
          <option value="">Sector: All</option>
          {SECTORS.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>

      {/*
        Who is actually in the file.

        A count alone answers "how many" and not "which" — and "which" is
        the question somebody has when they typed a surname and eight
        people share it. Seeing the names is the only chance anybody gets
        to notice they are about to hand out the wrong eight.
      */}
      <div className="rounded-xl border border-gray bg-secondary/40 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-dark">
            {counting ? (
              <span className="text-gray-500">Counting…</span>
            ) : (
              <>
                <span className="font-bold">{matchCount ?? 0}</span>{" "}
                <span className="text-gray-500">
                  {matchCount === 1 ? "record matches" : "records match"}
                </span>
              </>
            )}
          </p>
          {(search || purok || sector) && (
            <button
              type="button"
              onClick={() => { setSearch(""); setPurok(""); setSector(""); }}
              className="cursor-pointer rounded-full border border-gray bg-white px-4 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:border-primary hover:text-primary"
            >
              Clear filters
            </button>
          )}
        </div>

        {!counting && matches.length > 0 && (
          <ul className="divide-y divide-gray/60 rounded-lg bg-white">
            {matches.map((person) => (
              <li key={person.id} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2">
                <span className="font-medium text-dark">
                  {person.last_name}, {person.first_name}
                  {person.middle_name ? ` ${person.middle_name}` : ""}
                </span>
                <span className="text-xs text-gray-400">{person.resident_number}</span>
                {person.zone_purok && (
                  <span className="text-xs text-gray-400">{person.zone_purok}</span>
                )}
                {person.birthdate && (
                  <span className="ml-auto text-xs text-gray-400">
                    born {formatBirthdate(person.birthdate, person.birthdate_is_estimated)}
                  </span>
                )}
              </li>
            ))}

            {/*
              Named exactly. "and more" leaves the reader guessing whether
              it is two or two thousand, which is the number that decides
              whether they check.
            */}
            {(matchCount ?? 0) > matches.length && (
              <li className="px-3 py-2 text-xs text-gray-500">
                …and {(matchCount ?? 0) - matches.length} more, all in the file.
              </li>
            )}
          </ul>
        )}

        {!counting && matchCount === 0 && (
          <p className="rounded-lg bg-white px-3 py-3 text-sm text-gray-400">
            Nobody matches these filters. Nothing would be in the file.
          </p>
        )}
      </div>

      {/*
        Two formats, and CSV stays the default.

        CSV is the one every spreadsheet on earth opens, and a file the
        office cannot open is not a backup. But a clerk who is only ever
        going to open this in Excel should not answer an import dialogue
        about delimiters every time, so the other is right there.
      */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1.5 text-sm font-medium text-dark">File format</p>
          <div className="flex flex-wrap gap-2">
            {([
              { value: "csv", label: "CSV", note: "Opens anywhere" },
              { value: "xlsx", label: "Excel", note: ".xlsx" },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormat(option.value)}
                aria-pressed={format === option.value}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                  format === option.value
                    ? "bg-primary text-white"
                    : "bg-secondary text-dark hover:bg-primary/10"
                }`}
              >
                {format === option.value && (
                  <FiCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                {option.label}
                <span className="font-normal opacity-70">{option.note}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={busy || counting || !matchCount}
          onClick={runExport}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          <FiDownload className="h-4 w-4" aria-hidden="true" />
          {matchCount
            ? `Export ${matchCount} as ${format === "xlsx" ? "Excel" : "CSV"}`
            : "Nothing to export"}
        </button>
      </div>
    </section>
  );
}
