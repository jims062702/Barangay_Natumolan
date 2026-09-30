import { useMemo, useState, type FormEvent } from "react";
import axios from "axios";
import { FiArrowLeft, FiInfo, FiSend } from "react-icons/fi";
import { Link } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import ChoiceGroup from "../../../shared/ui/ChoiceGroup";
import PhoneInput from "../../../shared/ui/PhoneInput";
import { manilaToday } from "../../../shared/lib/complaintFiling";
import { mentionsVawc } from "../../lupon/lib/jurisdictionScreen";
import {
  DisputeFields,
  BLANK_DISPUTE,
  type DisputeValue,
} from "../../lupon/components/online/DisputeFields";
import {
  IdentityProof,
  BLANK_IDENTITY,
  type IdentityValue,
} from "../../lupon/components/online/IdentityProof";
import { VawcRedirect } from "../../lupon/components/online/VawcRedirect";
import {
  ReferenceReceipt,
  type FilingOutcome,
} from "../../lupon/components/online/ReferenceReceipt";
import { useUpload } from "../../../shared/hooks/useUpload";
import { e164Mobile } from "../../../shared/lib/phone";
import { useContactFromId } from "../../../shared/residentCard/useContactFromId";
import {
  BLANK_RESIDENT_ID,
  ResidentIdCheck,
  type IdCheckSummary,
  type ResidentIdValue,
} from "../../../shared/residentCard/ResidentIdCheck";
import logo from "../../../assets/logo/barangay-logo.png";
import { publicApi } from "../api";

/**
 * Beginning a Katarungang Pambarangay complaint without signing in.
 *
 * WHAT THIS PAGE DOES NOT DO IS THE POINT OF IT. It does not file a case. It
 * does not put anybody on the barangay register. It does not take a fee, set
 * a hearing or summon anyone. It takes the complaint in, hands back a
 * reference number, and says where to come — so that when the complainant
 * arrives the office has already read the thing, and the visit is short.
 *
 * Every part of the process survives: the person is identified against the
 * ID they uploaded, the complaint is read with them, the fee is paid, and
 * only then does the Lupon accept it into the docket.
 *
 * Two people use this page and they need different questions:
 *
 *   a RESIDENT       uploads their Barangay Resident ID. Its QR code is read
 *                    from the picture and checked against the register, and
 *                    the complaint attaches to the record it names — no name,
 *                    birthday or address is typed. A card that does not check
 *                    out cannot be sent; nobody is ever put on the register
 *                    from here (the RBIM census is the only way on).
 *   a NON-RESIDENT   types their own details and attaches any valid ID. They
 *                    stay on this page: nobody is sent to sign in. KP venue
 *                    follows where the RESPONDENT lives, so somebody from the
 *                    next barangay may properly file here.
 */

