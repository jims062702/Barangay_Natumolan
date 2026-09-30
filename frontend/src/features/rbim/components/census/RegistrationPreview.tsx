import { useNavigate } from "react-router-dom";
import Modal from "../../../../shared/ui/Modal";
import { ResidentIdRoster, type RosterPerson } from "../../../resident/components/ResidentIdRoster";
import { RESIDENTS_HOME } from "../../../resident/lib/paths";
import { ageOf } from "../../lib/rules";
import { MONTHS } from "../../lib/constants";
import type { CensusFormState } from "../../hooks/useCensusForm";
import type { Codes } from "../../types";

/**
 * What registering will put on the register, shown before it does.
 */
export function RegistrationPreview({ ctx, m }: { ctx: CensusFormState; m: Codes }) {
  const {
    previewOpen, setPreviewOpen, status, form, filledLines, members, matches, registering,
    registerHousehold, justRegistered, registrationGaps, draftSave, draftError, previewReady,
    submitForm, saveOnDevice,
  } = ctx;
  const navigate = useNavigate();
  /*
   * Submit waits for two things: the draft this preview shows is saved (so
   * the census it registers is this one), and nothing the register needs is
   * missing. The preview itself never waits — it opens on the first press.
   */
  const missing = previewOpen && !justRegistered ? registrationGaps() : [];
  const canRegister = previewReady && missing.length === 0 && !registering;

  /* Everybody on this form who is on the register — their IDs, issued from here. */
  const registered: RosterPerson[] = members.flatMap((mem, index) => {
    const resident = matches[index];
    if (!resident?.id) return [];

    return [{
      id: resident.id,
      name: [mem.first_name, mem.middle_name, mem.last_name].map((x) => String(x ?? "").trim()).filter(Boolean).join(" ")
        || `${resident.first_name} ${resident.last_name}`,
      detail: `Line ${index + 1}${resident.resident_number ? ` · ${resident.resident_number}` : ""}`,
      badge: index === 0 ? "Household Head" : (m.relationships?.[String(mem.q2_relationship ?? "")] ?? undefined),
      highlight: index === 0,
    }];
  });

  return (
    <Modal
      open={previewOpen}
      onClose={() => setPreviewOpen(false)}
      size="xl"
      title={justRegistered
        ? "Registered — issue their Resident IDs"
        : status === "Draft" ? "Check before registering" : "Check before registering anybody new"}
    >
      <div className="space-y-4">
        {/*
          RESIDENT IDs, from the form itself. Everybody this census put on the
          register, with the ID each holds: issue one person's, a selection,
          or everybody eligible — without leaving for the Residents page.
        */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3" data-testid="census-resident-ids">
          {registered.length > 0 ? (
            <ResidentIdRoster people={registered} heading="Resident IDs for the people on this form" />
          ) : (
            <p className="text-xs leading-relaxed text-gray-600">
              <strong className="text-dark">Resident IDs</strong> can be issued here once this household is
              registered — press Submit below, and the IDs appear in this same window.
            </p>
          )}
        </div>

        <p className="text-xs leading-relaxed text-gray-500">
          Read this against the paper sheet. Submitting puts everybody marked below on the
          barangay register; anybody already there is left alone.{" "}
          {/*
            Said here because this is where the email addresses are on
            screen. The account is no longer a second job to remember — it
            is part of registering, and the only thing that decides who
            gets one is whether Q1 carries an email address.
          */}
          <span className="text-gray-600">
            Everybody with an email address below is also given a portal account and emailed
            their sign-in details — no separate step.
          </span>
        </p>

        <div className="rounded-xl border border-gray p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            A. Identification
          </p>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {[
              ["Form no.", String(form.census_no ?? "—")],
              ["Household head", String(form.household_head_name ?? "—")],
              ["Purok", String(form.zone_purok ?? "—")],
              ["Address", [form.address_unit, form.address_house_lot, form.address_street]
                .map((x) => String(x ?? "").trim()).filter(Boolean).join(", ") || "—"],
              ["Respondent", String(form.respondent_name ?? "—")],
              ["Total members", String(filledLines)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-gray-500">{label}</dt>
                <dd className="text-right font-medium text-dark">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="max-h-[24rem] space-y-2 overflow-y-auto">
          {members.map((mem, index) => {
            const named = String(mem.first_name ?? "").trim()
              || String(mem.last_name ?? "").trim();
            if (!named) return null;

            const willRegister = index === 0
              || Number(mem.register_as_resident ?? 1) === 1;
            const already = matches[index];

            return (
              <div key={index} className="rounded-xl border border-gray p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-dark">
                    Line {index + 1} · {mem.first_name} {mem.middle_name} {mem.last_name}
                  </p>
                  {already ? (
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-gray-500">
                      Already on the register
                    </span>
                  ) : willRegister ? (
                    <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
                      Will be registered
                    </span>
                  ) : (
                    /*
                      Said plainly, because this is the last moment it can be
                      changed — and a line silently left off is how somebody
                      goes uncounted for a year.
                    */
                    <span className="rounded-full bg-warning/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                      Not being registered
                    </span>
                  )}
                </div>

                <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                  {[
                    ["Q2 Relationship", m.relationships?.[String(mem.q2_relationship ?? "")] ?? "—"],
                    ["Q3 Sex", m.sexes?.[String(mem.q3_sex ?? "")] ?? "—"],
                    ["Q4 Age", ageOf(mem) !== null ? String(ageOf(mem)) : "—"],
                    ["Q5 Date of birth", mem.q5_birthdate
                      ? new Date(`${mem.q5_birthdate}T00:00:00`).toLocaleDateString("en-PH", {
                          year: "numeric", month: "long", day: "numeric",
                        })
                      : [
                          MONTHS[Number(mem.q5_birth_month) - 1],
                          mem.q5_birth_year,
                        ].filter(Boolean).join(" ") || "—"],
                    ["Q8 Marital status", m.marital_statuses?.[String(mem.q8_marital_status ?? "")] ?? "—"],
                    ["Q35 Length of stay", [
                      mem.q35_stay_years != null ? `${mem.q35_stay_years}y` : null,
                      mem.q35_stay_months != null ? `${mem.q35_stay_months}m` : null,
                    ].filter(Boolean).join(" ") || "—"],
                    /*
                      Not "—". A missing email is the difference between a
                      resident who can use the portal and one who cannot,
                      and this is the last screen where it can be typed in.
                    */
                    ["Email", String(mem.email ?? "")
                      || (willRegister && !already ? "none — no portal account" : "—")],
                    ["Phone", String(mem.contact_number ?? "") || "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <dt className="text-gray-400">{label}</dt>
                      <dd className="text-right font-medium text-dark">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>

        {!justRegistered && (
          <div data-testid="preview-readiness">
            {missing.length > 0 ? (
              <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
                <p className="text-sm font-semibold text-danger">Before this household can be registered:</p>
                <ul className="mt-1 space-y-0.5">
                  {missing.map((gap) => (
                    <li key={gap} className="text-xs leading-relaxed text-gray-700">• {gap}</li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-gray-500">Go back, fill them in, then press Preview form again. What you typed is kept.</p>
              </div>
            ) : draftSave === "offline" ? (
              <p className="rounded-xl bg-warning/10 px-4 py-3 text-xs leading-relaxed text-amber-800">
                No connection. Registering needs one — the form is not saved yet.{" "}
                <button type="button" onClick={() => void saveOnDevice()} className="cursor-pointer font-semibold underline">
                  Keep it on this device
                </button>{" "}
                and submit it when the connection returns.
              </p>
            ) : !previewReady && draftSave === "error" ? (
              <p className="rounded-xl bg-danger/5 px-4 py-3 text-xs leading-relaxed text-danger" role="alert">
                The draft could not be saved{draftError ? `: ${draftError}` : "."}{" "}
                <button type="button" onClick={() => void submitForm()} className="cursor-pointer font-semibold underline">
                  Try again
                </button>
              </p>
            ) : !previewReady ? (
              <p className="text-xs text-gray-500">Saving this form as a draft…</p>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-gray pt-4">
          {justRegistered ? (
            <button
              type="button"
              onClick={() => { setPreviewOpen(false); navigate(RESIDENTS_HOME); }}
              className="cursor-pointer rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Done — back to Residents &amp; Households
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="cursor-pointer rounded-full border border-gray bg-white px-6 py-2.5 text-sm font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
              >
                Go back and fix something
              </button>
              <button
                type="button"
                disabled={!canRegister}
                onClick={() => void registerHousehold()}
                className="cursor-pointer rounded-full bg-success px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
              >
                {registering ? "Registering…" : "Submit — register this household"}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
