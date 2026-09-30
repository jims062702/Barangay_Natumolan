import { FiShield, FiMapPin, FiClock, FiSend } from "react-icons/fi";
import { Link } from "react-router-dom";

/**
 * Where a complaint of violence has to go instead, said calmly.
 *
 * KP mediation is PROHIBITED for violence against women and children, and
 * the reason is not procedural: mediation puts a survivor in a room with the
 * person who hurt her and asks them to agree. So this form refuses, and the
 * refusal has to do more than refuse — somebody who has just typed out what
 * happened to them and pressed a button is owed the next step, not an error.
 *
 * Shown in two situations, deliberately with the same words:
 *
 *   as a WARNING   while the narrative is being typed, before anything has
 *                  been sent anywhere. Nothing is stored, and she can stop.
 *   as the SERVER'S refusal, if it is sent anyway.
 *
 * NO BARANGAY HOTLINE IS PRINTED HERE. The only barangay number this system
 * holds is a placeholder, and a number that does not answer is worse than no
 * number at all to somebody dialling it at night. 911 is printed because it
 * is the national emergency line and certainly answers.
 */
export function VawcRedirect({
  message,
  tone = "refusal",
  reportPath = "/vawc-complaint",
}: {
  /** The server's own words, when it refused. */
  message?: string | null;
  tone?: "refusal" | "warning";
  /** Where a RESIDENT reports it online instead: the VAW Desk's own form. */
  reportPath?: string;
}) {
  const warning = tone === "warning";

  return (
    <div
      role="alert"
      className={`rounded-3xl border p-6 ${
        warning ? "border-warning/50 bg-warning/5" : "border-danger/40 bg-danger/5"
      }`}
    >
      <div className="flex items-start gap-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            warning ? "bg-warning/15 text-warning" : "bg-danger/10 text-danger"
          }`}
        >
          <FiShield className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <h2 className={`text-lg font-bold ${warning ? "text-dark" : "text-danger"}`}>
            {warning
              ? "This may need the VAWC Desk, not the Lupon"
              : "This cannot be filed here"}
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-dark">
            {message
              || "This reads as violence against a woman or a child. The Katarungang "
                + "Pambarangay cannot mediate these — the law forbids it, because mediation "
                + "would put you in the same room as the person who hurt you."}
          </p>

          <p className="mt-3 text-sm font-semibold text-dark">
            Go to the Barangay VAWC Desk. They will help you today, and what you
            tell them is confidential.
          </p>

          <p className="mt-2 text-sm text-dark">
            Registered residents of Barangay Natumolan can also send it to the VAW Desk online:{" "}
            <Link to={reportPath} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <FiSend className="h-3.5 w-3.5" aria-hidden="true" /> VAWC Online Complaint
            </Link>
          </p>

          {warning && (
            <p className="mt-3 text-xs leading-relaxed text-gray-600">
              Nothing has been sent yet. If this is not what your complaint is
              about — a fence, a debt, a noise dispute — carry on and file it
              here.
            </p>
          )}

          <dl className="mt-4 space-y-2 text-sm text-dark">
            <div className="flex items-start gap-2">
              <FiMapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              <div>
                <dt className="sr-only">Where</dt>
                <dd>
                  Barangay Hall, Barangay Natumolan, Tagoloan, Misamis Oriental.
                  Ask for the VAWC Desk Officer.
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FiClock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              <div>
                <dt className="sr-only">When</dt>
                {/*
                  Only what is certainly true. This is read by somebody who may
                  be in danger tonight, and a promise that the hall is staffed
                  after hours — which nobody here has confirmed — could send her
                  to a locked door.
                */}
                <dd>
                  Monday – Friday, 8:00 AM – 5:00 PM. Outside those hours, go to
                  the nearest police station and ask for the Women and Children
                  Protection Desk. If you are in danger now, call 911.
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
