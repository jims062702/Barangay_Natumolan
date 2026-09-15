import { FiFileText, FiAlertTriangle, FiCheck } from "react-icons/fi";
import { download } from "./download";
import type { RegisterTransferState } from "../../hooks/useRegisterTransfer";

/**
 * Bringing residents in from a spreadsheet: a preview first, then the import.
 */
export function ImportSection({ ctx }: { ctx: RegisterTransferState }) {
  const { fileInput, setFile, runPreview, busy, preview, runImport } = ctx;

  return (
    <section>
      <p className="mb-1 text-sm font-semibold text-dark">Bring data in</p>
      <p className="mb-3 text-xs leading-relaxed text-gray-500">
        A CSV or an Excel file. Nothing is saved until you have seen what it would do: a
        row that matches somebody already on the register updates them;{" "}
        <strong className="text-dark">an empty cell changes nothing</strong> — it is read as
        &ldquo;not filled in&rdquo;, never as &ldquo;clear this&rdquo;.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          /* Either of the two the export writes — a file this system
             handed out should be a file it takes back. */
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            const chosen = e.target.files?.[0] ?? null;
            setFile(chosen);
            if (chosen) void runPreview(chosen);
          }}
          className="max-w-xs flex-1 cursor-pointer rounded-xl border border-gray bg-white px-3 py-2 text-xs file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-dark"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => download("/residents-import/template", "resident-import-template.csv")}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray bg-white px-4 py-2 text-xs font-semibold text-primary transition-colors hover:border-primary disabled:opacity-60"
        >
          <FiFileText className="h-3.5 w-3.5" aria-hidden="true" /> Blank template
        </button>
      </div>

      {busy && !preview && (
        <p className="mt-3 text-xs text-gray-500">Reading the file…</p>
      )}

      {preview && (
        <div className="mt-4 rounded-xl border border-gray bg-secondary/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            What this file would do
          </p>

          <div className="mb-3 flex flex-wrap gap-4 text-sm">
            <span>
              <span className="font-bold text-dark">{preview.summary.create}</span>{" "}
              <span className="text-gray-500">new</span>
            </span>
            <span>
              <span className="font-bold text-dark">{preview.summary.update}</span>{" "}
              <span className="text-gray-500">updated</span>
            </span>
            {preview.summary.new_households > 0 && (
              <span>
                <span className="font-bold text-dark">{preview.summary.new_households}</span>{" "}
                <span className="text-gray-500">
                  new household{preview.summary.new_households === 1 ? "" : "s"}
                </span>
              </span>
            )}
            {preview.summary.errors > 0 && (
              <span className="text-danger">
                <span className="font-bold">{preview.summary.errors}</span> with problems
              </span>
            )}
          </div>

          {/*
            Every household about to be created, by number.

            A household number that is not on the register is not an
            error — the office is importing so that things get onto the
            register. But it is one typo away from another number, and a
            typo would otherwise quietly found a household containing one
            person for ever. So they are named, while nothing is written.
          */}
          {preview.summary.new_households > 0 && (
            <div className="mb-3 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-800">
                These household numbers are not on the register yet and will be created:
              </p>
              <p className="mt-1 text-xs text-amber-900">
                {[...new Set(
                  preview.rows
                    .filter((row) => row.new_household && row.problems.length === 0)
                    .map((row) => row.new_household as string)
                )].join(", ")}
              </p>
              <p className="mt-1.5 text-[11px] text-amber-700">
                Check them against the register first — a mistyped number makes a household
                of its own.
              </p>
            </div>
          )}

          {/*
            The bad rows first and in full. A clerk deciding whether to
            skip them needs to read them, and burying them under two
            hundred good rows is the same as not showing them.
          */}
          {preview.summary.errors > 0 && (
            <div className="mb-3 space-y-1.5">
              {preview.rows
                .filter((r) => r.problems.length > 0)
                .slice(0, 15)
                .map((r) => (
                  <div key={r.line} className="flex gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs">
                    <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
                    <span>
                      <span className="font-semibold text-dark">
                        Line {r.line}
                        {r.name ? ` · ${r.name}` : ""}
                      </span>
                      <span className="block text-gray-600">{r.problems.join(" ")}</span>
                    </span>
                  </div>
                ))}
              {preview.summary.errors > 15 && (
                <p className="text-xs text-gray-500">
                  …and {preview.summary.errors - 15} more.
                </p>
              )}
            </div>
          )}

          <div className="max-h-[26rem] overflow-y-auto rounded-lg border border-gray bg-white">
            <table className="w-full text-xs">
              <tbody>
                {preview.rows.slice(0, 100).map((r) => (
                  <tr key={r.line} className="border-b border-gray last:border-0">
                    <td className="px-3 py-1.5 text-gray-400">{r.line}</td>
                    <td className="px-3 py-1.5 font-medium text-dark">{r.name || "—"}</td>
                    <td className="px-3 py-1.5">
                      {r.problems.length > 0 ? (
                        <span className="text-danger">skipped</span>
                      ) : r.action === "update" ? (
                        <span className="text-gray-500">
                          updates {r.matched_number ?? "an existing record"}
                        </span>
                      ) : (
                        <span className="text-success">new</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            disabled={busy || preview.summary.create + preview.summary.update === 0}
            onClick={runImport}
            className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {preview.summary.create + preview.summary.update === 0 ? (
              "Nothing here can be imported"
            ) : (
              <>
                <FiCheck className="h-4 w-4" aria-hidden="true" />
                Import {preview.summary.create + preview.summary.update} record(s)
                {preview.summary.errors > 0 && `, skip ${preview.summary.errors}`}
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
