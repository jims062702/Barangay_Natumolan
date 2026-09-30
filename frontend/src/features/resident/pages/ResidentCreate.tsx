import { FiArrowLeft, FiPlus } from "react-icons/fi";
import Card from "../../../shared/ui/Card";
import PageHeader from "../../../shared/ui/PageHeader";
import NewHouseholdModal from "../components/NewHouseholdModal";
import ResidentFormFields from "../components/ResidentFormFields";
import { useResidentIntake } from "../hooks/useResidentIntake";
import { RESIDENTS_HOME } from "../lib/paths";
import { HouseholdMemberCard } from "../components/intake/HouseholdMemberCard";
import { IntakeReview } from "../components/intake/IntakeReview";

/**
 * Register a resident — and, in the same visit, everybody else in the house.
 *
 * This is the shape a house-to-house actually takes. The BHW knocks, the
 * owner answers, and the owner names everybody living there: one visit, one
 * conversation, one list. Registering the owner and then opening their
 * profile to add each person separately turns that visit into six forms, and
 * the six are what get abandoned halfway through.
 *
 * Members are optional. A newborn or somebody who moves in later is still
 * added from the resident's own profile, which is the right place for a
 * single person arriving on their own.
 *
 * Nothing is sent until the clerk has read it back. A name typed into a
 * registry is copied onto every certificate that person is ever issued, and
 * a misspelling caught on screen costs a second where one caught a year later
 * costs a correction request.
 */

export default function ResidentCreate() {
  const ctx = useResidentIntake();
  const {
    form, manualSectors, autoLength, setAutoLength, selectedHousehold, members, step, setStep,
    error, hhOpen, setHhOpen, makeOwner, setMakeOwner, formRef, navigate, residentName, patch,
    selectHousehold, toggleSector, addMember, review, total,
  } = ctx;

  return (
    <div>
      <PageHeader
        crumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Residents", to: RESIDENTS_HOME },
          { label: "Register Resident" },
        ]}
        title={step === "preview" ? "Check before registering" : "Register Resident"}
        subtitle={
          step === "preview"
            ? "Read it back before it goes on the register — a misspelling here is copied onto every certificate."
            : "Register the household owner and, in the same visit, everybody living with them"
        }
        actions={
          <button
            type="button"
            onClick={() => (step === "preview" ? setStep("form") : navigate("/population/residents"))}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray px-5 py-2.5 text-sm font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
          >
            <FiArrowLeft aria-hidden="true" /> {step === "preview" ? "Back to the form" : "Back"}
          </button>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium leading-relaxed text-danger">
          {error}
        </p>
      )}

      {step === "preview" ? (
        <IntakeReview ctx={ctx} />
      ) : (
        <form ref={formRef} onSubmit={review}>
          <Card>
            {/* Registering someone now issues their portal login as well, so the
                clerk knows before they start why the email field matters. */}
            <p className="mb-4 rounded-xl bg-primary/10 px-4 py-2.5 text-xs leading-relaxed text-dark">
              <strong>A portal account is created automatically.</strong> If an email address is
              entered below, this resident is emailed their sign-in details right away. Their
              password is their <strong>last name + the year they were born</strong>, only the
              first letter a capital — e.g. Gasang2002 —
              and they activate the account themselves with a code we email them at first sign-in.
            </p>

            {/* 3 columns on large screens so the whole form fits without scrolling */}
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <ResidentFormFields
                form={form}
                onChange={patch}
                manualSectors={manualSectors}
                onToggleSector={toggleSector}
                autoLength={autoLength}
                onAutoLengthChange={setAutoLength}
                selectedHousehold={selectedHousehold}
                onSelectHousehold={selectHousehold}
                onAddNewHousehold={() => setHhOpen(true)}
                householdExtra={
                  // Owner opt-in — sits under the household field, off by default.
                  form.household_id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setMakeOwner((v) => !v)}
                        aria-pressed={makeOwner}
                        className={`mt-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                          makeOwner
                            ? "border-primary bg-primary text-white"
                            : "border-gray bg-white text-dark hover:border-primary hover:text-primary"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                            makeOwner ? "border-white bg-white/20" : "border-gray"
                          }`}
                        >
                          {makeOwner ? "✓" : ""}
                        </span>
                        Set {residentName || "this resident"} as this household&apos;s owner (head)
                      </button>
                      {makeOwner && selectedHousehold?.head && (
                        <span className="mt-1 block text-xs text-warning">
                          Replaces the current owner: {selectedHousehold.head.first_name}{" "}
                          {selectedHousehold.head.last_name}
                        </span>
                      )}
                    </>
                  ) : undefined
                }
              />

            </div>
          </Card>

          {/* ---------- everybody else in the house ---------- */}
          <Card title="Others living in this house">
            <p className="mb-4 text-xs leading-relaxed text-gray-500">
              While the owner is in front of you, take everybody down at once. They share this
              household and purok automatically. Leave this empty if the owner lives alone — a
              newborn or somebody who moves in later is added from a resident&rsquo;s own profile,
              which is the right place for one person arriving on their own.
            </p>

            <div className="space-y-4">
              {members.map((member, index) => (
                <HouseholdMemberCard key={index} ctx={ctx} index={index} member={member} />
              ))}
            </div>

            <button
              type="button"
              onClick={addMember}
              className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray py-3 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-primary/5"
            >
              <FiPlus className="h-4 w-4" aria-hidden="true" /> Add someone living in this house
            </button>

            {/*
              The end of the work, where the clerk's eye already is once the
              last person is entered — and on the right, where the button that
              moves you forward belongs.
            */}
            <div className="mt-6 flex justify-end border-t border-gray pt-5">
              <button
                type="submit"
                className="cursor-pointer rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                Review {total === 1 ? "" : `all ${total} `}before registering
              </button>
            </div>
          </Card>
        </form>
      )}

      {/* Inline household registration */}
      <NewHouseholdModal
        open={hhOpen}
        onClose={() => setHhOpen(false)}
        onCreated={selectHousehold}
        defaultPurok={form.zone_purok}
      />
    </div>
  );
}

