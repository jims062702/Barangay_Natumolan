import Card from "../../../../shared/ui/Card";
import { confirmAction } from "../../../../shared/lib/confirm";
import { useAuth } from "../../../../shared/auth/AuthContext";
import { luponApi } from "../../api";
import type { LuponCase } from "../../types";
import type { LuponCaseState } from "../../hooks/useLuponCase";

/**
 * A filing fee is a STATUS, not a sum.
 *
 * The barangay takes the money at the counter and keeps its own book of it;
 * this system never touched a peso, so the amount, the documentary stamp and
 * the receipt number are gone. What the Lupon reads is the one thing it needs
 * — has the Clerk marked it settled? — because the summons is blocked until
 * they have.
 */
interface Payment {
  id: number;
  kind: "Filing";
  label: string;
  status: "Requested" | "Paid" | "Cancelled";
  paid_at: string | null;
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
  const { post, id } = ctx;
  const { user } = useAuth();

  /* Only the Punong Barangay may send a case on to the Lupon's Thursdays —
     they are the one who sat the mediation. */
  const isPb = user?.role === "Punong Barangay";

  const payments = (caseData.payments ?? []) as Payment[];

  /* The live request, if there is one. A cancelled one is not "owed". */
  const filing = payments.find((p) => p.kind === "Filing" && p.status !== "Cancelled");
  const filingPaid = filing?.status === "Paid";

  const stage = caseData.current_stage;
  const closed = ["Settled", "Dismissed", "Referred"].includes(stage);

  /** The sittings of one kind still standing. */
  const scheduled = (type: string) =>
    (caseData.hearings ?? []).filter(
      (h) => h.hearing_type === type && h.status === "Scheduled",
    );

  /** Asks the Clerk to collect the fee on this case. */
  const ask = (kind: "Filing") =>
    post(() => luponApi.requestPayment(id, { kind }), undefined);

  /** Anything that changes the calendar gets confirmed first. */
  const act = async (
    title: string,
    /* The shape `post` expects: it reads the server's message to toast it. */
    run: () => Promise<{ data: { message?: string } }>,
    confirmText: string,
  ) => {
    if (!(await confirmAction({ title, confirmText }))) return;
    post(run, undefined);
  };

  return (
    <Card title="Fee & hearing schedule">
      <div className="flex flex-col gap-3 text-sm">

        {/* 1 — the filing fee */}
        <div className="rounded-xl border border-gray/70 px-3.5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-dark">Filing fee</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Paid at the Clerk's counter. Nothing on the case moves until
                the Clerk marks it settled.
              </p>
            </div>
            {filingPaid ? (
              <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                Paid
              </span>
            ) : filing ? (
              <span className="shrink-0 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
                With the Clerk
              </span>
            ) : null}
          </div>

          {filingPaid && filing?.paid_at && (
            <p className="mt-1.5 text-xs text-gray-400">
              Marked paid {new Date(filing.paid_at).toLocaleDateString("en-PH")}
            </p>
          )}

          {!filing && !closed && (
            <button
              type="button"
              onClick={() => ask("Filing")}
              className="mt-2.5 cursor-pointer rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Send to the Clerk
            </button>
          )}
        </div>

        {/* 2 — summons, which opens the Tuesdays */}
        {!closed && (
          <div className="rounded-xl border border-gray/70 px-3.5 py-3">
            <p className="font-medium text-dark">Summons &amp; mediation</p>
            {scheduled("Mediation").length > 0 ? (
              <p className="mt-0.5 text-xs text-gray-500">
                {scheduled("Mediation").length} Tuesday
                {scheduled("Mediation").length === 1 ? "" : "s"} with the Punong Barangay are on the
                calendar.
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-gray-500">
                Issuing the summons books three Tuesdays with the Punong Barangay at once — there is
                no next sitting to arrange each week.
              </p>
            )}

            {scheduled("Mediation").length === 0 && stage !== "Conciliation" && (
              <button
                type="button"
                disabled={!filingPaid}
                title={filingPaid ? undefined : "The Clerk has not marked the filing fee paid yet."}
                onClick={() => act(
                  "Issue the summons and book three Tuesdays?",
                  () => luponApi.issueSummons(caseData.id),
                  "Yes, issue summons",
                )}
                className="mt-2.5 cursor-pointer rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Issue summons
              </button>
            )}
          </div>
        )}

        {/* 3 — the Lupon's own three Thursdays. The PB's call, and so the
             PB's card: they are the one who mediated it. */}
        {isPb && !closed && scheduled("Mediation").length > 0 && (
          <div className="rounded-xl border border-gray/70 px-3.5 py-3">
            <p className="font-medium text-dark">If mediation fails</p>
            <p className="mt-0.5 text-xs text-gray-500">
              The Lupon takes it for three Thursdays. Any Tuesday still on the calendar is stood
              down.
            </p>
            <button
              type="button"
              onClick={() => act(
                "Mediation closed with no agreement?",
                () => luponApi.toConciliation(caseData.id),
                "Yes, go to the Lupon",
              )}
              className="mt-2.5 cursor-pointer rounded-full border border-primary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
            >
              Send to the Lupon
            </button>
          </div>
        )}

        {/* 4 — the certificate to court */}
        {/*
          The Certificate to File Action block is gone.

          It asked the Clerk for ₱200 and a ₱30 documentary stamp so a failed
          conciliation could be certified to court. This barangay no longer
          issues that certificate, and this system handles no money at all —
          a conciliation that reaches no agreement is recorded as Dismissed.
        */}
      </div>
    </Card>
  );
}
