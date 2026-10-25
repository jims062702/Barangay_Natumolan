import { useState } from "react";
import Card from "../../../../shared/ui/Card";
import type { Resident } from "../../../../shared/types";
import { Row } from "./Row";
import type { ResidentRecordState } from "../../hooks/useResidentRecord";
import { populationApi } from "../../../population/api";
import { toast } from "../../../../shared/lib/toast";
import { errorMessage } from "../../../../shared/lib/api";
import { confirmAction } from "../../../../shared/lib/confirm";
import { ageFrom } from "../../../../shared/lib/birthdate";

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

  const age = ageFrom(resident.birthdate);
  const isMinor = age !== null && age < 18;

  const toggleStatus = async () => {
    if (!account) return;
    if (isMinor && !account.is_active) {
      toast("Hindi maaaring i-enable ang portal account ng residenteng 17 anyos pababa.", "error");
      return;
    }
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
            {isMinor && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-dark">
                <span className="font-semibold text-warning-dark">Bawal buksan (17 anyos pababa):</span> Ang residenteng ito ay {age !== null ? `${age} anyos` : "menor de edad"} pa lamang. Naka-restrict ang pag-open o pag-log in sa resident portal hanggang sa sumapit sa 18 taong gulang.
              </div>
            )}
            <Row label="Login email" value={account.email} />
            <div className="flex items-center justify-between border-b border-gray/60 py-2.5 text-sm last:border-0">
              <span className="text-gray-500">Sign-in enabled</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-dark">
                  {account.is_active ? "Yes" : "No — disabled by this office"}
                </span>
                <button
                  type="button"
                  disabled={toggling || (isMinor && !account.is_active)}
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
            {!activated && !isMinor && (
              <p className="rounded-xl bg-warning/10 px-4 py-2.5 text-xs leading-relaxed text-dark">
                They have not signed in yet. A 6-digit code is emailed to them
                the first time they try; resend it below if it did not arrive.
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {!activated && !isMinor && (
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
        ) : isMinor ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-dark">
              <div className="flex items-center gap-2 font-semibold text-warning-dark">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-warning" />
                Hindi Maaaring Gawan ng Portal Account (17 Anyos Pababa)
              </div>
              <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">
                Ang residenteng ito ay <strong>{age !== null ? `${age} anyos` : "menor de edad"}</strong> pa lamang.
                Ayon sa patakaran, ang resident portal account ay para lamang sa mga may edad <strong>18 pataas</strong>.
                Kusang magiging kwalipikado at mabubuksan ang kanilang account pagtuntong nila ng kanilang ika-18 kaarawan.
              </p>
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
