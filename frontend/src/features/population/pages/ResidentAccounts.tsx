import { useEffect, useState } from "react";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import PageHeader from "../../../shared/ui/PageHeader";
import SearchInput from "../../../shared/ui/SearchInput";
import type { User } from "../../../shared/types";
import { populationApi } from "../api";

export default function ResidentAccounts() {
  const [rows, setRows] = useState<User[]>([]);

  const [search, setSearch] = useState("");
  // "Not activated" is the list this office actually works: those accounts
  // exist but nobody has proved the mailbox behind them is theirs.
  const [activation, setActivation] = useState<"" | "pending" | "done">("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  // So the footer can say WHICH rows are on screen, not only the page.
  const [total, setTotal] = useState(0);
  /*
   * How many sit under each chip. Of the whole list rather than the page,
   * and unmoved by which chip is picked — otherwise the chosen one would
   * read its total and every other would read zero, which is exactly the
   * question the chips are there to answer.
   */
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is
   * reading; a first load or a filter change should still say it is
   * working. Same fetch, and only the announcement differs.
   */
  const load = (silent = false) => {
    if (!silent) setLoading(true);
    populationApi.accounts({
        params: { page, search: search || undefined, activation: activation || undefined },
      })
      .then((r) => {
        setRows(r.data.data.data ?? []);
        setCounts(r.data.data.counts ?? {});
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, activation]);

  // Live updates without a manual refresh.
  useAutoRefresh(() => load(true), REFRESH.staff);

  /*
   * Somebody else's change, about a second after they make it.
   *
   * The timer above stays as a backstop: if the pulse cannot be
   * reached the page is a few seconds stale rather than frozen.
   */
  usePulse("users", () => load(true));

  /** "I never got the email" — sends the resident a fresh activation code. */
  const resend = async (user: User) => {
    try {
      const response = await populationApi.resendActivation(user.id);
      toast(response.data.message);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <div>
      <PageHeader
        title="Resident Portal Accounts"
        subtitle="Created automatically when a resident is registered. Each one stays inactive until the resident enters the code emailed to them."
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search by name or email…"
            label="Search resident accounts"
            className="max-w-sm flex-1"
          />
          <div className="flex gap-2">
            {(
              [
                ["", "All"],
                ["pending", "Not activated"],
                ["done", "Activated"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => {
                  setActivation(value);
                  setPage(1);
                }}
                className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                  activation === value ? "bg-primary text-white" : "bg-secondary text-dark hover:bg-primary/10"
                }`}
              >
                {label}
                {value && counts[value] ? (
                  <span className="ml-1.5 opacity-70">{counts[value]}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          columns={[
            { header: "Name", render: (u: User) => <span className="font-medium text-dark">{u.name}</span> },
            { header: "Email", render: (u: User) => u.email },
            {
              header: "Resident No.",
              render: (u: User) => u.resident?.resident_number ?? "—",
            },
            { header: "Purok", render: (u: User) => u.resident?.zone_purok ?? "—" },
            {
              // Two separate things, so they get two separate columns:
              // whether the office allows this login at all, and whether the
              // resident has confirmed the mailbox is theirs.
              header: "Sign-in",
              render: (u: User) =>
                u.is_active ? (
                  <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Enabled</span>
                ) : (
                  <span className="rounded-full bg-gray px-2.5 py-1 text-xs font-semibold text-gray-500">Disabled</span>
                ),
            },
            {
              header: "Email verified",
              render: (u: User) =>
                u.activated_at ? (
                  <span className="text-xs text-gray-500">
                    {new Date(u.activated_at).toLocaleDateString("en-PH")}
                  </span>
                ) : (
                  <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
                    Not activated
                  </span>
                ),
            },
            {
              header: "",
              render: (u: User) => (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {!u.activated_at && (
                    <button
                      type="button"
                      onClick={() => resend(u)}
                      className="cursor-pointer rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                      title="Email this resident a fresh 6-digit activation code"
                    >
                      Resend code
                    </button>
                  )}
                  {/*
                    "Set password" and "Disable" are gone.

                    Setting a resident's password at the counter meant an
                    office typing a credential the resident then had to be
                    told — which is the office knowing how to sign in as
                    them. A resident who cannot reach their email gets a
                    fresh activation code instead, which is the button
                    beside this one.
                  */}
                </div>
              ),
            },
          ]}
          rows={rows}
          rowKey={(u) => u.id}
          numbered
          total={total}
          loading={loading}
          emptyMessage="No portal accounts match this view."
          page={page}
          lastPage={lastPage}
          onPageChange={setPage}
        />
      </Card>

    </div>
  );
}
