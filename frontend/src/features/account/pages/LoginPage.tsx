import { FiArrowLeft } from "react-icons/fi";
import { Link } from "react-router-dom";
import logo from "../../../assets/logo/logo.svg";
import { useSignIn } from "../hooks/useSignIn";
import { LoginHero } from "../components/signIn/LoginHero";
import { ActivationForm } from "../components/signIn/ActivationForm";
import { ForgotPasswordForm } from "../components/signIn/ForgotPasswordForm";
import { ResetCodeForm } from "../components/signIn/ResetCodeForm";
import { NewPasswordForm } from "../components/signIn/NewPasswordForm";
import { SignInForm } from "../components/signIn/SignInForm";

export default function LoginPage() {
  const ctx = useSignIn();
  const {
    error, notice, activation, forgot,
  } = ctx;

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left — barangay imagery (hidden on small screens) */}
      {/*
        overflow-hidden, because the backdrop is scaled up and blurred.

        A 40px blur spreads well past the edge of the element it is on,
        and scale-110 pushes it further still — so without this the
        colour smeared out over the white half of the page. Nothing
        clipped it: the panel is only `relative`.
      */}
      <LoginHero />

      {/* Right — sign-in form */}
      <div className="flex w-full items-center justify-center bg-secondary px-4 py-10 lg:w-1/2 lg:bg-white">
        <div className="w-full max-w-md">
          {/* Mobile-only back link + branding (the image panel is hidden) */}
          <div className="mb-8 lg:hidden">
            <Link
              to="/"
              className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-primary"
            >
              <FiArrowLeft aria-hidden="true" /> Back to website
            </Link>
            <div className="text-center">
              <img src={logo} alt="Barangay Natumolan logo" className="mx-auto h-16 w-16" />
              <h1 className="mt-3 text-2xl font-bold text-dark">Barangay Natumolan</h1>
              <p className="mt-1 text-sm text-gray-500">Management Information System</p>
            </div>
          </div>

          <div className="hidden lg:block">
            <h2 className="text-3xl font-bold text-dark">
              {activation ? "Verify your email" : "Welcome back"}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {activation
                ? "One last step before your account is yours."
                : "Sign in to your staff or resident account."}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
            >
              {error}
            </div>
          )}
          {notice && (
            <div
              role="status"
              className="mt-6 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-dark"
            >
              {notice}
            </div>
          )}

          {activation ? (
            /*
             * Activation. The account already exists — it was created when the
             * Population Office registered this resident — so this is not a
             * sign-up: it is proving the mailbox on their record is theirs.
             */
            <ActivationForm ctx={ctx} activation={activation} />
          ) : forgot === "ask" ? (
            <ForgotPasswordForm ctx={ctx} />
          ) : forgot === "code" ? (
            /* Step two: the code, and nothing else. */
            <ResetCodeForm ctx={ctx} />
          ) : forgot === "set" ? (
            /* Step three, reached only with a code that checked out. */
            <NewPasswordForm ctx={ctx} />
          ) : (
            <SignInForm ctx={ctx} />
          )}

          {!activation && (
            <div className="mt-8 rounded-2xl border border-gray bg-secondary/60 px-5 py-4 text-xs leading-relaxed text-gray-500 lg:bg-secondary">
              <p className="font-semibold text-dark">Resident accounts</p>
              <p className="mt-1">
                Your account is created for you when the Barangay Population Office registers you —
                you do not need to sign up. Sign in with the email on your record; your password is
                your <strong>last name followed by the month and year you were
                born</strong> — for example <span className="font-mono">Gasang062002</span> for
                somebody named Gasang born in June 2002. The first time you sign in we
                will email you a 6-digit code to confirm the account is yours.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

