import { FiEyeOff, FiEye } from "react-icons/fi";
import { inputClasses } from "../../../../shared/ui/FormField";
import type { SignInState } from "../../hooks/useSignIn";

/**
 * Forgotten password, step three: choosing the new one.
 */
export function NewPasswordForm({ ctx }: { ctx: SignInState }) {
  const {
    useCode, showPassword, newPassword, setNewPassword, setShowPassword, newPasswordAgain,
    setNewPasswordAgain, loading, setForgot,
  } = ctx;

  return (
    <form onSubmit={useCode} className="mt-6 space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-dark">New password</span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={`${inputClasses} pr-12`}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            autoFocus
            required
          />
          {/*
            One switch for both boxes.

            Somebody choosing a password they have never typed before
            needs to see it, and two separate eyes on two boxes that
            must match is one control too many.
          */}
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-primary/10 hover:text-primary"
          >
            {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
          </button>
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-dark">
          New password again
        </span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={newPasswordAgain}
            onChange={(e) => setNewPasswordAgain(e.target.value)}
            className={`${inputClasses} pr-12`}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-primary/10 hover:text-primary"
          >
            {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
          </button>
        </div>
        {/* Said as they type, not after they submit. */}
        {newPasswordAgain !== "" && newPassword !== newPasswordAgain && (
          <span className="mt-1.5 block text-xs font-medium text-danger">
            The two passwords do not match.
          </span>
        )}
      </label>

      <button
        type="submit"
        disabled={
          loading || newPassword.length < 8 || newPassword !== newPasswordAgain
        }
        className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Saving…" : "Set my new password"}
      </button>

      <button
        type="button"
        onClick={() => setForgot("code")}
        className="w-full cursor-pointer text-xs font-medium text-gray-500 hover:text-dark"
      >
        Back to the code
      </button>
    </form>
  );
}
