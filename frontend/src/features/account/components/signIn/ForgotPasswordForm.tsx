import { inputClasses } from "../../../../shared/ui/FormField";
import type { SignInState } from "../../hooks/useSignIn";

/**
 * Forgotten password, step one: where to send the code.
 */
export function ForgotPasswordForm({ ctx }: { ctx: SignInState }) {
  const { askForCode, email, setEmail, loading, leaveForgot } = ctx;

  return (
    <form onSubmit={askForCode} className="mt-6 space-y-5">
      <p className="text-sm leading-relaxed text-gray-500">
        Type the email on your account and we will send a 6-digit code
        to it. If you cannot reach that inbox, the Barangay Population
        Office can set a password for you at the counter.
      </p>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-dark">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClasses}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          required
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Sending…" : "Send me a code"}
      </button>

      <button
        type="button"
        onClick={leaveForgot}
        className="w-full cursor-pointer text-xs font-medium text-gray-500 hover:text-dark"
      >
        Back to sign in
      </button>
    </form>
  );
}
