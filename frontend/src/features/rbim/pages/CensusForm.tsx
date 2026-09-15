import { FiPlus, FiArrowLeft } from "react-icons/fi";
import { Link } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import PageHeader from "../../../shared/ui/PageHeader";
import StatusBadge from "../../../shared/ui/StatusBadge";
import { BLANK_MEMBER } from "../lib/constants";
import { useCensusForm } from "../hooks/useCensusForm";
import { MemberCard } from "../components/census/MemberCard";
import { IdentificationSection } from "../components/census/IdentificationSection";
import { HouseholdQuestions } from "../components/census/HouseholdQuestions";
import { ConsentSection } from "../components/census/ConsentSection";
import { RegistrationPreview } from "../components/census/RegistrationPreview";
import { MissingForRegistration } from "../components/census/MissingForRegistration";

/**
 * The RBIM baseline census form.
 *
 * The paper is a wide grid — ten people across nine spreads, carried by line
 * number. That is right for a clipboard and wrong for a screen: forty-four
 * columns cannot be read at once on anything, and an encoder scrolling
 * sideways loses which row they are on.
 *
 * So each person is a card, and the card is divided the way the paper is
 * divided. The sections collapse because most of them do not apply to most
 * people: a nine-year-old has no economic activity, a man has no family
 * planning answers, and a non-migrant has no migration story. Showing all
 * forty-four for everybody is how an encoder starts skipping.
 */
export default function CensusForm() {
  const ctx = useCensusForm();
  const {
    editing, codes, members, setMembers, status, censusNo, gaps, registering, notOnSheet,
    saving, loading, bringOntoForm, missingFromSheet, save, submitForm,
  } = ctx;

  if (loading) {
    return <p className="p-6 text-sm text-gray-500">Loading the census form…</p>;
  }

  const m = codes.member;
  const h = codes.household;

  return (
    <div>
      <PageHeader
        title={editing ? `Census ${censusNo}` : "New RBIM census form"}
        subtitle="Baseline Census for the Registry of Barangay Inhabitants & Migrants"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {editing && <StatusBadge status={status} />}
            <Link
              to="/population/rbim"
              className="inline-flex items-center gap-2 rounded-full border border-gray bg-white px-4 py-2 text-sm font-semibold text-dark transition-colors hover:border-primary"
            >
              <FiArrowLeft className="h-4 w-4" aria-hidden="true" /> All forms
            </Link>
          </div>
        }
      />

      {/*
        What Submit found missing, at the top where the office is looking.

        It stays until it is fixed, and it re-checks itself as they type, so
        the list shrinks under their hands. A toast said the same thing once
        and then took it away.
      */}
      {gaps.length > 0 && (
        <MissingForRegistration ctx={ctx} />
      )}

      {/*
        The last look before a form becomes people.

        Submitting writes resident records, and the office is working from a
        paper sheet they cannot see at the same time as the screen. What they
        need at this moment is the answers they typed, laid out to be read
        against that sheet — not a dialogue box with a list of names in it,
        which proves nothing about whether line 4's birth year is right.
      */}
      <RegistrationPreview ctx={ctx} m={m} />

      <form onSubmit={save} className="space-y-4">
        {/* ------------------- A. IDENTIFICATION ------------------- */}
        <IdentificationSection ctx={ctx} />

        {/* ------------------- THE MEMBER GRID ------------------- */}
        <Card title="Household members">
          <p className="mb-4 text-xs leading-relaxed text-gray-500">
            One card per line on the paper form. The sections fold away because most do not apply
            to most people — a nine-year-old has no economic activity, and a non-migrant has no
            migration story.
          </p>

          {/*
            Only when there is somebody to add. A panel that says "nobody is
            missing" is a panel the office reads once and never again.
          */}
          {missingFromSheet().length > 0 && (
            <div className="mb-4 rounded-xl border border-warning/40 bg-warning/5 p-4">
              <p className="text-sm font-semibold text-dark">
                {missingFromSheet().length} person(s) on the register for this household
                are not on this form
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                {missingFromSheet()
                  .map((r) => `${r.first_name} ${r.last_name}`)
                  .join(", ")}
                . Adding them here starts their lines from what the register already
                holds, so the visit only has to fill in what the census asks on top.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (notOnSheet?.household) {
                    bringOntoForm(notOnSheet.household, missingFromSheet());
                  }
                }}
                className="mt-3 cursor-pointer rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                Bring them onto the form
              </button>
            </div>
          )}

          <div className="space-y-4">
            {members.map((member, index) => (
              <MemberCard key={index} ctx={ctx} index={index} member={member} m={m} />
            ))}
          </div>

          {(
            <button
              type="button"
              onClick={() => setMembers((p) => [...p, { ...BLANK_MEMBER }])}
              className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray py-3 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-primary/5"
            >
              <FiPlus className="h-4 w-4" aria-hidden="true" /> Add another household member
            </button>
          )}
        </Card>

        {/* ------------------- H. HOUSEHOLD QUESTIONS ------------------- */}
        <HouseholdQuestions ctx={ctx} h={h} m={m} />

        {/* ------------------- CONSENT + ENCODING ------------------- */}
        <ConsentSection ctx={ctx} />

        {/* ------------------- ACTIONS ------------------- */}
        {/*
          Two, because there are two things the office does: keep typing, and
          register the household. There is no third — no hand-over, because
          the hand-over was the BHW carrying paper through the door, and no
          separate review, because the office typing the sheet IS the review.
        */}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="submit"
            disabled={saving}
            className="cursor-pointer rounded-full border border-gray bg-white px-8 py-3 text-sm font-semibold text-dark transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Save as draft"}
          </button>

          {/*
            Shown on a new form too.

            It used to appear only once a draft existed, so registering a
            household in one sitting was impossible: the office had to save,
            leave, and come back for the button. Pressing it on a new form
            now saves first and previews second.

            And it says PREVIEW, because that is what it does. Labelled
            "Submit — register this household" it promised the last step and
            delivered a dialogue, which is the kind of small lie that teaches
            somebody to click through dialogues without reading them.
          */}
          <button
            type="button"
            onClick={submitForm}
            disabled={saving || registering}
            className="cursor-pointer rounded-full bg-success px-8 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {status === "Submitted" ? "Preview and submit again" : "Preview form"}
          </button>
        </div>
      </form>
    </div>
  );
}

