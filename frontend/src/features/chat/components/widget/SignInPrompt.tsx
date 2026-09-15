import { Link } from "react-router-dom";
import type { ChatWidgetState } from "../../hooks/useChatWidget";

/**
 * The live desk is for registered residents: signing in comes first.
 */
export function SignInPrompt({ ctx }: { ctx: ChatWidgetState }) {
  const { setMode } = ctx;

  return (
    <div className="flex-1 space-y-3 overflow-y-auto bg-secondary/60 px-4 py-4">
      <p className="rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed text-dark shadow-sm">
        Talking to the <strong>Barangay Secretary</strong> needs your resident portal
        account. Signing in means they can see your record while they help you — and you
        will not be asked to type your name, email or number.
      </p>
      <p className="rounded-xl bg-secondary px-4 py-2.5 text-xs leading-relaxed text-gray-500">
        No account yet? The Population Office creates one when you are registered as a
        resident, and it is activated with a code sent to your email.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("bot")}
          className="flex-1 cursor-pointer rounded-full border border-gray bg-white py-2.5 text-xs font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
        >
          Back to the assistant
        </button>
        <Link
          to="/login"
          className="flex-1 cursor-pointer rounded-full bg-primary py-2.5 text-center text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
