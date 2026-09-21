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
  const {
    submitCode, code, setCode, loading, resend, cancelActivation,
    newEmail, setNewEmail, submitNewEmail,
  } = ctx;

  /*
   * "That address is wrong" is its own screen, not a field beside the code.
   *
   * Somebody who cannot read the mailbox the code went to has nothing to
   * type in the code box, and leaving it in front of them is the dead end.
   * Opening this replaces the code form outright so there is one question
   * on screen: where should we send it instead?
   */
  if (newEmail !== null) {
    return (
      <form onSubmit={submitNewEmail} className="mt-6 space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-gray bg-secondary/60 px-4 py-3 text-sm leading-relaxed text-gray-600">
          <FiMail aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span>
            Your account is registered to{" "}
            <strong className="text-dark">{activation.email}</strong>. Give an
            address you can open and we will send the code there instead —
            entering it will change your sign-in email and activate your account.
          </span>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-dark">New email address</span>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={inputClasses}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading || newEmail.trim() === ""}
          className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send the code there"}
        </button>

        <button
          type="button"
          onClick={() => setNewEmail(null)}
          className="block w-full cursor-pointer text-center text-xs font-medium text-gray-500 hover:text-dark"
        >
          Back to entering the code
        </button>
      </form>
    );
  }

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

      {/*
        The way out of the dead end, and it belongs here rather than beside
        "Send another code" — sending the same code to the same unreachable
        mailbox again is exactly what does not work.
      */}
      <button
        type="button"
        onClick={() => setNewEmail("")}
        className="block w-full cursor-pointer border-t border-gray pt-4 text-center text-xs font-medium text-gray-500 hover:text-primary"
      >
        That is not my email address
      </button>
    </form>
  );
}
