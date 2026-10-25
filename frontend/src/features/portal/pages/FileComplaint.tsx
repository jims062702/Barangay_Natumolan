import { useEffect, useMemo, useState, type FormEvent } from "react";
import axios from "axios";
import { FiInfo, FiSend, FiPlus } from "react-icons/fi";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { confirmAction } from "../../../shared/lib/confirm";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import PageHeader from "../../../shared/ui/PageHeader";
import StatusBadge from "../../../shared/ui/StatusBadge";
import { manilaToday } from "../../../shared/lib/complaintFiling";
import { useUpload } from "../../../shared/hooks/useUpload";
import { e164Mobile } from "../../../shared/lib/phone";
import { useContactFromId } from "../../../shared/residentCard/useContactFromId";
import FormField from "../../../shared/ui/FormField";
import PhoneInput from "../../../shared/ui/PhoneInput";
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
import {
  BLANK_RESIDENT_ID,
  ResidentIdCheck,
  type IdCheckSummary,
  type ResidentIdValue,
} from "../../../shared/residentCard/ResidentIdCheck";
import { feeStanding, TONE_CLASSES } from "../../lupon/lib/filingFee";
import { portalApi } from "../api";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

/** One submission of theirs, as the portal reports it back. */
interface MyComplaint {
  reference_no: string;
  status: string;
  respondent_name: string;
  filed_at: string | null;
  case_number: string | null;
  office_notes: string | null;
  fee_status?: "Unpaid" | "Paid" | "Overdue" | null;
  fee_due_at?: string | null;
  case_stage?: string | null;
}

/**
 * A resident beginning a KP complaint from their own portal.
 *
 * The difference from the public form is everything this page does NOT ask.
 * The account is linked to a register entry, so the barangay already knows
 * the resident's name, address, birthday and purok — and asking again would
 * let one version of their address end up on the case and another on the
 * register. Those fields are read from the register on the server and are
 * never accepted from here.
 *
 * What is still asked is their Barangay Resident ID — their OWN, checked by
 * its QR against the register and against this account. The officer at the
 * counter holds that card beside their face before the complaint is
 * accepted.
 *
 * The list underneath is why the page is worth having at all: a reference
 * number is no use to somebody who cannot look it up again.
 */
