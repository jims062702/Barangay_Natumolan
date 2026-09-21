import NeedsConnection, { useNeedsConnection } from "../../../shared/offline/NeedsConnection";
import { useEffect, useState, type FormEvent } from "react";
import {   FiArrowLeft, FiPlus , FiXCircle , FiRotateCcw } from "react-icons/fi";
import { Link, useParams } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { confirmAction } from "../../../shared/lib/confirm";
import { formatInstant } from "../../../shared/lib/datetime";
import Card from "../../../shared/ui/Card";
import Modal from "../../../shared/ui/Modal";
import StatusBadge from "../../../shared/ui/StatusBadge";
import PageHeader from "../../../shared/ui/PageHeader";
import { AgreementCard } from "../components/cases/AgreementCard";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import { vawcApi } from "../api";
import type { VawcCase } from "../types";

const AGENCIES = [
  "PNP WCPD",
  "DSWD",
  "Rural Health Unit",
  "Hospital",
  "Prosecutor",
  "Public Attorney",
  "Shelter",
  "Counseling Service",
  "Child Protection",
  "Other",
];

export default function CaseDetail() {
  const { offline, noteOffline } = useNeedsConnection();
  const { id } = useParams();
  const [caseData, setCaseData] = useState<VawcCase | null>(null);

  const [referralOpen, setReferralOpen] = useState(false);
  const [agency, setAgency] = useState(AGENCIES[0]);
  const [receivingPerson, setReceivingPerson] = useState("");
  const [services, setServices] = useState("");
  const [referralFollowup, setReferralFollowup] = useState("");

  const [followupOpen, setFollowupOpen] = useState(false);
  const [fuDate, setFuDate] = useState(new Date().toISOString().slice(0, 10));
  const [fuType, setFuType] = useState("Office Visit");
  const [fuSafety, setFuSafety] = useState("Safe");
  const [fuBpo, setFuBpo] = useState("No BPO");
  const [fuNotes, setFuNotes] = useState("");
  const [fuNext, setFuNext] = useState("");

  const [docOpen, setDocOpen] = useState(false);
  const [docType, setDocType] = useState("Affidavit");
  const [docTitle, setDocTitle] = useState("");
  const [docDescription, setDocDescription] = useState("");

  const load = () => {
    vawcApi.caseFile(id).then((r) => setCaseData(r.data.data)).catch(noteOffline);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /** Confirms, sends the change, closes its form and reloads the case. */
  const submit = async (request: () => Promise<unknown>, close: () => void, message: string) => {
    if (!(await confirmAction({ title: "Save this change to the case?", confirmText: "Yes, save" }))) return;
    try {
      await request();
      close();
      toast(message);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const updateStatus = async (status: string) => {
    if (!(await confirmAction({ title: `Mark this case as "${status}"?`, confirmText: "Yes, update" }))) return;
    try {
      await vawcApi.updateCase(id, { status });
      toast(`Case marked ${status}.`);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  if (!caseData) {
    return <p className="py-10 text-center text-sm text-gray-400">Loading case…</p>;
  }

  return (
    <div>
      <Link to="/vawc/cases" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
        <FiArrowLeft aria-hidden="true" /> Back to registry
      </Link>

      <PageHeader
        title={caseData.case_code}
        subtitle={`Reported ${formatInstant(caseData.report_date, { dateStyle: "long", timeStyle: "short" })} · Officer: ${caseData.officer?.name ?? "—"}`}
        actions={
          <div className="flex gap-2">
            {caseData.status === "Active" ? (
              <button
                type="button"
                onClick={() => updateStatus("Closed")}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray px-5 py-2.5 text-sm font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
              >
                <FiXCircle className="h-4 w-4" aria-hidden="true" /> Close case
              </button>
            ) : (
              <button
                type="button"
                onClick={() => updateStatus("Active")}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray px-5 py-2.5 text-sm font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
              >
                <FiRotateCcw className="h-4 w-4" aria-hidden="true" /> Reopen case
              </button>
            )}
            <StatusBadge status={caseData.status} />
          </div>
        }
      />

      {offline && (
        <NeedsConnection what="this case" why="The VAWC desk's records are never kept on this device: the server encrypts them with a key this browser never holds, which is what keeps a survivor's case off a laptop." />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Case profile">
          <dl className="space-y-2.5 text-sm">
            {[
              ["Survivor", caseData.survivor ? `${caseData.survivor.first_name} ${caseData.survivor.last_name}` : "—"],
              [
                "Reported by",
                caseData.reported_by_name
                  ? `${caseData.reported_by_name}${
                      caseData.reported_by_relationship ? ` (${caseData.reported_by_relationship})` : ""
                    }${caseData.reported_by_contact ? ` · ${caseData.reported_by_contact}` : ""}`
                  : "The survivor herself",
              ],
              /*
                Who the complaint is against — item 4, and the party a
                protection order actually restrains. Read from the register
                when it knows them, so the name and address are the current
                ones rather than a copy taken at intake.
              */
              [
                "Respondent",
                caseData.respondent
                  ? `${caseData.respondent.first_name} ${caseData.respondent.last_name}`
                  : "Not yet named",
              ],
              ["Violence type", caseData.violence_type],
              /*
                When and where the act happened — asked for at intake, stored
                since, and shown nowhere until now. It is not the same fact as
                "Reported ..." in the header above: a prescription period runs
                from the ACT, and last night and last year are not the same
                case to whoever decides what to do tonight.

                A date with no clock, because that is what intake asks for.
                formatInstant, not formatWallClock: the column holds Manila
                midnight stored as UTC, so the components must be converted
                back rather than read off as they sit.
              */
              [
                "When it happened",
                caseData.incidents?.[0]?.occurred_at
                  ? formatInstant(caseData.incidents[0].occurred_at, { dateStyle: "long" })
                  : "Not recorded",
              ],
              ["Where it happened", caseData.incidents?.[0]?.location || "Not recorded"],
              ["Relationship to offender", caseData.relationship_to_offender ?? "—"],
              ["Children involved", caseData.children_involved ? `Yes (${caseData.children_count})` : "No"],
              ["Previous incidents", String(caseData.previous_incidents_count)],
              ["Immediate needs", caseData.immediate_needs ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 border-b border-gray/60 pb-2 last:border-0">
                <dt className="text-gray-500">{label}</dt>
                <dd className="text-right font-medium text-dark">{value}</dd>
              </div>
            ))}
          </dl>
          {(caseData.dependents?.length ?? 0) > 0 && (
            <div className="mt-4 rounded-xl bg-secondary p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Children / dependents
              </p>
              <ul className="mt-1 space-y-1 text-sm text-dark">
                {caseData.dependents?.map((d) => (
                  <li key={d.id}>
                    <Link to={`/population/residents/${d.id}`} className="text-primary hover:underline">
                      {[d.first_name, d.middle_name, d.last_name].filter(Boolean).join(" ")}
                    </Link>{" "}
                    <span className="text-xs text-gray-500">{d.resident_number}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {caseData.confidential_notes && (
            <div className="mt-4 rounded-xl bg-secondary p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Confidential notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-dark">{caseData.confidential_notes}</p>
            </div>
          )}
        </Card>

        <Card
          title="Referrals & service coordination"
          action={
            <button type="button" onClick={() => setReferralOpen(true)} className="cursor-pointer text-sm font-medium text-primary hover:underline">
              <FiPlus className="h-4 w-4" aria-hidden="true" /> Refer
            </button>
          }
        >
          {(caseData.referrals ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No referrals yet.</p>
          ) : (
            <ul className="space-y-3">
              {caseData.referrals?.map((referral) => (
                <li key={referral.id} className="rounded-xl bg-secondary p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-dark">{referral.referral_agency}</p>
                    <span className="text-xs text-gray-400">
                      {new Date(referral.referral_date).toLocaleDateString("en-PH")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">{referral.services_requested}</p>
                  {referral.followup_schedule && (
                    <p className="mt-1 text-xs text-primary">
                      Follow-up: {new Date(referral.followup_schedule).toLocaleDateString("en-PH")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Follow-ups & monitoring"
          action={
            <button type="button" onClick={() => setFollowupOpen(true)} className="cursor-pointer text-sm font-medium text-primary hover:underline">
              <FiPlus className="h-4 w-4" aria-hidden="true" /> Record
            </button>
          }
        >
          {(caseData.followups ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No follow-ups yet.</p>
          ) : (
            <ul className="space-y-3">
              {caseData.followups?.map((followup) => (
                <li key={followup.id} className="rounded-xl bg-secondary p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-dark">{followup.followup_type}</p>
                    <StatusBadge status={followup.safety_status} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(followup.followup_date).toLocaleDateString("en-PH")} · BPO: {followup.bpo_compliance}
                  </p>
                  {followup.notes && <p className="mt-1 text-xs text-gray-600">{followup.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/*
          Incident records are gone from this page.

          They were a second narrative alongside the case's own, kept apart
          from the session that actually decides anything — so the desk had
          three places to write what happened and no rule about which. What
          was said is now recorded once, at the session, in the card above.
          The rows already stored are untouched and reachable through the
          API; nothing was deleted.
        */}
        <AgreementCard caseId={caseData.id} />

        <Card
          title="Confidential documents"
          action={
            <button type="button" onClick={() => setDocOpen(true)} className="cursor-pointer text-sm font-medium text-primary hover:underline">
              <FiPlus className="h-4 w-4" aria-hidden="true" /> Add document
            </button>
          }
        >
          {(caseData.documents ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No documents recorded.</p>
          ) : (
            <ul className="divide-y divide-gray/70">
              {caseData.documents?.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-dark">{doc.title}</p>
                    <p className="text-xs text-gray-500">
                      {doc.document_type} · added by {doc.uploader?.name ?? "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-gray-400">
            Every view and change on this case is written to the access log.
          </p>
        </Card>
      </div>

      {/* Referral modal */}
      <Modal open={referralOpen} onClose={() => setReferralOpen(false)} title="Refer to agency">
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            submit(
              () => vawcApi.addReferral(id, {
                referral_agency: agency,
                receiving_person: receivingPerson || undefined,
                services_requested: services,
                followup_schedule: referralFollowup || undefined,
              }),
              () => setReferralOpen(false),
              "Referral recorded."
            );
          }}
          className="space-y-4"
        >
          <FormField label="Agency" required>
            <select value={agency} onChange={(e) => setAgency(e.target.value)} className={inputClasses}>
              {AGENCIES.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Receiving person">
            <input value={receivingPerson} onChange={(e) => setReceivingPerson(e.target.value)} className={inputClasses} />
          </FormField>
          <FormField label="Services requested" required>
            <textarea value={services} onChange={(e) => setServices(e.target.value)} required rows={2} className={`${inputClasses} resize-none`} />
          </FormField>
          <FormField label="Follow-up date">
            <input type="date" value={referralFollowup} onChange={(e) => setReferralFollowup(e.target.value)} className={inputClasses} />
          </FormField>
          <button type="submit" className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
            Record referral
          </button>
        </form>
      </Modal>

      {/* Follow-up modal */}
      <Modal open={followupOpen} onClose={() => setFollowupOpen(false)} title="Record follow-up">
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            submit(
              () => vawcApi.recordFollowup(id, {
                followup_date: fuDate,
                followup_type: fuType,
                safety_status: fuSafety,
                bpo_compliance: fuBpo,
                notes: fuNotes || undefined,
                next_followup_date: fuNext || undefined,
              }),
              () => setFollowupOpen(false),
              "Follow-up recorded."
            );
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Date" required>
              <input type="date" value={fuDate} onChange={(e) => setFuDate(e.target.value)} required className={inputClasses} />
            </FormField>
            <FormField label="Type" required>
              <select value={fuType} onChange={(e) => setFuType(e.target.value)} className={inputClasses}>
                <option>Home Visit</option>
                <option>Office Visit</option>
                <option>Phone Call</option>
              </select>
            </FormField>
            <FormField label="Safety status" required>
              <select value={fuSafety} onChange={(e) => setFuSafety(e.target.value)} className={inputClasses}>
                <option>Safe</option>
                <option>At Risk</option>
                <option>Critical</option>
                <option>Unknown</option>
              </select>
            </FormField>
            <FormField label="BPO compliance">
              <select value={fuBpo} onChange={(e) => setFuBpo(e.target.value)} className={inputClasses}>
                <option>No BPO</option>
                <option>Compliant</option>
                <option>Violated</option>
              </select>
            </FormField>
          </div>
          <FormField label="Notes" hint="Stored encrypted">
            <textarea value={fuNotes} onChange={(e) => setFuNotes(e.target.value)} rows={2} className={`${inputClasses} resize-none`} />
          </FormField>
          <FormField label="Next follow-up">
            <input type="date" value={fuNext} onChange={(e) => setFuNext(e.target.value)} className={inputClasses} />
          </FormField>
          <button type="submit" className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
            Save follow-up
          </button>
        </form>
      </Modal>

      {/* Document modal */}
      <Modal open={docOpen} onClose={() => setDocOpen(false)} title="Record confidential document">
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            submit(
              () => vawcApi.addDocument(id, { document_type: docType, title: docTitle, description: docDescription || undefined }),
              () => setDocOpen(false),
              "Document recorded."
            );
          }}
          className="space-y-4"
        >
          <FormField label="Type" required>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className={inputClasses}>
              {["Affidavit", "Statement", "Medical Certificate", "Police Report", "Photograph", "Protection Order", "Other"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Title" required>
            <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} required className={inputClasses} />
          </FormField>
          <FormField label="Description" hint="Stored encrypted">
            <textarea value={docDescription} onChange={(e) => setDocDescription(e.target.value)} rows={2} className={`${inputClasses} resize-none`} />
          </FormField>
          <button type="submit" className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
            Save document record
          </button>
        </form>
      </Modal>
    </div>
  );
}
