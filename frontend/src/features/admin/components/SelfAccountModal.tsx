import DraftNotice from "../../../shared/ui/DraftNotice";
import Modal from "../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import type { AccountAdminState } from "../hooks/useAccountAdmin";

/**
 * The administrator's own account.
 */
export function SelfAccountModal({ ctx }: { ctx: AccountAdminState }) {
  const {
    selfOpen, setSelfOpen, saveSelf, selfName, setSelfName, selfEmail, setSelfEmail,
    currentPassword, setCurrentPassword, selfPassword, setSelfPassword, selfDraft,
  } = ctx;

  return (
    <Modal open={selfOpen} onClose={() => setSelfOpen(false)} title="My account">
      <form onSubmit={saveSelf} className="space-y-4">
        <FormField label="Full name" required>
          <input
            value={selfName}
            onChange={(e) => setSelfName(e.target.value)}
            required
            className={inputClasses}
          />
        </FormField>

        <FormField label="Email" required hint="This is where a password reset code would go">
          <input
            type="email"
            value={selfEmail}
            onChange={(e) => setSelfEmail(e.target.value)}
            required
            className={inputClasses}
          />
        </FormField>

        <div className="rounded-xl border border-gray bg-secondary/60 px-4 py-3">
          <p className="mb-3 text-sm font-semibold text-dark">Change my password</p>

          <div className="space-y-3">
            <FormField label="Current password">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className={inputClasses}
              />
            </FormField>

            <FormField label="New password" hint="Leave both blank to keep the one you have">
              <input
                type="password"
                value={selfPassword}
                onChange={(e) => setSelfPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                className={inputClasses}
              />
            </FormField>
          </div>
        </div>

        <DraftNotice draft={selfDraft} passwords />

        <div className="flex justify-end gap-3 border-t border-gray pt-4">
          <button
            type="button"
            onClick={() => setSelfOpen(false)}
            className="cursor-pointer rounded-full border border-gray px-5 py-2.5 text-sm font-semibold text-dark transition hover:border-primary/50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={Boolean(selfPassword) && !currentPassword}
            className="cursor-pointer rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
