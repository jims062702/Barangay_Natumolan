import { useIsOffline } from "../offline/useConnectivity";
import { useMemo, useState, type ReactNode } from "react";
import SearchInput from "./SearchInput";

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

/** A dropdown filter: pick a value and only rows matching it are shown. */
export interface FilterDef<T> {
  label: string;
  /** The row's value for this filter (compared against the chosen option). */
  getValue?: (row: T) => string;
  /** Explicit options; if omitted, the unique values in the data are used. */
  options?: string[];
  /** Controlled value when managed by parent / server. */
  value?: string;
  /** Controlled change handler when managed by parent / server. */
  onChange?: (val: string) => void;
}

/**
 * Which page buttons to draw.
 *
 * Every page, while they fit. Past that, the first and last are always
 * reachable and a window follows the current page, with a gap marked where
 * pages were left out — a thousand buttons is not navigation.
 *
 * The window is fixed-width, so the row does not grow and shrink as the
 * clerk pages through it. A control that moves under the cursor is a control
 * that gets mis-clicked.
 */
function pageList(current: number, last: number): (number | "gap")[] {
  if (last <= 7) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, last, current]);

  // One either side of where they are, so the next page is always one press.
  for (const offset of [-1, 1]) {
    const page = current + offset;
    if (page > 1 && page < last) pages.add(page);
  }

  // Near an end there is no gap to fill, so the window opens out instead —
  // otherwise the row would be visibly shorter on pages 1 and 2.
  if (current <= 3) {
    [2, 3, 4].forEach((page) => page < last && pages.add(page));
  }
  if (current >= last - 2) {
    [last - 1, last - 2, last - 3].forEach((page) => page > 1 && pages.add(page));
  }

  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const withGaps: (number | "gap")[] = [];

  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) withGaps.push("gap");
    withGaps.push(page);
  });

  return withGaps;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyMessage?: string;
  page?: number;
  lastPage?: number;
  onPageChange?: (page: number) => void;
  /**
   * How many rows there are in total, across every page.
   *
   * Given it, the pagination can say WHICH rows are on screen — "Showing 21
   * to 37 of 37" — rather than only which page. A clerk counting a purok
   * needs the position, not the page number.
   */
  total?: number;
  /** Rows per page, so the range can be worked out. Defaults to 20. */
  perPage?: number;
  /**
   * Number the rows, continuing across pages: row 1 of page 2 is #21.
   * Restarting at 1 on every page is how a count of a purok comes out wrong.
   */
  numbered?: boolean;
  /** Show a search box that filters the loaded rows by `getSearchText`. */
  searchable?: boolean;
  /**
   * What the box says before anything is typed.
   *
   *     Search by <a>, <b> or <c>…
   *
   * ONE SHAPE, because these drifted into four — "Search X", "Search by X",
   * "Start typing a X", "Type X" — and the office found "certificate #" on
   * one screen and "certificate number" on the next.
   *
   *   · "Search by", always.
   *   · NUMBER is spelt out. "#" is ambiguous at this size and a screen
   *     reader says "number sign"; it was the pair somebody noticed.
   *   · No Oxford comma.
   *   · Three things at most — a fourth is one nobody reads to the end.
   *   · One "…" character, never three dots.
   */
  searchPlaceholder?: string;
  getSearchText?: (row: T) => string;
  /**
   * Hand the search to the SERVER instead of filtering the loaded rows.
   *
   * For a paginated list whose owner can ask the API. The local filter only
   * ever saw the page on screen, and hid the pager while it worked — so a
   * record on page 3 answered "No matches" from page 1, which is a search
   * telling somebody a thing does not exist when it does.
   *
   * Given this, the box's text goes to the owner (who re-queries), nothing
   * is filtered here, and the pager stays because the pages are now pages
   * of the RESULTS. `searchValue` keeps the box in step with the owner.
   */
  onSearch?: (text: string) => void;
  searchValue?: string;
  /** Optional dropdown filters shown next to the search box. */
  filters?: FilterDef<T>[];
  tableClassName?: string;
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyMessage = "No records found.",
  page,
  lastPage,
  onPageChange,
  total,
  perPage = 20,
  numbered = false,
  searchable = false,
  searchPlaceholder = "Search…",
  getSearchText,
  onSearch,
  searchValue,
  filters,
  tableClassName,
}: DataTableProps<T>) {
  const [localQuery, setLocalQuery] = useState("");
  /* One box, two owners: the server when `onSearch` is given, this table
     otherwise. */
  const serverSearch = onSearch !== undefined;
  const query = serverSearch ? (searchValue ?? "") : localQuery;
  const setQuery = serverSearch ? onSearch : setLocalQuery;

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (page !== undefined && page > 1 && onPageChange) {
      onPageChange(1);
    }
  };

  const handleFilterChange = (index: number, val: string) => {
    const filter = filters?.[index];
    if (filter?.onChange) {
      filter.onChange(val);
    } else {
      setFilterValues((prev) => ({ ...prev, [index]: val }));
    }
    if (page !== undefined && page > 1 && onPageChange) {
      onPageChange(1);
    }
  };

  // The "go to page" box, opened from the gap between page numbers.
  const [jumping, setJumping] = useState(false);
  const [jumpTo, setJumpTo] = useState("");
  const [filterValues, setFilterValues] = useState<Record<number, string>>({});

  const hasToolbar = searchable || (filters?.length ?? 0) > 0;

  // Options for each filter — explicit, or derived from the loaded rows.
  const filterOptions = useMemo(
    () =>
      (filters ?? []).map((filter) =>
        filter.options ??
        (filter.getValue
          ? Array.from(new Set(rows.map((r) => filter.getValue!(r)).filter(Boolean))).sort()
          : [])
      ),
    [filters, rows]
  );

  // Rows after client-side search + filters.
  const visibleRows = useMemo(() => {
    let out = rows;
    const q = query.trim().toLowerCase();
    if (!serverSearch && searchable && q && getSearchText) {
      out = out.filter((r) => getSearchText(r).toLowerCase().includes(q));
    }
    (filters ?? []).forEach((filter, index) => {
      if (filter.onChange !== undefined) return;
      const chosen = filterValues[index];
      if (chosen && filter.getValue) out = out.filter((r) => filter.getValue!(r) === chosen);
    });
    return out;
  }, [rows, query, filterValues, searchable, getSearchText, filters, serverSearch]);

  /* A SERVER search does not count as filtering: the pages it returns are
     pages of the results, so the pager is right to stay. */
  const filtering =
    (!serverSearch && query.trim() !== "") ||
    (filters ?? []).some((f, index) => f.onChange === undefined && Boolean(filterValues[index]));

  /*
   * On a phone the table is replaced by one card per row (see below). Action
   * columns carry buttons rather than a value, so they are pulled out of the
   * label/value list and given their own strip at the foot of the card.
   */
  const isActionColumn = (column: Column<T>) => {
    const h = column.header.trim().toLowerCase();
    return h === "" || h === "actions" || h === "action" || h === "next step";
  };
  const dataColumns = columns.filter((c) => !isActionColumn(c));
  const actionColumns = columns.filter(isActionColumn);

  /*
   * Row numbers continue across pages: the first row of page 2 is #21, not
   * #1. Restarting each page is how a purok gets counted twice.
   *
   * Suppressed while a client-side filter is on — the numbers would run
   * 3, 7, 12 against a filtered subset, which reads as missing rows.
   */
  const offline = useIsOffline();
  const firstRowNumber = ((page ?? 1) - 1) * perPage + 1;
  const showNumbers = numbered && !filtering;

  /*
   * An empty list with no line is a different thing from an empty list.
   *
   * "No records found." is a statement about the barangay. With the line
   * down and nothing for this list on the device, the truthful statement is
   * about the device — otherwise a clerk reads "no hearings this week" off a
   * page that simply could not ask.
   */
  const nothingHere = offline
    ? "No connection, and this list has not been opened on this device yet — it will fill in when the line is back."
    : emptyMessage;

  /** Loading / empty / no-match message, shared by the table and the cards. */
  const notice = loading && rows.length === 0
    ? "loading"
    : rows.length === 0
      ? nothingHere
      : visibleRows.length === 0
        ? "No matches for your search or filter."
        : null;

  return (
    <div>
      {hasToolbar && (
        // Stacked on a phone: a search box and two dropdowns side by side leave
        // each about 110px wide, too narrow to read or to tap accurately.
        <div className="print-hide mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {searchable && (
            <SearchInput
              value={query}
              onChange={handleQueryChange}
              placeholder={searchPlaceholder}
              className="w-full flex-1 sm:w-auto sm:min-w-56"
            />
          )}
          {(filters ?? []).map((filter, index) => (
            <select
              key={filter.label}
              value={filter.value !== undefined ? filter.value : (filterValues[index] ?? "")}
              onChange={(e) => handleFilterChange(index, e.target.value)}
              aria-label={filter.label}
              className="w-full cursor-pointer rounded-full border border-gray bg-white px-4 py-2 text-sm text-dark outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25 sm:w-auto"
            >
              <option value="">{filter.label}: All</option>
              {filterOptions[index].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}

      {/*
        Phones get one card per row instead of the table.
        A five-column table inside a 244px-wide scroll frame shows barely two
        columns, so Status and the action buttons — the whole reason to open a
        list — sat off-screen behind a horizontal scrollbar nobody finds.
      */}
      <div className="space-y-3 sm:hidden print:hidden">
        {notice === "loading" && (
          <>
            <span role="status" aria-live="polite" className="sr-only">
              Loading the list
            </span>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="rounded-xl border border-gray bg-white p-4">
                <div className="space-y-3">
                  {dataColumns.slice(0, 3).map((_column, j) => (
                    <div key={j} className="flex items-baseline justify-between gap-3">
                      <span className="h-3 w-20 animate-pulse rounded bg-gray" />
                      <span className="h-3 w-24 animate-pulse rounded bg-gray" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
        {notice !== null && notice !== "loading" && (
          <div className="rounded-xl border border-gray bg-white px-4 py-10 text-center text-sm text-gray-400">
            {notice}
          </div>
        )}
        {notice === null &&
          visibleRows.map((row) => (
            <div key={rowKey(row)} className="rounded-2xl border border-gray/80 bg-white p-4 shadow-2xs">
              <dl className="space-y-1">
                {dataColumns.map((column, index) => {
                  const headerLower = column.header.toLowerCase();
                  const isPrimary = index === 0;
                  const isBlockField =
                    headerLower.includes("purpose") ||
                    headerLower.includes("detail") ||
                    headerLower.includes("remark") ||
                    headerLower.includes("description") ||
                    headerLower.includes("address") ||
                    headerLower.includes("next hearing");

                  if (isPrimary) {
                    return (
                      <div key={index} className="border-b border-gray/50 pb-2.5 mb-2">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          {column.header}
                        </dt>
                        <dd className="mt-1 text-sm font-semibold text-dark break-words [overflow-wrap:anywhere]">
                          {column.render(row)}
                        </dd>
                      </div>
                    );
                  }

                  if (isBlockField) {
                    return (
                      <div key={index} className="pt-1.5 pb-1.5 border-b border-gray/20 last:border-b-0">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          {column.header}
                        </dt>
                        <dd className="mt-0.5 text-xs text-gray-700 break-words [overflow-wrap:anywhere]">
                          {column.render(row)}
                        </dd>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={index}
                      className="flex items-start justify-between gap-3 py-1.5 border-b border-gray/20 last:border-b-0 text-xs"
                    >
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-gray-500 shrink-0 max-w-[45%]">
                        {column.header}
                      </dt>
                      <dd className="min-w-0 text-right font-medium text-dark break-words [overflow-wrap:anywhere]">
                        {column.render(row)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {/*
                Every action control in the strip is floored at 36px tall and
                vertically centred. Row buttons are written for a table cell —
                `py-1.5 text-xs` lands at 26px, and a few bare text buttons at
                16px — which is a miss waiting to happen under a thumb.
              */}
              {actionColumns.length > 0 && (
                <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-gray/60 pt-3 [&_a]:inline-flex [&_a]:min-h-9 [&_a]:items-center [&_button]:inline-flex [&_button]:min-h-9 [&_button]:items-center">
                  {actionColumns.map((column, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      {column.render(row)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-gray sm:block print:block print:overflow-visible">
        <table className={`w-full divide-y divide-gray bg-white text-left text-sm ${tableClassName ?? ""}`}>
          <thead className="bg-secondary">
            <tr>
              {showNumbers && (
                <th
                  scope="col"
                  className="w-12 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500"
                >
                  #
                </th>
              )}
              {columns.map((column, index) => {
                const pad = column.className && /\bpx-\S+/.test(column.className) ? "" : "px-3";
                return (
                  <th
                    key={index}
                    scope="col"
                    className={`${pad} py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
                      /* Buttons, not data: nothing to read on paper. */
                      isActionColumn(column) ? "print-hide" : ""
                    } ${column.className ?? ""}`}
                  >
                    {column.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray/70">
            {/* Keep showing current rows during background refreshes — the
                spinner only appears while the table is still empty. */}
            {loading && rows.length === 0 && (
              <>
                <tr>
                  <td colSpan={columns.length + (showNumbers ? 1 : 0)} className="p-0">
                    <span role="status" aria-live="polite" className="sr-only">
                      Loading the table
                    </span>
                  </td>
                </tr>
                {/*
                  Five rows, whatever is coming. Enough to read as a table
                  rather than as an error, and few enough that a list of two
                  does not shrink when it lands.
                */}
                {Array.from({ length: 5 }).map((_, r) => (
                  <tr key={r} aria-hidden="true">
                    {showNumbers && (
                      <td className="px-4 py-3.5">
                        <span className="block h-3 w-4 animate-pulse rounded bg-gray" />
                      </td>
                    )}
                    {columns.map((_column, c) => (
                      <td key={c} className="px-4 py-3.5">
                        <span
                          className="block h-3.5 animate-pulse rounded bg-gray"
                          /* Ragged widths: a grid of identical bars reads as
                             a loaded table of empty cells. */
                          style={{ width: `${[70, 45, 60, 35, 55, 50][c % 6]}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + (showNumbers ? 1 : 0)} className="px-4 py-10 text-center text-gray-400">
                  {nothingHere}
                </td>
              </tr>
            )}
            {rows.length > 0 && visibleRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + (showNumbers ? 1 : 0)} className="px-4 py-10 text-center text-gray-400">
                  No matches for your search or filter.
                </td>
              </tr>
            )}
            {visibleRows.map((row, rowIndex) => (
              <tr key={rowKey(row)} className="transition-colors hover:bg-primary/[0.03]">
                {showNumbers && (
                  <td className="px-3 py-2.5 align-middle text-xs tabular-nums text-gray-400">
                    {firstRowNumber + rowIndex}
                  </td>
                )}
                {columns.map((column, index) => {
                  const pad = column.className && /\bpx-\S+/.test(column.className) ? "" : "px-3";
                  return (
                    <td
                      key={index}
                      className={`${pad} py-2.5 align-middle ${isActionColumn(column) ? "print-hide" : ""} ${column.className ?? ""}`}
                    >
                      {column.render(row)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Server pagination — hidden while a client-side search/filter is active
          (the page numbers would be misleading against a filtered subset). */}
      {!filtering && page !== undefined && lastPage !== undefined && lastPage > 1 && onPageChange && (
        <div className="print-hide mt-4 flex flex-wrap items-center justify-center gap-2 text-sm sm:justify-end">
          {/*
            Which rows these are, not just which page. A clerk checking a
            purok against a paper list needs the position in the whole set —
            "Page 2 of 2" does not tell them whether they have seen row 30.
          */}
          {total !== undefined && total > 0 && (
            <span className="mr-auto text-xs text-gray-500">
              Showing <span className="font-semibold text-dark">{firstRowNumber}</span> to{" "}
              <span className="font-semibold text-dark">
                {Math.min(firstRowNumber + visibleRows.length - 1, total)}
              </span>{" "}
              of <span className="font-semibold text-dark">{total}</span>
            </span>
          )}
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="cursor-pointer rounded-lg border border-gray bg-white px-3 py-1.5 font-medium text-dark transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          {pageList(page, lastPage).map((entry, index) =>
            entry === "gap" ? (
              /*
                The pages that were left out. A plain "…" is a dead end when
                the one you want is inside it, so it opens a box to type the
                number — which is the whole point of paging a 1,000-page
                register.
              */
              <button
                key={`gap-${index}`}
                type="button"
                onClick={() => setJumping(true)}
                title="Go to a page"
                className="cursor-pointer px-2 py-1.5 text-gray-400 transition-colors hover:text-primary"
              >
                …
              </button>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? "page" : undefined}
                className={`min-w-9 cursor-pointer rounded-lg border px-3 py-1.5 font-medium tabular-nums transition-colors ${
                  entry === page
                    ? "border-primary bg-primary text-white"
                    : "border-gray bg-white text-dark hover:border-primary hover:text-primary"
                }`}
              >
                {entry}
              </button>
            )
          )}

          {/* Typing the number beats pressing Next forty times. */}
          {jumping && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const wanted = Number(jumpTo);
                if (wanted >= 1 && wanted <= lastPage) onPageChange(wanted);
                setJumping(false);
                setJumpTo("");
              }}
              className="flex items-center gap-1"
            >
              <input
                autoFocus
                type="number"
                min={1}
                max={lastPage}
                value={jumpTo}
                onChange={(e) => setJumpTo(e.target.value)}
                onBlur={() => setJumping(false)}
                placeholder={`1–${lastPage}`}
                aria-label={`Go to a page between 1 and ${lastPage}`}
                className="w-20 rounded-lg border border-primary px-2 py-1.5 text-sm outline-none"
              />
            </form>
          )}
          <button
            type="button"
            disabled={page >= lastPage}
            onClick={() => onPageChange(page + 1)}
            className="cursor-pointer rounded-lg border border-gray bg-white px-3 py-1.5 font-medium text-dark transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
