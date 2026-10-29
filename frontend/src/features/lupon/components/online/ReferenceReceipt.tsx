import { FiCheckCircle, FiCopy, FiHome, FiInfo, FiAlertTriangle } from "react-icons/fi";
import { useState } from "react";

/**
 * What the barangay says back, and the one number they have to keep.
 *
 * THE REFERENCE NUMBER IS NOT A CASE NUMBER, and this panel exists mostly to
 * make sure nobody leaves believing it is:
 *
 *     OC-2026-0007      what this gives back
 *     2026-09-25-03     what the Lupon's docket gives, later, at the counter
 *
 * A complainant who thinks they have filed a case will not come in, and will
 * then find months later that nothing happened. So the number is shown large
 * because they need it, and immediately under it is the sentence saying what
 * it is not.
 */
export interface FilingOutcome {
  reference_no: string;
  status: string;
  /** The server's own sentence, which differs between those two cases. */
  message: string;
  is_minor?: boolean;
}

export function ReferenceReceipt({ outcome }: { outcome: FilingOutcome }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(outcome.reference_no);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      /* No clipboard permission. The number is on the screen in 24px type;
         it is not lost, it just has to be written down. */
    }
  };

  return (
    <div className="rounded-3xl border border-success/40 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-success/10 text-success">
          <FiCheckCircle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-dark">Your complaint has been received</h2>
          <p className="mt-1 text-sm text-gray-500">
            Status: <span className="font-semibold text-dark">{outcome.status}</span>
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-gray bg-secondary/60 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Online Complaint Reference Number
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <p className="text-2xl font-bold tracking-tight text-dark tabular-nums">
            {outcome.reference_no}
          </p>
          <button
            type="button"
            onClick={copy}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            <FiCopy className="h-3.5 w-3.5" aria-hidden="true" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-gray-600">
          Write this down. It is <strong className="text-dark">not a case number</strong> —
          the Lupon issues that at the office, after the complaint is verified.
        </p>
      </div>

      <div className="mt-5 flex gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3">
        <FiInfo className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-dark">{outcome.message}</p>
      </div>
      {outcome.is_minor && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-amber-950">
          <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
          <div className="text-xs leading-relaxed">
            <p className="font-bold text-amber-900">Parent / Legal Guardian Required</p>
            <p className="mt-0.5 text-amber-800">
              Because you are 17 years old or below, you must bring a parent or legal guardian with you when you visit the Barangay Office to verify and proceed with this complaint.
            </p>
          </div>
        </div>
      )}

      <h3 className="mt-6 text-sm font-bold text-dark">What happens next</h3>
      <ol className="mt-3 space-y-3">
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FiHome className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <p className="text-sm leading-relaxed text-dark">
            <strong>Visit the Barangay Office</strong> (Monday – Friday, 8:00 AM – 5:00 PM)
            with the same ID you photographed. The officer checks it against
            you, reads the complaint with you, and takes any filing fee.
          </p>
        </li>

        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="text-xs font-bold">KP</span>
          </span>
          <p className="text-sm leading-relaxed text-dark">
            <strong>The Lupon accepts it</strong> and the case gets its KP number.
            Both sides are then summoned to a hearing, and the summons names the
            day and the time.
          </p>
        </li>
      </ol>
    </div>
  );
}
