import { FiEdit2, FiUserX, FiUserCheck, FiTrash2 } from "react-icons/fi";
import { Link } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import SearchInput from "../../../shared/ui/SearchInput";
import DataTable from "../../../shared/ui/DataTable";
import RowAction, { RowActions } from "../../../shared/ui/RowAction";
import type { User } from "../../../shared/types";
import type { AccountAdminState } from "../hooks/useAccountAdmin";

/**
 * The accounts, staff or residents, with their state.
 */
export function AccountTable({ ctx, kind }: {
  ctx: AccountAdminState;
  kind: "staff" | "resident";
}) {
  const {
    counts, search, setSearch, setPage, startEdit, toggle, remove, rows, total, loading, page,
    lastPage,
  } = ctx;

  return (
    <Card>
      <div className="mb-4">
        {counts && (
          <p className="w-full text-xs text-gray-500">
            {kind === "staff" ? (
              <>
                <span className="font-semibold text-dark">{counts.staff}</span> staff
                account{counts.staff === 1 ? "" : "s"} · {counts.resident} resident
                account{counts.resident === 1 ? "" : "s"} are in{" "}
                <Link to="/admin/residents" className="font-semibold text-primary hover:underline">
                  Resident Accounts
                </Link>
                .
              </>
            ) : (
              <>
                <span className="font-semibold text-dark">{counts.resident}</span> resident
                account{counts.resident === 1 ? "" : "s"} · {counts.staff} staff
                account{counts.staff === 1 ? "" : "s"} are in{" "}
                <Link to="/admin/users" className="font-semibold text-primary hover:underline">
                  Staff Accounts
                </Link>
                .
              </>
            )}
          </p>
        )}

        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search by name or email…"
          label="Search users"
          className="max-w-sm flex-1"
        />
      </div>

      <DataTable
        columns={[
          { header: "Name", render: (u: User) => <span className="font-medium text-dark">{u.name}</span> },
          { header: "Email", render: (u: User) => u.email },
          { header: "Role", render: (u: User) => u.role },
          { header: "Office", render: (u: User) => u.office },
          {
            header: "Status",
            render: (u: User) =>
              u.is_active ? (
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Active</span>
              ) : (
                <span className="rounded-full bg-gray px-2.5 py-1 text-xs font-semibold text-gray-500">Inactive</span>
              ),
          },
          {
            header: "",
            /*
              One column of round icon buttons, the same shape every other
              register in the system uses. Three text pills in three columns
              were written for this page alone.
            */
            render: (u: User) => (
              <RowActions>
                <RowAction
                  label="Edit this account"
                  icon={FiEdit2}
                  tone="primary"
                  onClick={() => startEdit(u)}
                />
                <RowAction
                  label={u.is_active ? "Deactivate this account" : "Activate this account"}
                  icon={u.is_active ? FiUserX : FiUserCheck}
                  tone={u.is_active ? "danger" : "default"}
                  onClick={() => toggle(u)}
                />
                <RowAction
                  label="Delete this account for good"
                  icon={FiTrash2}
                  tone="danger"
                  onClick={() => remove(u)}
                />
              </RowActions>
            ),
          },
        ]}
        rows={rows}
        rowKey={(u) => u.id}
        numbered
        total={total}
        loading={loading}
        page={page}
        lastPage={lastPage}
        onPageChange={setPage}
      />
    </Card>
  );
}
