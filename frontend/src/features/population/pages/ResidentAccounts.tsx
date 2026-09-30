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
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

/**
 * One of the two lists the sidebar's Portal Accounts opens into.
 *
 * "Not activated" is the list this office actually works: those accounts
 * exist but nobody has proved the mailbox behind them is theirs. Which list
 * this is comes from the address, so each one can be opened, bookmarked and
 * lit in the sidebar on its own.
 */
export default function ResidentAccounts({ activation }: { activation: "pending" | "done" }) {
  const [rows, setRows] = useState<User[]>([]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  // So the footer can say WHICH rows are on screen, not only the page.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();

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
        params: { page, search: search || undefined, activation },
      })
      .then((r) => {
        setRows(r.data.data.data ?? []);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
      })
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => undefined)
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

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => load()} />;

  return (
    <div>
      <PageHeader
        crumbs={[
          { label: "Population Office" },
          { label: "Portal Accounts" },
          { label: activation === "pending" ? "Not activated" : "Activated" },
        ]}
        title={activation === "pending" ? "Portal Accounts — Not activated" : "Portal Accounts — Activated"}
        subtitle={
          activation === "pending"
            ? "Issued, and waiting on the resident to enter the code emailed to them. Until they do, they cannot sign in."
            : "Residents who have entered their code and can sign in to the portal."
        }
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search by Name or Email…"
            label="Search resident accounts"
            className="max-w-sm flex-1"
          />
        </div>

        <DataTable
          columns={[
            { header: "Name", render: (u: User) => <span className="font-medium text-dark">{u.name}</span> },
            { header: "Email", render: (u: User) => u.email },
            {
              header: "Resident Number",
              render: (u: User) => u.resident?.resident_number ?? "—",
            },
            { header: "Zone / Purok", render: (u: User) => u.resident?.zone_purok ?? "—" },
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
