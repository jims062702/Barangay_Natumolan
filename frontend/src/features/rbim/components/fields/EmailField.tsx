import { useState, useEffect } from "react";
import { FiAlertTriangle, FiLoader, FiCheck } from "react-icons/fi";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { CharsLeft } from "./CharsLeft";
import { rbimApi } from "../../api";

/**
 * The email box, which checks itself as it is typed.
 *
 * A portal account is issued against an email address and against nothing
 * else, so `residents.email` is unique and two people cannot share one. The
 * moment to discover a clash is while the BHW is still standing at the door
 * and can ask for a second address — not weeks later, when the line is being
 * matched and the address is quietly dropped because somebody else holds it.
 *
 * Checked as it is typed rather than behind a button. A button is one per
 * line, ten lines to a form, and the one nobody remembers to press is
 * exactly the one that was wrong.
 *
 * Not everything it finds is an error. The commonest hit by far is that this
 * IS the person — a head already on the register being written onto a form —
 * so the box names who holds the address and lets the office decide.
 */
export function EmailField({
  value,
  onChange,
  censusId,
  residentId,
  clashLine,
  disabled = false,
}: {
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  censusId?: string;
  /** Who this line is already matched to — their own address is not a clash. */
  residentId?: number | null;
  /** Another line on this same form holding the same address, if any. */
  clashLine: number | null;
  disabled?: boolean;
}) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ available: boolean; message: string } | null>(null);

  const typed = String(value ?? "").trim();

  useEffect(() => {
    if (!typed) {
      setResult(null);
      setChecking(false);
      return;
    }

    setChecking(true);
    setResult(null);

    /*
     * A pause, because this fires on a keystroke: without it the office is
     * told "that is not an email address" while still typing the domain.
     */
    const timer = setTimeout(() => {
      rbimApi.checkEmail({
          params: { email: typed, census_id: censusId, resident_id: residentId ?? undefined },
        })
        .then((r) =>
          setResult({ available: r.data.data.available, message: r.data.message })
        )
        .catch(() => setResult(null))
        .finally(() => setChecking(false));
    }, 500);

    return () => clearTimeout(timer);
  }, [typed, censusId, residentId]);

  // A clash inside this one form needs no server to see, so it is said first.
  const onFormClash = clashLine !== null && typed !== "";
  const bad = onFormClash || (result !== null && !result.available);

  return (
    <div>
      <FormField
        label="Email address"
        hint="What their portal login is issued to. Without one, they cannot sign in."
      >
        <input
          type="email"
          maxLength={80}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={[
            inputClasses,
            disabled ? "cursor-not-allowed bg-secondary text-gray-400" : "",
            bad ? "border-red-400" : "",
          ].join(" ")}
        />

        {/*
          The costliest box on the form to truncate quietly: an address cut
          short still looks like an address, and the portal account is issued
          against it.
        */}
        {!disabled && <CharsLeft value={value} max={80} />}
      </FormField>

      {onFormClash ? (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-red-600">
          <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Line {clashLine} on this form already has this address. One login belongs to
            one person, so only one of them can keep it.
          </span>
        </p>
      ) : checking ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
          <FiLoader className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
          Checking…
        </p>
      ) : result ? (
        <p
          className={
            "mt-1 flex items-start gap-1.5 text-xs " +
            (result.available ? "text-green-700" : "text-amber-700")
          }
        >
          {result.available ? (
            <FiCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{result.message}</span>
        </p>
      ) : null}
    </div>
  );
}
