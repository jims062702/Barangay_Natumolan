import Card from "../../../../shared/ui/Card";
import { confirmAction, confirmWithReason } from "../../../../shared/lib/confirm";
import { errorMessage } from "../../../../shared/lib/api";
import { toast } from "../../../../shared/lib/toast";
import { useAuth } from "../../../../shared/auth/AuthContext";
import { luponApi } from "../../api";
import type { LuponCase } from "../../types";
import type { LuponCaseState } from "../../hooks/useLuponCase";
import { CLOSED_UNPAID, FEE_DAYS, feeStanding, TONE_CLASSES } from "../../lib/filingFee";

/**
 * A filing fee is a STATUS, not a sum.
 *
 * The complainant pays where the barangay takes payments and shows the
 * official receipt here. The Lupon staff look at it and press Paid — no
 * money passes through the Lupon or the Clerk, and no amount or receipt
 * number is kept. The summons waits on it.
 */
interface Payment {
  id: number;
  kind: "Filing";
  label: string;
  status: "Requested" | "Paid" | "Cancelled";
  paid_at: string | null;
  /** Who saw the receipt, when the case sends it. */
  paid_by_name?: string | null;
}

/**
 * Where the case's fee stands, and what the calendar does next.
 *
 * One card because they are one sequence: nothing is scheduled until the fee
 * is settled, and issuing the summons books three Tuesdays at once.
 */
