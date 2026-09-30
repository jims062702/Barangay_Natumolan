import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  FiAlertTriangle, FiCalendar, FiChevronDown, FiFileText, FiRotateCcw, FiSend, FiShield, FiXCircle,
} from "react-icons/fi";

export interface CaseAction {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
  disabled?: boolean;
  /** Said under the item when it cannot be chosen. */
  why?: string;
  danger?: boolean;
}

export const ACTION_ICONS = {
  bpo: FiShield,
  referral: FiSend,
  followup: FiCalendar,
  document: FiFileText,
  safety: FiAlertTriangle,
  close: FiXCircle,
  reopen: FiRotateCcw,
};

/**
 * "Case Actions ▾" — everything the desk does to a case, in one place.
 *
 * Closes on Escape, on a click elsewhere, and after an item is chosen; the
 * arrow keys move between items, so it works without a mouse.
 */
export function CaseActionsMenu({ actions }: { actions: CaseAction[] }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    /* The first item that can be chosen takes the focus. */
    items.current.find((el) => el && !el.disabled)?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const move = (from: number, step: 1 | -1) => {
    const enabled = items.current
      .map((el, index) => ({ el, index }))
      .filter(({ el }) => el && !el.disabled);
    if (enabled.length === 0) return;
    const at = enabled.findIndex(({ index }) => index === from);
    enabled[(at + step + enabled.length) % enabled.length].el?.focus();
  };

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        Case Actions
        <FiChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Case actions"
          className="absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray bg-white py-1.5 shadow-xl"
        >
          {actions.map((action, index) => {
            const Icon = action.icon;

            return (
              <button
                key={action.label}
                ref={(el) => { items.current[index] = el; }}
                type="button"
                role="menuitem"
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); move(index, 1); }
                  if (e.key === "ArrowUp") { e.preventDefault(); move(index, -1); }
                }}
                className={`flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                  action.danger
                    ? "text-danger hover:bg-danger/5 focus:bg-danger/5"
                    : "text-dark hover:bg-primary/5 hover:text-primary focus:bg-primary/5 focus:text-primary"
                } ${index === actions.length - 1 ? "border-t border-gray" : ""}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {action.label}
                  {action.disabled && action.why && (
                    <span className="block text-xs font-normal text-gray-500">{action.why}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
