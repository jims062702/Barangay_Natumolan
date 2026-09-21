import { useEffect, useState } from "react";
import { FiCheck, FiRotateCcw } from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import { RowsSkeleton } from "../../../../shared/ui/Skeleton";
import { errorMessage } from "../../../../shared/lib/api";
import { toast } from "../../../../shared/lib/toast";
import { luponApi } from "../../../lupon/api";

/**
 * Lupon filing fees: paid, or not.
 *
 * THIS REPLACED A PAYMENTS MODULE. That page had amounts, documentary stamps,
 * receipt numbers and a day's collection total — a cash book for money this
 * system never touched. The barangay takes the fee at the counter and keeps
 * its own book; a second one kept here could only disagree with it, and the
 * day it disagreed somebody would be accused.
 *
 * What the Lupon actually needs is one bit: has this complainant paid? The
 * summons is blocked until they have. So the Clerk marks it, and that is the
 * whole of it.
 *
 * It sits on the dashboard rather than behind its own menu entry because it
 * is a short list somebody clears in the morning, not a place to work.
 */

interface FeeRow {
  id: number;
  status: "Requested" | "Paid" | "Cancelled";
  paid_at: string | null;
  lupon_case?: {
    case_number: string;
    case_title: string;
    complainant_name?: string | null;
    complainant?: { first_name: string; last_name: string } | null;
  } | null;
}

const payerOf = (row: FeeRow) => {
  const c = row.lupon_case;
  if (!c) return "—";
  return c.complainant
    ? `${c.complainant.first_name} ${c.complainant.last_name}`
    : c.complainant_name || "—";
};

export default function LuponFeesCard() {
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () =>
    luponApi.payments({ params: { status: "all" } })
      .then((r) => setRows(r.data.data.payments?.data ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mark = async (row: FeeRow, paid: boolean) => {
    setBusy(row.id);
    try {
      const r = await luponApi.markPayment(row.id, { paid });
      toast(r.data.message);
      await load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  };

  /* Cancelled requests are not the counter's business — the Lupon withdrew
     them, and showing them here would be a row nobody can act on. */
  const live = rows.filter((r) => r.status !== "Cancelled");
  const waiting = live.filter((r) => r.status === "Requested").length;

  return (
    <Card
      title="Lupon filing fees"
      action={
        waiting > 0 ? (
          <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
            {waiting} to confirm
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <RowsSkeleton rows={3} what="the fee list" />
      ) : live.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          No Lupon case is waiting on its filing fee.
        </p>
      ) : (
        <ul className="space-y-2">
          {live.map((row) => {
            const paid = row.status === "Paid";

            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-dark">
                    {payerOf(row)}
                    <span className="ml-2 font-mono text-[11px] font-normal text-gray-400">
                      {row.lupon_case?.case_number}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {row.lupon_case?.case_title}
                    {paid && row.paid_at && (
                      <> · marked paid {new Date(row.paid_at).toLocaleDateString("en-PH")}</>
                    )}
                  </p>
                </div>

                {/*
                  One button, and it says what pressing it does.

                  Reversible on purpose: the status is set by hand, so a
                  mis-click has to be correctable by hand or the fix becomes
                  a database edit.
                */}
                <button
                  type="button"
                  disabled={busy === row.id}
                  onClick={() => mark(row, !paid)}
                  className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    paid
                      ? "border border-gray text-gray-500 hover:border-danger/50 hover:text-danger"
                      : "bg-primary text-white hover:bg-primary-dark"
                  }`}
                >
                  {paid ? (
                    <>
                      <FiRotateCcw aria-hidden="true" className="h-3.5 w-3.5" /> Mark unpaid
                    </>
                  ) : (
                    <>
                      <FiCheck aria-hidden="true" className="h-3.5 w-3.5" /> Mark paid
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
