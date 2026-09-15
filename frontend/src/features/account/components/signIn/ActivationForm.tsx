import { FiMail } from "react-icons/fi";
import { inputClasses } from "../../../../shared/ui/FormField";
import type { SignInState } from "../../hooks/useSignIn";

/**
 * Activating a portal account the Population Office created.
 */
export function ActivationForm({ ctx, activation }: {
  ctx: SignInState;
  activation: { email: string };
}) {
  const { submitCode, code, setCode, loading, resend, cancelActivation } = ctx;

  return (
    <form onSubmit={submitCode} className="mt-6 space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-gray bg-secondary/60 px-4 py-3 text-sm leading-relaxed text-gray-600">
        <FiMail aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <span>
          We emailed a 6-digit code to{" "}
          <strong className="text-dark">{activation.email}</strong>. Enter it below to
          activate your portal account.
        </span>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-dark">Verification code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
        disabled={loading || code.length < 6}
        className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Verifying…" : "Activate my account"}
      </button>

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={resend}
          disabled={loading}
          className="cursor-pointer font-semibold text-primary hover:underline disabled:opacity-60"
        >
          Send another code
        </button>
        <button
          type="button"
          onClick={cancelActivation}
          className="cursor-pointer font-medium text-gray-500 hover:text-dark"
        >
          Use a different account
        </button>
      </div>
    </form>
  );
}
