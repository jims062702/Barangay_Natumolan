import { useState } from "react";
import Card from "../../../../shared/ui/Card";
import type { Resident } from "../../../../shared/types";
import { Row } from "./Row";
import type { ResidentRecordState } from "../../hooks/useResidentRecord";
import { populationApi } from "../../../population/api";
import { toast } from "../../../../shared/lib/toast";
import { errorMessage } from "../../../../shared/lib/api";
import { confirmAction } from "../../../../shared/lib/confirm";

/**
 * The resident's portal account: whether it exists, and whether it is in use.
 */
export function PortalAccountCard({ ctx, account, activated, resident }: {
  ctx: ResidentRecordState;
  account: { id: number;
  email: string;
  is_active: boolean;
  activated_at?: string | null; } | null;
  activated: boolean;
  resident: Resident;
}) {
  const { resendActivation, setAccountEmail, setAccountOpen, load } = ctx;
  const [toggling, setToggling] = useState(false);

  const toggleStatus = async () => {
    if (!account) return;
    const confirmed = await confirmAction({
      title: `${account.is_active ? "Disable" : "Enable"} portal sign-in?`,
      text: account.is_active
        ? `This will prevent ${resident.first_name} ${resident.last_name} (${account.email}) from logging into their resident portal.`
        : `This will re-enable portal sign-in for ${resident.first_name} ${resident.last_name} (${account.email}).`,
      confirmText: account.is_active ? "Disable sign-in" : "Enable sign-in",
      danger: account.is_active,
    });
    if (!confirmed) return;

    setToggling(true);
    try {
      const response = await populationApi.toggleAccountStatus(account.id);
      toast(response.data.message);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="mt-6">
      <Card title="Resident portal account">
        {account ? (
          <div className="space-y-3">
            <Row label="Login email" value={account.email} />
            <div className="flex items-center justify-between border-b border-gray/60 py-2.5 text-sm last:border-0">
              <span className="text-gray-500">Sign-in enabled</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-dark">
                  {account.is_active ? "Yes" : "No — disabled by this office"}
                </span>
                <button
                  type="button"
                  disabled={toggling}
                  onClick={toggleStatus}
                  className={`inline-flex cursor-pointer items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    account.is_active
                      ? "border border-danger/40 text-danger hover:bg-danger hover:text-white"
                      : "bg-primary text-white hover:bg-primary-dark"
                  }`}
                >
                  {toggling ? "Saving…" : account.is_active ? "Disable sign-in" : "Enable sign-in"}
                </button>
              </div>
            </div>
            <Row
              label="Email verified"
              value={
                activated
                  ? `Yes — activated ${new Date(account.activated_at!).toLocaleDateString("en-PH")}`
                  : "Not yet — waiting for them to enter the emailed code"
              }
            />
            {!activated && (
              <p className="rounded-xl bg-warning/10 px-4 py-2.5 text-xs leading-relaxed text-dark">
                They have not signed in yet. A 6-digit code is emailed to them
                the first time they try; resend it below if it did not arrive.
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {!activated && (
                <button
                  type="button"
                  onClick={resendActivation}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray px-5 py-2 text-sm font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
                >
                  Resend activation code
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="rounded-xl bg-warning/10 px-4 py-2.5 text-sm leading-relaxed text-dark">
              No portal account. Accounts are created automatically when a resident is
              registered — this record either predates that, or had no email address on file.
            </p>
            <button
              type="button"
              onClick={() => {
                setAccountEmail(resident.email ?? "");
                setAccountOpen(true);
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Issue portal account
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