export function FeeAndScheduleCard({ ctx, caseData }: {
  ctx: LuponCaseState;
  caseData: LuponCase;
}) {
  const { post, load, id } = ctx;
  const { user } = useAuth();

  /* The certificate describes the Lupon's own failed sittings, so the Lupon
     is the office that signs it — not the Punong Barangay, who mediated, and
     not the Secretary, who only keeps the record. */
  const isLupon = user?.office === "Lupon" || user?.office === "Admin";

  const payments = (caseData.payments ?? []) as Payment[];

  /* The live request, if there is one. A cancelled one is not "owed". */
  const filing = payments.find((p) => p.kind === "Filing" && p.status !== "Cancelled");
  const filingPaid = filing?.status === "Paid";

  const stage = caseData.current_stage;
  /* The five ends a case can have. A withdrawn complaint and one certified
     to court are as finished as a settled one — nothing more is scheduled
     on either. */
  const closed = ["Settled", "Dismissed", "Referred", "CFA", "Withdrawn", CLOSED_UNPAID].includes(stage);
  /* The fee's three days, said on the case itself. */
  const fee = feeStanding(caseData);

  /** The sittings of one kind still standing. */
  const scheduled = (type: string) =>
    (caseData.hearings ?? []).filter(
      (h) => h.hearing_type === type && h.status === "Scheduled",
    );

  /* Once a summons is out, the fee it went out on stays paid. */
  const summonsOut = (caseData.hearings ?? []).some((h) => h.summons_issued);

  /*
   * What the certificate rests on: a sitting before the Lupon that was held
   * and ended without agreement. Mirrors CaseFile::conciliationWasTried on
   * the server, which is what actually refuses it.
   */
  const canCertify = (caseData.hearings ?? []).some(
    (h) => h.hearing_type === "Conciliation" && h.status === "Completed" && h.outcome !== "Agreement",
  );

  /** One sentence saying whose desk the case is on, in the office's words. */
  const whereItStands = {
    "For Summons":
      "Forwarded to the Barangay Secretary. Printing the summons there books three Tuesdays with the Punong Barangay.",
    "For Lupon Summons":
      "The three Tuesdays are spent with no agreement, so the case is with the Lupon. Printing the summons there books three Thursdays.",
  }[stage] ?? (filingPaid
    ? "The sittings are on the calendar below."
    : "Nothing moves until the filing fee is confirmed. Confirming it forwards the case to the Barangay Secretary.");

  const standing = scheduled("Conciliation").length > 0
    ? { n: scheduled("Conciliation").length, day: "Thursday", who: "the Lupon" }
    : scheduled("Mediation").length > 0
      ? { n: scheduled("Mediation").length, day: "Tuesday", who: "the Punong Barangay" }
      : null;

  const sittingsNote = standing
    ? `${standing.n} ${standing.day}${standing.n === 1 ? "" : "s"} with ${standing.who} `
      + `${standing.n === 1 ? "is" : "are"} on the calendar`
      + (summonsOut ? ", and both parties have been told." : ".")
    : null;

  /** The receipt was shown: Paid. Asked first — it is what lets the summons go. */
  const markPaid = async () => {
    if (!(await confirmAction({
      title: "Has the complainant shown the official receipt?",
      text: "Mark it paid only after seeing the receipt. No amount is recorded — only that the filing fee is paid.",
      confirmText: "Yes, paid",
    }))) return;
    post(() => luponApi.markFeePaid(id), undefined);
  };

  /** A mis-click, put right — before the summons goes out. */
  const undoPaid = async () => {
    if (!(await confirmAction({
      title: "Put the filing fee back to unpaid?",
      text: "Only if Paid was pressed by mistake. The summons will wait until the receipt is seen.",
      confirmText: "Yes, undo",
    }))) return;
    post(() => luponApi.undoFeePaid(id), undefined);
  };

  /**
   * The case goes to court, and the register says on what.
   *
   * The reason is the certificate's whole content — "the parties failed to
   * settle after three sittings", "the respondent never appeared" — and it
   * is what the monthly transmittal carries in Remarks.
   */
  const certify = async () => {
    const reason = await confirmWithReason({
      title: "Certify this case to file action?",
      text: "The case closes at the Lupon and the complainant may take it to court.",
      placeholder: "e.g. The parties failed to reach an agreement after three sittings.",
      required: "Say what the certification rests on.",
      confirmText: "Yes, certify",
      danger: true,
    });
    if (reason === null) return;

    /* Not through `post`: it asks "save this change?" of its own, and the
       box above already asked — twice in a row reads as a bug. */
    try {
      const response = await luponApi.certifyToFileAction(caseData.id, { reason });
      toast(response.data.message ?? "Certified to file action.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  /*
   * There is no `act` helper any more. It confirmed the one button that
   * changed the calendar from this card — "Send to the Lupon" — and a case
   * now leaves the Punong Barangay when its third Tuesday is spent, not
   * when somebody here decides it has been long enough.
   */

  return (
    <Card title="Fee & hearing schedule">
      <div className="flex flex-col gap-3 text-sm">

        {/* 1 — the filing fee */}
        <div className="rounded-xl border border-gray/70 px-3.5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-dark">Filing fee</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Press Paid once the complainant shows you the official receipt.
                Nothing on the case moves until then. It must be paid within {FEE_DAYS} calendar
                days of filing, or the case closes unpaid.
              </p>
            </div>
            {filingPaid ? (
              <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                Paid
              </span>
            ) : (
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[fee?.tone ?? "warning"]}`}>
                {fee?.label ?? "Unpaid"}
              </span>
            )}
          </div>

          {!filingPaid && fee && (
            <p
              data-testid="fee-deadline"
              className={`mt-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${TONE_CLASSES[fee.tone]}`}
            >
              {fee.detail}
            </p>
          )}
          {stage === CLOSED_UNPAID && caseData.closure_reason && (
            <p className="mt-1.5 text-xs text-gray-500">
              {caseData.closure_reason}
              {caseData.auto_closed_at && ` Closed by the system on ${new Date(caseData.auto_closed_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}.`}
              {" "}The case and its history are kept; the complainant may file again.
            </p>
          )}

          {filingPaid && filing?.paid_at && (
            <p className="mt-1.5 text-xs text-gray-400">
              Receipt seen {new Date(filing.paid_at).toLocaleDateString("en-PH")}
              {filing.paid_by_name ? ` by ${filing.paid_by_name}` : ""}
              {!summonsOut && !closed && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => void undoPaid()}
                    className="cursor-pointer font-semibold text-primary hover:underline"
                  >
                    Undo
                  </button>
                </>
              )}
            </p>
          )}

          {!filingPaid && !closed && (
            <button
              type="button"
              onClick={() => void markPaid()}
              className="mt-2.5 cursor-pointer rounded-full bg-success px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90"
            >
              Paid
            </button>
          )}
        </div>

        {/*
          2 — where the case stands, and who has it.

          NOTHING IS BOOKED FROM HERE, and nothing is booked by the fee.
          Confirming the receipt FORWARDS the case: to the Barangay
          Secretary, who prints the summons, and that printing is what puts
          three Tuesdays on the calendar. When the three are spent the case
          comes to the Lupon, which prints again for three Thursdays. So
          this card reports rather than acts — the press that matters is in
          the hearing room's "For summons" list, at whichever desk holds it.
        */}
        {!closed && (
          <div className="rounded-xl border border-gray/70 px-3.5 py-3">
            <p className="font-medium text-dark">Summons &amp; sittings</p>
            <p className="mt-0.5 text-xs text-gray-500">{whereItStands}</p>
            {sittingsNote && <p className="mt-1.5 text-xs text-gray-500">{sittingsNote}</p>}
          </div>
        )}

        {/*
          3 — the certificate to file action.

          Pressed by hand, never reached by the system on its own: whether
          the parties have run out of the barangay's process is a judgement
          made in front of them, and the complainant may ask for it or carry
          on. But not before a sitting before the LUPON has been held and
          failed — the certificate states that the barangay's process was
          tried, and a court can send back one issued before the Lupon ever
          sat, which costs the complainant months. The Lupon alone signs it:
          it describes their own sittings. No fee and no stamp; this system
          handles no money.
        */}
        {!closed && isLupon && (
          <div className="rounded-xl border border-gray/70 px-3.5 py-3">
            <p className="font-medium text-dark">Certify to file action</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {canCertify
                ? "Closes the case here and frees the complainant to go to court. Every sitting still on the calendar is stood down."
                : "Available once a sitting before the Lupon has been held without agreement. The complainant may ask for it from that sitting on."}
            </p>
            {canCertify && (
              <button
                type="button"
                onClick={() => void certify()}
                className="mt-2.5 cursor-pointer rounded-full border border-danger/50 px-3.5 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger hover:text-white"
              >
                Certify to file action
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
