import { FiEyeOff, FiEye } from "react-icons/fi";
import { inputClasses } from "../../../../shared/ui/FormField";
import type { SignInState } from "../../hooks/useSignIn";

/**
 * Email and password — the ordinary way in.
 */
export function SignInForm({ ctx }: { ctx: SignInState }) {
  const {
    handleSubmit, email, setEmail, showPassword, password, setPassword, setShowPassword,
    loading, setForgot, setError, setNotice,
  } = ctx;

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-dark">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClasses}
          placeholder="you@natumolan.local"
          autoComplete="email"
          required
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-dark">Password</span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClasses} pr-12`}
            placeholder="••••••••"
            autoComplete="current-password"
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
      </label>

      <button
        type="submit"
        disabled={loading}
        className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign In"}
      </button>

      {/*
        Under the button, where somebody looks after it has not worked.
        A quiet link rather than a second button: it is the way out of
        a problem, not a second thing to choose between.
      */}
      <button
        type="button"
        onClick={() => {
          setForgot("ask");
          setError("");
          setNotice("");
        }}
        className="w-full cursor-pointer text-xs font-semibold text-primary hover:underline"
      >
        Forgot your password?
      </button>
    </form>
  );
}
