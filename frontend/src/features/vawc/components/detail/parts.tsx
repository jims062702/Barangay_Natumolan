import type { ReactNode } from "react";
import { FiCheck } from "react-icons/fi";
import { errorMessage } from "../../../../shared/lib/api";
import { confirmAction } from "../../../../shared/lib/confirm";
import { toast } from "../../../../shared/lib/toast";
import type { VawcProtectionOrder } from "../../types";

/**
 * Which form on the case page is open.
 *
 * One at a time, held by the page: the Case Actions menu and each card's own
 * button open the same modals, so there is one place that says which.
 */
export type CaseModal =
  | { kind: "bpo"; mode: "new" }
  | { kind: "bpo"; mode: "edit" | "renew"; order: VawcProtectionOrder }
  | { kind: "referral" }
  | { kind: "followup" }
  | { kind: "document" }
  | { kind: "safety" }
  | { kind: "assessment" }
  | { kind: "children" }
  | { kind: "dialogue" }
  | null;

/**
 * Confirms, sends, closes the form and reloads the case.
 *
 * Returns whether it went through, so a form can stay open — with what was
 * typed still in it — when the server refused something.
 */
export async function saveToCase(
  request: () => Promise<{ data?: { message?: string } } | unknown>,
  done: () => void,
  fallbackMessage: string,
  confirmTitle = "Save this to the case?",
): Promise<boolean> {
  if (!(await confirmAction({ title: confirmTitle, confirmText: "Yes, save" }))) return false;
  try {
    const response = (await request()) as { data?: { message?: string } } | undefined;
    toast(response?.data?.message || fallbackMessage);
    done();
    return true;
  } catch (err) {
    toast(errorMessage(err), "error");
    return false;
  }
}

/** A list of ticks — "persons present", "services provided", … */
export function CheckList({
  label,
  options,
  value,
  onChange,
  columns = 2,
}: {
  label?: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  columns?: 2 | 3;
}) {
  const toggle = (option: string) =>
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);

  return (
    <fieldset>
      {label && <legend className="mb-1.5 text-sm font-medium text-dark">{label}</legend>}
      <div className={`grid gap-x-4 gap-y-2 ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {options.map((option) => (
          <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-dark">
            <input
              type="checkbox"
              checked={value.includes(option)}
              onChange={() => toggle(option)}
              className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Label/value rows, as the case profile reads them. */
export function DetailRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="space-y-2.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 border-b border-gray/60 pb-2 last:border-0 last:pb-0">
          <dt className="shrink-0 text-gray-500">{label}</dt>
          <dd className="text-right font-medium text-dark">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A block of saved text — a statement, a plan — under its own small heading. */
export function TextBlock({ label, text }: { label: string; text?: string | null }) {
  if (!text) return null;

  return (
    <div className="rounded-xl bg-secondary p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-dark">{text}</p>
    </div>
  );
}

/** Ticked items, shown as chips; nothing when nothing is ticked. */
export function Chips({ items, empty = "None recorded" }: { items?: string[] | null; empty?: string }) {
  if (!items || items.length === 0) return <span className="text-gray-400">{empty}</span>;

  return (
    <span className="flex flex-wrap justify-end gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {item}
        </span>
      ))}
    </span>
  );
}

/** A tick the desk gave, or did not — said in words as well as the mark. */
export function Tick({ done, label }: { done: boolean; label: string }) {
  return (
    <li className={`flex items-start gap-2 text-sm ${done ? "text-dark" : "text-gray-400"}`}>
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          done ? "border-primary bg-primary text-white" : "border-gray bg-white"
        }`}
      >
        {done && <FiCheck className="h-3 w-3" />}
      </span>
      <span>
        {label}
        <span className="sr-only">{done ? " — done" : " — not done"}</span>
      </span>
    </li>
  );
}

/** The card header button: "Record", "Refer", "Update"… */
export function CardButton({ onClick, children, disabled }: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
    >
      {children}
    </button>
  );
}

/** The one full-width button at the bottom of every form here. */
export function SubmitButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
    >
      {children}
    </button>
  );
}
