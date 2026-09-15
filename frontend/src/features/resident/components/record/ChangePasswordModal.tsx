import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import type { Resident } from "../../../../shared/types";
import type { ResidentRecordState } from "../../hooks/useResidentRecord";

/**
 * Setting a resident's portal password at the counter.
 */
export function ChangePasswordModal({ ctx, resident }: {
  ctx: ResidentRecordState;
  resident: Resident;
}) {
  const { passOpen, setPassOpen, changePassword, newPassword, setNewPassword } = ctx;

  return (
    <Modal open={passOpen} onClose={() => setPassOpen(false)} title="Change portal password">
      <p className="mb-4 rounded-xl bg-primary/10 px-4 py-2.5 text-xs text-dark">
        Account: <strong>{resident.account?.email}</strong>. Set a new password
        and share it with the resident securely.
      </p>
      <form onSubmit={changePassword} className="space-y-4">
        <FormField
          label="New password"
          required
          hint="Defaults to Lastname + birthday (MMDDYY), e.g. Cruz062702."
        >
          <input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            className={inputClasses}
          />
        </FormField>
        <button
          type="submit"
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Update password
        </button>
      </form>
    </Modal>
  );
}
