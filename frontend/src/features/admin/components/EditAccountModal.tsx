import Modal from "../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import { ROLE_OFFICE } from "../lib/roles";
import type { AccountAdminState } from "../hooks/useAccountAdmin";

/**
 * Changing a staff or resident account.
 */
export function EditAccountModal({ ctx }: { ctx: AccountAdminState }) {
  const {
    editing, setEditing, saveEdit, name, setName, email, setEmail, password, setPassword, role,
    setRole,
  } = ctx;

  return (
    <Modal
      open={editing !== null}
      onClose={() => setEditing(null)}
      title={editing ? `Edit ${editing.name}` : "Edit account"}
    >
      <form onSubmit={saveEdit} className="space-y-4">
        <FormField label="Full name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputClasses}
          />
        </FormField>

        <FormField label="Email" required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClasses}
          />
        </FormField>

        {/*
          Blank leaves it alone.

          The alternative — showing a box that looks empty because passwords
          cannot be read back — invites somebody to save the form and wipe
          the password without meaning to.
        */}
        <FormField
          label="New password"
          hint="Leave blank to keep their current one"
        >
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            autoComplete="off"
            className={inputClasses}
          />
        </FormField>

        {editing?.role === "Resident" ? (
          /*
           * A resident's role is not editable here. Turning somebody on the
           * register into a staff member is a decision an office makes, not
           * a dropdown on a correction form.
           */
          <div className="rounded-xl border border-gray bg-secondary/60 px-4 py-3 text-sm leading-relaxed text-gray-600">
            This is a resident&apos;s portal account. Their name, email and
            password can be corrected here; making somebody staff is done by
            creating a staff account for them.
          </div>
        ) : (
          <FormField label="Role" required hint={`Office: ${ROLE_OFFICE[role] ?? "—"}`}>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={inputClasses}
            >
              {Object.keys(ROLE_OFFICE).map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </FormField>
        )}

        <div className="flex justify-end gap-3 border-t border-gray pt-4">
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="cursor-pointer rounded-full border border-gray px-5 py-2.5 text-sm font-semibold text-dark transition hover:border-primary/50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="cursor-pointer rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}