/** The server's refusal of a Resident ID, if that is what this error is. */
function cardRefusal(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  const errors = (err.response?.data as { errors?: Record<string, string[]> } | undefined)?.errors;

  return errors?.resident_card_code?.[0] ?? null;
}
export default function FileComplaint() {
  const today = useMemo(manilaToday, []);

  const [filerKind, setFilerKind] = useState<"Resident" | "Non-resident" | null>(null);

  /* A non-resident gives their name and address; a resident's come from
     the record their Resident ID names. Both give a number to ring. */
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [residentId, setResidentId] = useState<ResidentIdValue>(BLANK_RESIDENT_ID);

  const [dispute, setDispute] = useState<DisputeValue>(BLANK_DISPUTE);
  const [identity, setIdentity] = useState<IdentityValue>(BLANK_IDENTITY);

  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<FilingOutcome | null>(null);
  /* The server's refusal, which for a VAWC matter is a redirection. */
  const [routedToVawc, setRoutedToVawc] = useState<string | null>(null);

  const upload = useUpload();

  /*
   * THE VAWC WARNING, WHILE IT IS STILL BEING TYPED.
   *
   * The server refuses these outright and stores nothing, which is right.
   * But a refusal that arrives after the whole account has been typed out and
   * sent is a refusal that arrives too late to be kind. Read as she writes,
   * this says "not here, and here is where" before she has sent anything at
   * all — and it warns rather than blocks, because the same words describe a
   * fence hit by a truck.
   */
  const vawcWarning = useMemo(
    () => dispute.narrative.length >= 20 && mentionsVawc(dispute.narrative, dispute.respondentName),
    [dispute.narrative, dispute.respondentName],
  );

  const resident = filerKind === "Resident";

  /* A resident cannot send until their Resident ID has checked out. */
  const ready = resident
    ? residentId.status === "verified" && Boolean(residentId.file && residentId.code)
    : Boolean(identity.idFile);

  /* "complaint": the number on the record comes back with the check, to fill in the box below. */
  const verifyCard = async (code: string) =>
    (await publicApi.verifyResidentId({ code, purpose: "complaint" })).data.data as IdCheckSummary;

  /* A resident's number, from their record once the card checks out — theirs to change. */
  const contactFromRecord = useContactFromId(resident ? residentId : BLANK_RESIDENT_ID, contact, setContact, e164Mobile);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!filerKind || !ready) return;

    setSending(true);
    setRoutedToVawc(null);

    const body = new FormData();
    body.append("filer_kind", filerKind);
    body.append("complainant_contact", contact);

    if (resident) {
      /* Who they are is the card's to say: its code, and the picture of it. */
      body.append("resident_card_code", residentId.code ?? "");
      body.append("valid_id", residentId.file as File);
    } else {
      body.append("complainant_name", fullName.trim());
      body.append("complainant_address", address);
    }

    body.append("respondent_name", dispute.respondentName);
    if (dispute.respondentAddress) body.append("respondent_address", dispute.respondentAddress);
    body.append("narrative", dispute.narrative);
    if (dispute.occurredOn) body.append("date_of_occurrence", dispute.occurredOn);
    if (dispute.place) body.append("place_of_occurrence", dispute.place);
    if (dispute.relationship) body.append("relationship_nature", dispute.relationship);
    if (dispute.nature) body.append("case_classification", dispute.nature);

    if (!resident) {
      body.append("valid_id_type", identity.idType);
      if (identity.idNumber) body.append("valid_id_number", identity.idNumber);
      body.append("valid_id", identity.idFile as File);
    }
    identity.evidence.forEach((file) => body.append("evidence[]", file));

    try {
      const response = await publicApi.fileComplaint(body, { ...upload.tracker });
      upload.finish();
      setOutcome({ ...response.data.data, message: response.data.message });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      upload.fail();
      const message = errorMessage(err);
      const refused = cardRefusal(err);

      /*
       * A VAWC refusal is not an error to be toasted away. It is the one
       * outcome of this form that means somebody needs to be somewhere else
       * today, so it replaces the form rather than sitting above it.
       */
      if (message.toLowerCase().includes("vawc") || message.includes("violence against")) {
        setRoutedToVawc(message);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (refused) {
        /* The card stopped checking out between the check and the send
           (replaced, say): said where the card is, not in a toast. */
        setResidentId({ ...residentId, status: "failed", message: refused, residentNumber: null, maskedName: null, contactNumber: null });
      } else {
        toast(message, "error");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <FiArrowLeft aria-hidden="true" /> Back to website
        </Link>

        <div className="mb-6 text-center">
          <img
            src={logo}
            alt="Barangay Natumolan logo"
            className="mx-auto h-16 w-16 rounded-full object-cover"
          />
          <h1 className="mt-3 text-2xl font-bold text-dark">File a Complaint Online</h1>
          <p className="mx-auto mt-1 max-w-xl text-sm leading-relaxed text-gray-500">
            Katarungang Pambarangay — Lupon Tagapamayapa, Barangay Natumolan
          </p>
        </div>

        {outcome ? (
          <ReferenceReceipt outcome={outcome} />
        ) : routedToVawc ? (
          <div className="space-y-4">
            <VawcRedirect message={routedToVawc} />
            <p className="text-center text-xs text-gray-500">Nothing you typed was saved here.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {/*
              Said before anything is asked, because it is what people get
              wrong about an online form: this is not filing, and nobody is
              excused from coming in.
            */}
            <div className="flex gap-3 rounded-3xl border border-primary/25 bg-primary/5 p-5">
              <FiInfo className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="text-sm leading-relaxed text-dark">
                <p className="font-bold">This starts a complaint. It does not file a case.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
                  <li>
                    You will get an{" "}
                    <strong className="text-dark">Online Complaint Reference Number</strong> — not a
                    case number.
                  </li>
                  <li>
                    You still come to the Barangay Office with the ID you photograph here. The
                    complaint is verified there and any fee is paid there.
                  </li>
                  <li>
                    The Lupon accepts it into the Katarungang Pambarangay process at the counter,
                    and the case number is issued then.
                  </li>
                </ul>
              </div>
            </div>

            <section className="rounded-3xl border border-gray bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-bold text-dark">1. Who is filing</h2>
              <p className="mt-1 text-sm text-gray-500">
                A complaint may be filed by somebody who lives elsewhere — the barangay that hears
                it is the one the person complained about lives in.
              </p>

              <div className="mt-4">
                <ChoiceGroup
                  label="Are you on the Barangay Natumolan register?"
                  value={filerKind}
                  onChange={setFilerKind}
                  stretch
                  options={[
                    {
                      value: "Resident" as const,
                      label: "Yes, I am a resident here",
                      hint: "You will upload your Barangay Resident ID, and the barangay checks it against the register. No card yet? The Population Office issues one.",
                    },
                    {
                      value: "Non-resident" as const,
                      label: "No, I live elsewhere",
                      hint: "You may still file here, as a non-resident, if the person you are complaining about lives in Barangay Natumolan. No account needed.",
                    },
                  ]}
                />
              </div>

              {filerKind && (
                <div className="mt-5 space-y-4">
                  {/* Said plainly, so the choice cannot be forgotten further down. */}
                  <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary" data-testid="filer-kind-badge">
                    Filing as {resident ? "a resident of Barangay Natumolan" : "a non-resident"}
                  </p>

                  {resident ? (
                    <ResidentIdCheck
                      value={residentId}
                      onChange={setResidentId}
                      mode="public"
                      verify={verifyCard}
                      progress={upload.progress}
                      done={upload.done}
                      disabled={sending}
                    />
                  ) : (
                    <>
                      <FormField label="Your full name" required>
                        <input
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className={inputClasses}
                          maxLength={200}
                          required
                        />
                      </FormField>
                      <FormField label="Where you live" required hint="Barangay, municipality and province.">
                        <input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className={inputClasses}
                          maxLength={255}
                          required
                        />
                      </FormField>
                    </>
                  )}

                  <FormField
                    label="Contact Number"
                    required
                    hint={contactFromRecord
                      ? "From your Barangay Resident ID record. Change it if your number has changed — the office rings this to tell you the complaint has been read."
                      : "The office rings this to tell you the complaint has been read."}
                  >
                    <PhoneInput value={contact} onChange={setContact} required />
                  </FormField>
                </div>
              )}
            </section>

            {filerKind && (
              <>
                <section className="rounded-3xl border border-gray bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-base font-bold text-dark">2. The complaint</h2>
                  <p className="mt-1 mb-4 text-sm text-gray-500">
                    Who it is against, and what happened.
                  </p>
                  <DisputeFields value={dispute} onChange={setDispute} today={today} />
                </section>

                {/* Before it is sent, not after. */}
                {vawcWarning && <VawcRedirect tone="warning" />}

                <section className="rounded-3xl border border-gray bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-base font-bold text-dark">
                    {resident ? "3. Anything you have" : "3. Your ID, and anything you have"}
                  </h2>
                  <p className="mt-1 mb-4 text-sm text-gray-500">
                    {resident
                      ? "Your Barangay Resident ID is above. Evidence is optional — attach it only if you have it."
                      : "The ID is required. Evidence is not — attach it only if you have it."}
                  </p>
                  <IdentityProof
                    value={identity}
                    onChange={setIdentity}
                    progress={resident ? null : upload.progress}
                    done={resident ? false : upload.done}
                    disabled={sending}
                    withId={!resident}
                  />
                </section>

                <div className="rounded-3xl border border-gray bg-white p-5 shadow-sm sm:p-6">
                  <p className="text-xs leading-relaxed text-gray-500">
                    By sending this you confirm the account above is true. A complaint known to be
                    false is itself an offence, and the barangay keeps what you send whether or not
                    the complaint is accepted.
                  </p>

                  {resident && residentId.status !== "verified" && (
                    <p className="mt-4 rounded-2xl bg-secondary px-4 py-3 text-xs font-medium text-gray-600" data-testid="needs-verified-id">
                      The complaint can be sent once your Barangay Resident ID shows <strong>ID Verified</strong>.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={sending || !ready}
                    className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiSend className="h-4 w-4" aria-hidden="true" />
                    {sending ? "Sending…" : "Send this complaint"}
                  </button>

                  <p className="mt-3 text-center text-xs text-gray-400">
                    Already have a portal account?{" "}
                    <Link to="/login" className="font-semibold text-primary hover:underline">
                      Sign in
                    </Link>{" "}
                    and the form will not ask who you are.
                  </p>
                </div>
              </>
            )}

            {!filerKind && (
              <p className="text-center text-sm text-gray-400">
                Answer the question above to go on.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
