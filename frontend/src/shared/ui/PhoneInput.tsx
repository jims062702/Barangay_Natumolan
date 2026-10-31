/**
 * Philippine mobile input: a fixed "+63" prefix plus exactly 10 digits.
 * Emits the combined value as "+63XXXXXXXXXX" (or "" when empty).
 */
import { localMobile, e164Mobile } from "../lib/phone";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export default function PhoneInput({
  value,
  onChange,
  disabled,
  required,
  placeholder = "9XX XXX XXXX",
  className = "",
}: PhoneInputProps) {
  const local = localMobile(value);
  const remaining = 10 - local.length;

  const handle = (raw: string) => {
    // Only accept digits, max 10
    const digits = raw.replace(/\D/g, "");
    onChange(e164Mobile(digits));
  };

  return (
    <div
      className={`flex items-center rounded-xl border border-gray bg-white transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 ${
        disabled ? "opacity-60" : ""
      } ${className}`}
    >
      <span className="select-none border-r border-gray px-3 py-2.5 text-sm font-semibold text-gray-500 bg-gray-50/60 rounded-l-xl">
        +63
      </span>
      <input
        type="tel"
        inputMode="numeric"
        value={local}
        disabled={disabled}
        onChange={(e) => handle(e.target.value)}
        placeholder={placeholder}
        maxLength={10}
        required={required}
        pattern="[0-9]{10}"
        title="Ten digits, starting with 9 — for example 9171234567"
        className="w-full min-w-0 bg-transparent px-3 py-2 text-sm text-dark outline-none placeholder:text-gray-400 font-mono tracking-wide"
      />
      <div className="mr-2 shrink-0 select-none">
        <span
          className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
            remaining === 0
              ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
              : remaining <= 3
              ? "bg-amber-50 text-amber-700 border border-amber-300"
              : "bg-gray-100 text-gray-500"
          }`}
          title={`${local.length} of 10 digits entered (${remaining} remaining)`}
        >
          {local.length}/10
        </span>
      </div>
    </div>
  );
}
