import { FiMail } from "react-icons/fi";
import { inputClasses } from "../../../../shared/ui/FormField";
import type { SignInState } from "../../hooks/useSignIn";

/**
 * Forgotten password, step two: the code, and nothing else.
 */
export function ResetCodeForm({ ctx }: { ctx: SignInState }) {
  const { checkCode, email, resetCode, setResetCode, loading, leaveForgot, resendResetCode, resendCooldown } = ctx;

  return (
    <form onSubmit={checkCode} className="mt-6 space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-gray bg-secondary/60 px-4 py-3 text-sm leading-relaxed text-gray-600">
        <FiMail aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <span>
          We emailed a 6-digit code to <strong className="text-dark">{email}</strong>.
          Enter it to continue.
        </span>
      </div>

      <label htmlFor="reset-code" className="block">
        <span className="mb-1.5 block text-sm font-medium text-dark">
          Verification code
        </span>
        <input
          id="reset-code"
          name="code"
          value={resetCode}
          onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className={`${inputClasses} text-center font-mono text-2xl tracking-[0.5em]`}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
        />
      </label>

      <button
        type="submit"
        disabled={loading || resetCode.length < 6}
        className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Checking…" : "Continue"}
      </button>

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={resendResetCode}
          disabled={resendCooldown > 0 || loading}
          className={`font-semibold transition-colors ${
            resendCooldown > 0 || loading
              ? "cursor-not-allowed text-gray-400"
              : "cursor-pointer text-primary hover:underline"
          }`}
        >
          {resendCooldown > 0 ? `Send another code (${resendCooldown}s)` : "Send another code"}
        </button>
        <button
          type="button"
          onClick={leaveForgot}
          className="cursor-pointer font-medium text-gray-500 hover:text-dark"
        >
          Back to sign in
        </button>
      </div>
    </form>
  );
}
