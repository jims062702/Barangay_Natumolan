import NeedsConnection, { useNeedsConnection } from "../../../shared/offline/NeedsConnection";
import { useEffect, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { Link, useParams } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { confirmAction } from "../../../shared/lib/confirm";
import { formatInstant } from "../../../shared/lib/datetime";
import { personName } from "../../../shared/lib/names";
import Card from "../../../shared/ui/Card";
import StatusBadge from "../../../shared/ui/StatusBadge";
import PageHeader from "../../../shared/ui/PageHeader";
import { formatDay, violenceSummary } from "../lib/caseOptions";
import { reportedBySomeoneElse } from "../hooks/useCaseRegistry";
import { vawcApi } from "../api";
import type { VawcCase } from "../types";
import { ACTION_ICONS, CaseActionsMenu, type CaseAction } from "../components/detail/CaseActionsMenu";
import { DetailRows, TextBlock, type CaseModal } from "../components/detail/parts";
import { ProtectionCard, bpoActionFor, orderInEffect } from "../components/detail/ProtectionCard";
import { ProtectionOrderModal } from "../components/detail/ProtectionOrderModal";
import { SafetyModal } from "../components/detail/SafetyModal";
import { ReferralModal, ReferralsCard } from "../components/detail/Referrals";
import { FollowupModal, FollowupsCard } from "../components/detail/Followups";
import { AssessmentCard, AssessmentModal } from "../components/detail/Assessment";
import { DialogueCard, DialogueModal } from "../components/detail/Dialogue";
import { ChildWelfareCard, ChildWelfareModal } from "../components/detail/ChildWelfare";
import { DocumentModal, DocumentsCard } from "../components/detail/Documents";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

/** Who reported it, in one line. */
function reporterLine(c: VawcCase): string {
  if (!reportedBySomeoneElse(c.reported_by_type) && !c.reported_by_name) return "Victim-Survivor (herself)";

  const who = [c.reported_by_type, c.reported_by_name].filter(Boolean).join(" — ");
  const relationship = c.reported_by_relationship ? ` (${c.reported_by_relationship})` : "";
  const contact = c.reported_by_contact ? ` · ${c.reported_by_contact}` : "";

  return `${who}${relationship}${contact}`;
}

/**
 * One confidential case, worked in the order the desk works it:
 * intake → safety and protection → referral → assessment and action plan →
 * children → follow-up → documents → closure.
 */
export default function CaseDetail() {
  const { offline, noteOffline } = useNeedsConnection();
  const { id } = useParams();
  const [caseData, setCaseData] = useState<VawcCase | null>(null);
  const [modal, setModal] = useState<CaseModal>(null);
  /* Its skeleton until the first answer — see PageLoad. A case that cannot
     be fetched (no line: it is never kept on this device) ends the skeleton
     with the reason, where it used to say "Loading case…" for ever. */
  const pageLoad = usePageLoad();

  const load = () => {
    vawcApi.caseFile(id)
      .then((r) => {
        setCaseData(r.data.data);
        pageLoad.done();
      })
      .catch((error) => {
        noteOffline(error);
        pageLoad.fail(error);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const updateStatus = async (status: "Active" | "Closed") => {
    /* Closing does not end a BPO — it runs its fifteen days regardless — so
       the desk is told, rather than left to assume the case is finished. */
    const current = orderInEffect(caseData?.protection_orders ?? []);
    const text = status === "Closed" && current
      ? `A BPO is still in effect until ${formatDay(current.expires_on)}. Closing the case does not end it.`
      : undefined;

    if (!(await confirmAction({
      title: status === "Closed" ? "Close this case?" : "Reopen this case?",
      text,
      confirmText: status === "Closed" ? "Yes, close case" : "Yes, reopen",
    }))) return;
    try {
      await vawcApi.updateCase(id, { status });
      toast(status === "Closed" ? "Case closed." : "Case reopened.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  if (!caseData) return <PageLoading load={pageLoad} onRetry={load} />;

  const active = caseData.status === "Active";
  const closed = active ? undefined : "Reopen the case first.";
  const close = () => setModal(null);
  const incident = caseData.incidents?.[0];
  const hasChildren = (caseData.dependents?.length ?? 0) > 0;

  const actions: CaseAction[] = [
    {
      label: "Apply for BPO",
      icon: ACTION_ICONS.bpo,
      onSelect: () => setModal(bpoActionFor(caseData.protection_orders ?? [])),
      disabled: !active || !caseData.respondent_id,
      why: closed ?? (caseData.respondent_id ? undefined : "Name the respondent first."),
    },
    { label: "Create Referral", icon: ACTION_ICONS.referral, onSelect: () => setModal({ kind: "referral" }), disabled: !active, why: closed },
    { label: "Record Follow-up", icon: ACTION_ICONS.followup, onSelect: () => setModal({ kind: "followup" }), disabled: !active, why: closed },
    { label: "Add Confidential Document", icon: ACTION_ICONS.document, onSelect: () => setModal({ kind: "document" }), disabled: !active, why: closed },
    { label: "Update Safety Assessment", icon: ACTION_ICONS.safety, onSelect: () => setModal({ kind: "safety" }), disabled: !active, why: closed },
    active
      ? { label: "Close Case", icon: ACTION_ICONS.close, onSelect: () => updateStatus("Closed") }
      : { label: "Reopen Case", icon: ACTION_ICONS.reopen, onSelect: () => updateStatus("Active") },
  ];

  return (
    <div>
      <PageHeader
        title={caseData.case_code}
        subtitle={`Reported ${formatInstant(caseData.report_date, { dateStyle: "long", timeStyle: "short" })} · Officer: ${caseData.officer?.name ?? "—"}`}
        actions={
          /*
            items-center, so the status pill keeps its own height: a flex row
            that stretches its children drew "Active" as a tall capsule.
          */
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <CaseActionsMenu actions={actions} />
            <StatusBadge status={caseData.status} />
            <Link
              to="/vawc/cases"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <FiArrowLeft aria-hidden="true" /> Back to registry
            </Link>
          </div>
        }
      />

      {offline && (
        <NeedsConnection what="this case" why="The VAWC desk's records are never kept on this device: the server encrypts them with a key this browser never holds, which is what keeps a survivor's case off a laptop." />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Case profile">
          <DetailRows
            rows={[
              ["Victim-Survivor", caseData.survivor ? personName(caseData.survivor) : "—"],
              ["Reported by", reporterLine(caseData)],
              /*
                Read from the register, so the name is the current one rather
                than a copy taken at intake.
              */
              ["Respondent", caseData.respondent ? personName(caseData.respondent) : "Not yet named"],
              /* EVERY kind, not the one-word summary: a case that is a
                 beating and threats and wages withheld reads as "Mixed" in
                 that column, which tells the next officer nothing. */
              ["Kind of reported violence", violenceSummary(caseData.violence_types, caseData.violence_type)],
              ...(caseData.violence_acts?.length
                ? [["Acts recorded", caseData.violence_acts.join(", ")] as [string, string]]
                : []),
              /*
                When the act happened — not when it was reported, which is in
                the header. The date is Manila midnight stored as UTC, so it
                is read as an instant; the time, when known, is in words.
              */
              [
                "Date of incident",
                incident?.occurred_at
                  ? `${formatInstant(incident.occurred_at, { dateStyle: "long" })}${incident.approximate_time ? `, ${incident.approximate_time}` : ""}`
                  : incident?.approximate_time || "Not recorded",
              ],
              ["Place of incident", incident?.location || "Not recorded"],
              ["Relationship to the respondent", caseData.relationship_to_offender || "Not Recorded"],
              ["Children / dependents", hasChildren ? `Yes (${caseData.children_count})` : "None"],
              ...(caseData.immediate_needs ? [["Immediate needs", caseData.immediate_needs] as [string, string]] : []),
            ]}
          />
          <div className="mt-4 space-y-3">
            <TextBlock label="Brief description of the reported incident" text={incident?.incident_narrative} />
            <TextBlock label="Confidential interview notes" text={caseData.confidential_notes} />
          </div>
        </Card>

        <ProtectionCard caseData={caseData} open={setModal} active={active} />

        <ReferralsCard
          caseData={caseData}
          onCreate={() => setModal({ kind: "referral" })}
          onSaved={load}
          active={active}
        />

        <AssessmentCard
          caseData={caseData}
          onEdit={() => setModal({ kind: "assessment" })}
          active={active}
          className="lg:col-span-2"
        />

        <DialogueCard caseData={caseData} onEdit={() => setModal({ kind: "dialogue" })} active={active} />

        {/* Only when the case has children or dependents. */}
        {hasChildren && (
          <ChildWelfareCard caseData={caseData} onEdit={() => setModal({ kind: "children" })} active={active} />
        )}

        <FollowupsCard
          caseData={caseData}
          onRecord={() => setModal({ kind: "followup" })}
          active={active}
          className={hasChildren ? "" : "lg:col-span-2"}
        />

        <DocumentsCard caseData={caseData} onAdd={() => setModal({ kind: "document" })} active={active} />
      </div>

      <ProtectionOrderModal caseId={caseData.id} modal={modal} onClose={close} onSaved={load} />
      <SafetyModal
        caseData={caseData}
        open={modal?.kind === "safety"}
        onClose={close}
        onSaved={load}
        onNeedsBpo={() => setModal({ kind: "bpo", mode: "new" })}
      />
      <ReferralModal caseId={caseData.id} open={modal?.kind === "referral"} onClose={close} onSaved={load} />
      <FollowupModal caseData={caseData} open={modal?.kind === "followup"} onClose={close} onSaved={load} />
      <AssessmentModal caseData={caseData} open={modal?.kind === "assessment"} onClose={close} onSaved={load} />
      <DialogueModal caseData={caseData} open={modal?.kind === "dialogue"} onClose={close} onSaved={load} />
      {hasChildren && (
        <ChildWelfareModal caseData={caseData} open={modal?.kind === "children"} onClose={close} onSaved={load} />
      )}
      <DocumentModal caseId={caseData.id} open={modal?.kind === "document"} onClose={close} onSaved={load} />
    </div>
  );
}
