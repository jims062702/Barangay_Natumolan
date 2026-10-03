import { useState, useEffect } from "react";
import { FiAlertTriangle, FiCheckCircle } from "react-icons/fi";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { populationApi } from "../../../population/api";
import type { Resident } from "../../../../shared/types";
import type { ResidentRecordState } from "../../hooks/useResidentRecord";

/**
 * Giving a resident a portal account they do not have yet.
 */
export function IssueAccountModal({ ctx, resident }: {
  ctx: ResidentRecordState;
  resident: Resident;
}) {
  const {
    accountOpen,
    setAccountOpen,
    issueAccount,
    accountEmail,
    setAccountEmail,
    accountDraft,
    issuingAccount,
  } = ctx;

  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [isEmailAvailable, setIsEmailAvailable] = useState<boolean | null>(null);

  // Live duplicate/validity check on accountEmail without hitting a button
  useEffect(() => {
    if (!accountOpen) {
      setEmailWarning(null);
      setIsEmailAvailable(null);
      setCheckingEmail(false);
      return;
    }

    const trimmed = accountEmail.trim();

    if (!trimmed) {
      setEmailWarning(null);
      setIsEmailAvailable(null);
      setCheckingEmail(false);
      return;
    }

    // Basic email format check before asking backend
    const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!isValidFormat) {
      setEmailWarning("Please enter a valid email address format (e.g. name@example.com).");
      setIsEmailAvailable(false);
      setCheckingEmail(false);
      return;
    }

    setCheckingEmail(true);
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const response = await populationApi.checkAccountEmail(resident.id, trimmed);
        if (cancelled) return;

        const data = response.data?.data;
        if (data && data.available === false) {
          setEmailWarning(data.message || "This email address is already in use.");
          setIsEmailAvailable(false);
        } else {
          setEmailWarning(null);
          setIsEmailAvailable(true);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        // If the check returns an error or conflict
        const resData = (err as { response?: { data?: { message?: string } } })?.response?.data;
        if (resData?.message) {
          setEmailWarning(resData.message);
          setIsEmailAvailable(false);
        } else {
          setEmailWarning(null);
          setIsEmailAvailable(null);
        }
      } finally {
        if (!cancelled) {
          setCheckingEmail(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accountEmail, accountOpen, resident.id]);

  const canSubmit =
    !issuingAccount &&
    !checkingEmail &&
    !emailWarning &&
    accountEmail.trim().length > 0 &&
    isEmailAvailable !== false;

  return (
    <Modal open={accountOpen} onClose={() => setAccountOpen(false)} title="Issue resident portal account">
      <p className="mb-4 rounded-xl bg-primary/10 px-4 py-2.5 text-xs leading-relaxed text-dark">
        The password is set automatically to the resident's{" "}
        <strong>Last name + birthyear (YY)</strong> — e.g. Gasang2002 — and they activate the
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
            className={`${inputClasses} ${
              emailWarning ? "border-danger focus:border-danger focus:ring-danger/20" : ""
            }`}
            placeholder="resident@email.com"
            disabled={issuingAccount}
          />
        </FormField>

        {/* Live Warning / Status without hitting submit */}
        {checkingEmail && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-gray-400 border-t-transparent" />
            Checking email availability…
          </p>
        )}

        {emailWarning && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs font-medium text-danger leading-relaxed animate-in fade-in"
          >
            <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <span>{emailWarning}</span>
          </div>
        )}

        {!emailWarning && isEmailAvailable && !checkingEmail && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 animate-in fade-in">
            <FiCheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>This email address is available.</span>
          </div>
        )}

        <DraftNotice draft={accountDraft} />

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {issuingAccount ? (
            <span className="inline-flex items-center justify-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Issuing account &amp; emailing details…
            </span>
          ) : (
            "Issue account & email the details"
          )}
        </button>
      </form>
    </Modal>
  );
}
