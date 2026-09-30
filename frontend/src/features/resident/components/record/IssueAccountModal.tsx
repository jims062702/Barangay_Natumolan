import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import type { Resident } from "../../../../shared/types";
import type { ResidentRecordState } from "../../hooks/useResidentRecord";

/**
 * Giving a resident a portal account they do not have yet.
 */
export function IssueAccountModal({ ctx, resident }: {
  ctx: ResidentRecordState;
  resident: Resident;
}) {
  const { accountOpen, setAccountOpen, issueAccount, accountEmail, setAccountEmail, accountDraft } = ctx;

  return (
    <Modal open={accountOpen} onClose={() => setAccountOpen(false)} title="Issue resident portal account">
      <p className="mb-4 rounded-xl bg-primary/10 px-4 py-2.5 text-xs leading-relaxed text-dark">
        The password is set automatically to the resident's{" "}
        <strong>last name + birthday (MMDDYY)</strong> — e.g. Cruz062702 — and they activate the
        account themselves with a code emailed to this address.
      </p>
      <form onSubmit={issueAccount} className="space-y-4">
        <FormField
          label="Login email"
          required
          hint={
            resident.email
              ? "From the resident's record. Change it here to update the record too."
              : "This resident has no email on file — enter one to proceed (it will be saved)."
          }
        >
          <input
            type="email"
            value={accountEmail}
            onChange={(e) => setAccountEmail(e.target.value)}
            required
            className={inputClasses}
            placeholder="resident@email.com"
          />
        </FormField>
        <DraftNotice draft={accountDraft} />
        <button
          type="submit"
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Issue account &amp; email the details
        </button>
      </form>
    </Modal>
  );
}
