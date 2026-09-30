import { FiPlus, FiArrowLeft, FiTrash2 } from "react-icons/fi";
import { Link } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import PageHeader from "../../../shared/ui/PageHeader";
import { PageLoading } from "../../../shared/ui/PageLoad";
import StatusBadge from "../../../shared/ui/StatusBadge";
import { BLANK_MEMBER } from "../lib/constants";
import { useCensusForm } from "../hooks/useCensusForm";
import { MemberCard } from "../components/census/MemberCard";
import { IdentificationSection } from "../components/census/IdentificationSection";
import { HouseholdQuestions } from "../components/census/HouseholdQuestions";
import { ConsentSection } from "../components/census/ConsentSection";
import { RegistrationPreview } from "../components/census/RegistrationPreview";
import { MissingForRegistration } from "../components/census/MissingForRegistration";
import { RESIDENTS_HOME } from "../../resident/lib/paths";
import { DraftAvailable } from "../components/census/DraftAvailable";
import { DraftStatus } from "../components/census/DraftStatus";
import { confirmAction } from "../../../shared/lib/confirm";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { rbimApi } from "../api";

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
    bringOntoForm, missingFromSheet, submitForm, pageLoad, retryLoad, id, navigate, holdSaves,
  } = ctx;

  /*
   * Discarding a draft is deliberate: asked first, and only for a Draft
   * (a submitted census is part of the record). Saving is held while it is
   * deleted, so the form does not save itself back into existence.
   */
  const discard = async () => {
    if (!(await confirmAction({
      title: "Discard this draft?",
      text: `Census form ${censusNo || ""} and everything typed on it will be deleted. This cannot be undone.`,
      confirmText: "Discard draft",
    }))) return;

    holdSaves(true);
    try {
      const r = await rbimApi.deleteCensus(id);
      toast(r.data.message);
      navigate(RESIDENTS_HOME);
    } catch (err) {
      holdSaves(false);
      toast(errorMessage(err), "error");
    }
  };

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={retryLoad} />;

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
            {editing && status === "Draft" && (
              <button
                type="button"
                onClick={() => void discard()}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-danger hover:text-danger"
              >
                <FiTrash2 className="h-4 w-4" aria-hidden="true" /> Discard draft
              </button>
            )}
            {/* Back where the census was started — Residents & Households,
                not the Households list. */}
            <Link
              to={RESIDENTS_HOME}
              className="inline-flex items-center gap-2 rounded-full border border-gray bg-white px-4 py-2 text-sm font-semibold text-dark transition-colors hover:border-primary"
            >
              <FiArrowLeft className="h-4 w-4" aria-hidden="true" /> Residents &amp; Households
            </Link>
          </div>
        }
      />

      {/* A new sheet, and this account has one it has not finished: Continue Draft. */}
      {!editing && <DraftAvailable />}

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

      {/* Enter in a box does nothing: there is no "save" for it to press.
          The one way through is Preview form, below. */}
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
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
          ONE action: the form is read back, then registered.

          "Save as draft" is gone — the office asked for it off. A form is
          typed in from the paper and submitted in one sitting; its answers
          are saved as part of Preview, so what is registered is what is on
          screen. With no connection the form is still kept on this device
          and sent when the line returns — registering it waits for the line.
        */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* Where the draft stands — "Draft saved" only once the server said so. */}
          <DraftStatus ctx={ctx} />

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
            disabled={registering}
            className="cursor-pointer rounded-full bg-success px-8 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {status === "Submitted" ? "Preview and submit again" : "Preview form"}
          </button>
        </div>
      </form>
    </div>
  );
}