export default function FileComplaint() {
  const today = useMemo(manilaToday, []);

  const [mine, setMine] = useState<MyComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();
  const [formOpen, setFormOpen] = useState(false);

  const [dispute, setDispute] = useState<DisputeValue>(BLANK_DISPUTE);
  const [identity, setIdentity] = useState<IdentityValue>(BLANK_IDENTITY);
  const [residentId, setResidentId] = useState<ResidentIdValue>(BLANK_RESIDENT_ID);
  /* Filled in from their record once the card checks out — theirs to change (2026-09-30). */
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<FilingOutcome | null>(null);
  const [routedToVawc, setRoutedToVawc] = useState<string | null>(null);

  const upload = useUpload();

  const load = () => {
    setLoading(true);
    portalApi
      .complaints()
      .then((r) => setMine(r.data.data ?? []))
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => setMine([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  /*
   * THE VAWC WARNING, WHILE IT IS STILL BEING TYPED.
   *
   * It matters more here than on the public form. A portal is opened on a
   * phone somebody may share with the person they live with, and a complaint
   * of being beaten sitting in this list is a disclosure to whoever picks that
   * phone up next. The server refuses to store it; this says so before she
   * has sent it.
   */
  const vawcWarning = useMemo(
    () => dispute.narrative.length >= 20 && mentionsVawc(dispute.narrative, dispute.respondentName),
    [dispute.narrative, dispute.respondentName],
  );

  const reset = () => {
    setDispute(BLANK_DISPUTE);
    setIdentity(BLANK_IDENTITY);
    setResidentId(BLANK_RESIDENT_ID);
    setContact("");
  };

  const verified = residentId.status === "verified" && Boolean(residentId.file && residentId.code);

  /* "complaint": the number on their record comes back with the check. */
  const verifyCard = async (code: string) =>
    (await portalApi.checkResidentCard({ code, purpose: "complaint" })).data.data as IdCheckSummary;

  const contactFromRecord = useContactFromId(residentId, contact, setContact, e164Mobile);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!verified) return;

    if (
      !(await confirmAction({
        title: "Send this complaint to the barangay?",
        text: "You will get a reference number. The complaint is accepted at the office, with your Barangay Resident ID.",
        confirmText: "Yes, send it",
      }))
    ) {
      return;
    }

    setSending(true);
    setRoutedToVawc(null);

    const body = new FormData();
    body.append("respondent_name", dispute.respondentName);
    if (dispute.respondentAddress) body.append("respondent_address", dispute.respondentAddress);
    body.append("narrative", dispute.narrative);
    if (dispute.occurredOn) body.append("date_of_occurrence", dispute.occurredOn);
    if (dispute.place) body.append("place_of_occurrence", dispute.place);
    if (dispute.relationship) body.append("relationship_nature", dispute.relationship);
    if (dispute.nature) body.append("case_classification", dispute.nature);
    body.append("resident_card_code", residentId.code ?? "");
    body.append("valid_id", residentId.file as File);
    if (contact) body.append("complainant_contact", contact);
    identity.evidence.forEach((file) => body.append("evidence[]", file));

    try {
      const response = await portalApi.fileComplaint(body, { ...upload.tracker });
      upload.finish();
      setOutcome({ ...response.data.data, message: response.data.message });
      setFormOpen(false);
      reset();
      load();
    } catch (err) {
      upload.fail();
      const message = errorMessage(err);

      const refused = axios.isAxiosError(err)
        ? (err.response?.data as { errors?: Record<string, string[]> } | undefined)?.errors?.resident_card_code?.[0]
        : undefined;

      if (message.toLowerCase().includes("vawc") || message.includes("violence against")) {
        setRoutedToVawc(message);
        setFormOpen(false);
      } else if (refused) {
        setResidentId({ ...residentId, status: "failed", message: refused, residentNumber: null, maskedName: null, contactNumber: null });
      } else {
        toast(message, "error");
      }
    } finally {
      setSending(false);
    }
  };

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => load()} />;

  return (
    <div>
      <PageHeader
        title="Online Complaints"
        subtitle="Start a Katarungang Pambarangay complaint, and follow the reference number it gives you"
        actions={
          !formOpen && (
            <button
              type="button"
              onClick={() => {
                setOutcome(null);
                setRoutedToVawc(null);
                setFormOpen(true);
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <FiPlus className="h-4 w-4" aria-hidden="true" /> New complaint
            </button>
          )
        }
      />

      {routedToVawc && (
        <div className="mb-5">
          <VawcRedirect message={routedToVawc} reportPath="/resident/vawc-report" />
        </div>
      )}

      {outcome && (
        <div className="mb-5">
          <ReferenceReceipt outcome={outcome} />
        </div>
      )}

      {formOpen && (
        <form onSubmit={submit} className="mb-6 space-y-5">
          <div className="flex gap-3 rounded-3xl border border-primary/25 bg-primary/5 p-5">
            <FiInfo className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="text-sm leading-relaxed text-dark">
              <p className="font-bold">This starts a complaint. It does not file a case.</p>
              <p className="mt-1 text-gray-600">
                You get a reference number now. Bring your Barangay Resident ID to the Barangay
                Office — the complaint is verified there, any fee is paid there, and the Lupon issues
                the case number at the counter.
              </p>
              <p className="mt-2 text-gray-600">
                Your name and address are taken from your barangay record, so the form does not ask
                for them — correct them on{" "}
                <span className="font-semibold text-dark">My Profile</span> if they are out of date.
                Your contact number is filled in from the record once your Resident ID checks out;
                change it there if your number has changed.
              </p>
            </div>
          </div>

          <Card title="The complaint">
            <DisputeFields value={dispute} onChange={setDispute} today={today} />
          </Card>

          {vawcWarning && <VawcRedirect tone="warning" reportPath="/resident/vawc-report" />}

          <Card title="Your Barangay Resident ID">
            <ResidentIdCheck
              value={residentId}
              onChange={setResidentId}
              mode="portal"
              verify={verifyCard}
              progress={upload.progress}
              done={upload.done}
              disabled={sending}
            />
            {verified && (
              <div className="mt-4 sm:max-w-sm">
                <FormField
                  label="Contact Number"
                  hint={contactFromRecord
                    ? "From your barangay record. Change it if your number has changed — the office rings this to tell you the complaint has been read."
                    : "The office rings this to tell you the complaint has been read."}
                >
                  <PhoneInput value={contact} onChange={setContact} />
                </FormField>
              </div>
            )}
          </Card>

          <Card title="Anything you have">
            <IdentityProof
              value={identity}
              onChange={setIdentity}
              disabled={sending}
              withId={false}
            />
          </Card>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                reset();
              }}
              disabled={sending}
              className="cursor-pointer rounded-full border border-gray bg-white px-5 py-2.5 text-sm font-semibold text-dark transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            {!verified && (
              <p className="mr-auto text-xs font-medium text-gray-500" data-testid="needs-verified-id">
                Send once your Resident ID shows <strong>ID Verified</strong>.
              </p>
            )}
            <button
              type="submit"
              disabled={sending || !verified}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiSend className="h-4 w-4" aria-hidden="true" />
              {sending ? "Sending…" : "Send this complaint"}
            </button>
          </div>
        </form>
      )}

      <Card title="Complaints you have sent">
        <DataTable
          columns={[
            {
              header: "Reference Number",
              render: (row: MyComplaint) => (
                <span className="font-semibold tabular-nums text-dark">{row.reference_no}</span>
              ),
            },
            { header: "Respondent", render: (row: MyComplaint) => row.respondent_name },
            {
              header: "Sent",
              render: (row: MyComplaint) =>
                row.filed_at ? new Date(row.filed_at).toLocaleDateString("en-PH") : "—",
            },
            {
              header: "Status",
              render: (row: MyComplaint) => <StatusBadge status={row.status} />,
            },
            {
              /* The one column that answers "did anything happen?" — and the
                 only place the two numbers sit side by side, so nobody can
                 read a reference number as a case number. */
              header: "Case Number",
              render: (row: MyComplaint) =>
                row.case_number ? (
                  <span className="inline-flex flex-col">
                    <span className="font-semibold tabular-nums text-success">{row.case_number}</span>
                    {(() => {
                      const standing = feeStanding({ current_stage: row.case_stage ?? "", payment_status: row.fee_status, payment_due_at: row.fee_due_at });
                      return standing && standing.label !== "Paid" ? (
                        <span className={`mt-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[standing.tone]}`} data-testid="portal-fee">
                          {standing.label === "Unpaid" ? `Filing fee: ${standing.detail}` : standing.detail}
                        </span>
                      ) : null;
                    })()}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Not yet — accepted at the office</span>
                ),
            },
            {
              header: "Note from the office",
              render: (row: MyComplaint) =>
                row.office_notes ? (
                  <span className="text-xs text-gray-600">{row.office_notes}</span>
                ) : (
                  "—"
                ),
            },
          ]}
          rows={mine}
          rowKey={(row) => row.reference_no}
          loading={loading}
          emptyMessage="You have not sent a complaint online."
        />
      </Card>
    </div>
  );
}
