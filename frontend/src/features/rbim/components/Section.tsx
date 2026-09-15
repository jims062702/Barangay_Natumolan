import { useState } from "react";
import { FiChevronDown, FiChevronRight, FiCheck } from "react-icons/fi";

/** One collapsible block of the paper form. */
export function Section({
  title,
  note,
  children,
  openByDefault = false,
  progress,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  openByDefault?: boolean;
  /**
   * How many of this section's questions are answered.
   *
   * On the header, because the sections are folded shut: without it the only
   * way to find the one box still missing is to open all nine and read them.
   */
  progress?: { filled: number; total: number };
}) {
  const [open, setOpen] = useState(openByDefault);

  return (
    <div className="rounded-xl border border-gray bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left"
      >
        {open ? (
          <FiChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        ) : (
          <FiChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        )}
        <span className="text-sm font-semibold text-dark">{title}</span>
        {note && <span className="text-xs text-gray-400">· {note}</span>}

        {/*
          Nothing is required here, so this counts rather than complains.
          A form can be submitted with gaps — a household that would not
          answer Q23 is a fact, not a mistake — and the count is there to
          show what is left, not to stand in the way.
        */}
        {progress && (
          <span className="ml-auto shrink-0">
            {progress.total === 0 ? (
              <span className="text-xs text-gray-400">Not asked</span>
            ) : progress.filled === progress.total ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                <FiCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Complete
              </span>
            ) : (
              <span
                className={
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold " +
                  (progress.filled === 0
                    ? "bg-secondary text-gray-500"
                    : "bg-amber-50 text-amber-700")
                }
              >
                {progress.filled}/{progress.total}
              </span>
            )}
          </span>
        )}
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 border-t border-gray p-4 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
      )}
    </div>
  );
}
