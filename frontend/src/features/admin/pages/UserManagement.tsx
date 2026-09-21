import NeedsConnection from "../../../shared/offline/NeedsConnection";
import { FiEdit2, FiPlus } from "react-icons/fi";
import Card from "../../../shared/ui/Card";
import Modal from "../../../shared/ui/Modal";
import PageHeader from "../../../shared/ui/PageHeader";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import { ROLE_OFFICE } from "../lib/roles";
import { useAccountAdmin } from "../hooks/useAccountAdmin";
import { AccountTable } from "../components/AccountTable";
import { EditAccountModal } from "../components/EditAccountModal";
import { SelfAccountModal } from "../components/SelfAccountModal";

export default function UserManagement({
  /*
   * Which register this is. Taken from the route rather than a tab, so the
   * two lists are two places in the sidebar and each keeps its own address.
   */
  kind = "staff",
}: {
  kind?: "staff" | "resident";
} = {}) {
  const ctx = useAccountAdmin({ kind });
  const {
    user, createOpen, setCreateOpen, name, setName, email, setEmail, password, setPassword,
    role, setRole, openSelf, create,
  offline,
  } = ctx;

  return (
    <div>
      <PageHeader
        title={kind === "staff" ? "Staff User Accounts" : "Resident Portal Accounts"}
        subtitle={
          kind === "staff"
            ? "Create and manage office staff accounts."
            : "Portal accounts for residents. New ones are issued by the Population Office when a resident is registered; they can be corrected, disabled or removed here."
        }
        /* Only the staff register makes accounts. A resident's is issued by
           the Population Office at the moment they are registered. */
        actions={
          kind === "staff" ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <FiPlus className="h-4 w-4" aria-hidden="true" /> New staff account
            </button>
          ) : undefined
        }
      />

      {offline && (
        <NeedsConnection what="the account list" why="Who may do what is decided by the server every time it is asked, so accounts are never read from a copy held here." />
      )}

      {/*
        Your own account, on the staff register only.

        It is not in the list any more, and there is nowhere else in the
        system that reaches it — so it sits here, with the two destructive
        buttons deliberately absent.
      */}
      {kind === "staff" && user && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-dark">
                {user.name} <span className="font-normal text-gray-400">· you</span>
              </p>
              <p className="truncate text-xs text-gray-500">
                {user.email} · {user.role}
              </p>
            </div>
            <button
              type="button"
              onClick={openSelf}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-primary/40 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
            >
              <FiEdit2 className="h-4 w-4" aria-hidden="true" /> Edit my account
            </button>
          </div>
        </Card>
      )}

      <AccountTable ctx={ctx} kind={kind} />

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Staff Account">
        <form onSubmit={create} className="space-y-4">
          <FormField label="Full name" required>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClasses} />
          </FormField>
          <FormField label="Email" required>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClasses} />
          </FormField>
          <FormField label="Temporary password" required hint="At least 8 characters">
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={inputClasses} />
          </FormField>
          <FormField label="Role" required hint={`Office: ${ROLE_OFFICE[role]}`}>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClasses}>
              {Object.keys(ROLE_OFFICE).map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </FormField>
          <button type="submit" className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
            Create account
          </button>
        </form>
      </Modal>

      <EditAccountModal ctx={ctx} />

      <SelfAccountModal ctx={ctx} />
    </div>
  );
}

