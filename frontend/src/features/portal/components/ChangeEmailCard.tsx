import { useState, type FormEvent } from "react";
import { FiCheck, FiMail } from "react-icons/fi";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import Card from "../../../shared/ui/Card";
import { inputClasses } from "../../../shared/ui/FormField";
import { portalApi } from "../api";

/**
 * Changing the address you sign in with.
 *
 * TWO STEPS, and the address does not move until the second one. The code
 * goes to the NEW mailbox, so answering it is the proof that the person
 * asking can actually read mail there. Writing the address straight in would
 * mean a typo locks the owner out of their own portal, and a wrong address
 * typed deliberately hands a stranger the password-reset route.
 *
 * Two steps rather than one form for the same reason the password card has
 * three: somebody who mistypes the address should find out when the code does
 * not arrive, with their old address still working, not afterwards.
 */

type Stage = "closed" | "ask" | "code";

export default function ChangeEmailCard({ current, onChanged }: {
  /** The address in use now, so the card can say what is being replaced. */
  current?: string | null;
  /** Called once the change is complete, so the page can re-read itself. */
  onChanged?: () => void;
}) {
  const [stage, setStage] = useState<Stage>("closed");
  const [next, setNext] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setStage("closed");
    setNext("");
    setCode("");
    setSentTo("");
    setError("");
  };

  /** Step one: take the address and have a code sent to it. */
  const ask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await portalApi.requestEmailChange({ email: next.trim() });
      setSentTo(next.trim());
      setStage("code");
      toast(response.data.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /** Step two: the code comes back, so the address is theirs. */
  const confirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await portalApi.confirmEmailChange({ code });
      toast(response.data.message);
      reset();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /* Backing out has to clear the pending address on the SERVER too, or a
     half-finished change sits there and the next code goes to it. */
  const abandon = async () => {
    try {
      await portalApi.cancelEmailChange();
    } catch {
      /* Nothing to undo if it was never stored. */
    }
    reset();
  };

  return (
    <Card title="Sign-in email">
      {stage === "closed" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            You sign in with{" "}
            <strong className="text-dark">{current || "no address on file"}</strong>.
          </p>
          <button
            type="button"
            onClick={() => setStage("ask")}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-primary/40 px-5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            <FiMail aria-hidden="true" className="h-4 w-4" /> Change it
          </button>
        </div>
      )}

      {stage === "ask" && (
        <form onSubmit={ask} className="space-y-4">
          <p className="rounded-xl bg-secondary/60 px-4 py-3 text-sm leading-relaxed text-gray-600">
            We will send a 6-digit code to the new address. Your current
            address keeps working until you enter it.
          </p>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-dark">New email address</span>
            <input
              type="email"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={inputClasses}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              required
            />
          </label>

          {error && <p className="text-sm font-medium text-danger">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={reset}
              className="cursor-pointer rounded-full border border-gray px-5 py-2 text-sm font-semibold text-dark transition hover:border-primary/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || next.trim() === ""}
              className="cursor-pointer rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send the code"}
            </button>
          </div>
        </form>
      )}

      {stage === "code" && (
        <form onSubmit={confirm} className="space-y-4">
          <p className="flex items-start gap-3 rounded-xl bg-secondary/60 px-4 py-3 text-sm leading-relaxed text-gray-600">
            <FiMail aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>
              A 6-digit code went to <strong className="text-dark">{sentTo}</strong>.
              Enter it to finish. Until you do, you still sign in with your old
              address.
            </span>
          </p>

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

          {error && <p className="text-sm font-medium text-danger">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={abandon}
              className="cursor-pointer rounded-full border border-gray px-5 py-2 text-sm font-semibold text-dark transition hover:border-primary/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || code.length < 6}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              <FiCheck aria-hidden="true" className="h-4 w-4" />
              {busy ? "Checking…" : "Confirm the change"}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
