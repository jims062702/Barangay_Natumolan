import { FiArrowLeft, FiEdit2 } from "react-icons/fi";
import { Link } from "react-router-dom";
import { toast } from "../../../shared/lib/toast";
import PageHeader from "../../../shared/ui/PageHeader";
import FamilyPanel from "../components/FamilyPanel";
import AddRelativeModal from "../components/AddRelativeModal";
import MergeDuplicates from "../components/MergeDuplicates";
import MarriageHistory from "../components/MarriageHistory";
import ConvertToResident from "../components/ConvertToResident";
import EndGuardianshipModal from "../components/EndGuardianshipModal";
import LifeStatusEditor from "../components/LifeStatusEditor";
import { useResidentRecord } from "../hooks/useResidentRecord";
import { ResidentProfile } from "../components/record/ResidentProfile";
import { PortalAccountCard } from "../components/record/PortalAccountCard";
import { ServiceHistory } from "../components/record/ServiceHistory";
import { AddSectorModal } from "../components/record/AddSectorModal";
import { IssueAccountModal } from "../components/record/IssueAccountModal";
import { ChangePasswordModal } from "../components/record/ChangePasswordModal";

export default function ResidentDetail() {
  const ctx = useResidentRecord();
  const {
    id, navigate, resident, loadError, relation, setRelation, endingGuardian,
    setEndingGuardian, isBpo, canEdit, load, unlinkRelative,
  } = ctx;

  if (loadError) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-medium text-danger">{loadError}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 cursor-pointer rounded-full border border-gray px-5 py-2 text-sm font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!resident) {
    return <p className="py-10 text-center text-sm text-gray-400">Loading resident…</p>;
  }

  const account = resident.account ?? null;
  const activated = !!account?.activated_at;
  // A relative who lives elsewhere: on the register so the family can be
  // recorded, but not a constituent.
  const isOutside = resident.record_type === "Non-resident";
  const isDeceased = resident.life_status === "Deceased";
  // Where this record belongs. See the routes in App.tsx.
  const home = isOutside ? "/residents/non-residents" : "/residents";

  return (
    <div>
      <PageHeader
        crumbs={[
          { label: "Dashboard", to: "/dashboard" },
          // Back to the list they were actually browsing. Sending somebody
          // from a non-resident to the resident registry is a dead end: the
          // record they just left is not in it.
          {
            label: isOutside ? "Non-residents" : "Residents",
            to: home,
          },
          { label: `${resident.first_name} ${resident.last_name}` },
        ]}
        title={`${resident.first_name} ${resident.last_name}`}
        subtitle={
          isOutside
            ? `${resident.resident_number} · Lives outside the barangay${
                resident.address ? ` — ${resident.address}` : ""
              }`
            : `Resident No. ${resident.resident_number}`
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/residents")}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray px-5 py-2.5 text-sm font-semibold text-dark transition-colors hover:border-primary hover:text-primary"
            >
              <FiArrowLeft aria-hidden="true" /> Back
            </button>
            {canEdit && (
              <Link
                to={`${home}/${id}/edit`}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                <FiEdit2 className="h-4 w-4" aria-hidden="true" /> Edit information
              </Link>
            )}
          </div>
        }
      />

      {isDeceased && (
        <p className="mb-6 rounded-2xl bg-dark/5 px-4 py-3 text-sm font-medium text-dark">
          Recorded as <strong>deceased</strong>
          {resident.date_of_death && (
            <> on {new Date(resident.date_of_death).toLocaleDateString("en-PH", { dateStyle: "long" })}</>
          )}
          . Their family links are kept.
        </p>
      )}

      <ResidentProfile ctx={ctx} resident={resident} isOutside={isOutside} />

      {/* Duplicate warning first: a split record is normally noticed BECAUSE
          the family below looks wrong, so the explanation goes above it. */}
      {isBpo && (
        <div className="mt-6">
          <MergeDuplicates resident={resident} onMerged={load} />
        </div>
      )}

      {/* Family — parents, spouse, children, and the grandparents those imply */}
      <div className="mt-6">
        <FamilyPanel
          family={{
            parents: resident.parents ?? [],
            grandparents: resident.grandparents ?? [],
            spouse: resident.spouse ?? null,
            children: resident.children ?? [],
            siblings: resident.siblings ?? [],
            aunts_uncles: resident.aunts_uncles ?? [],
            cousins: resident.cousins ?? [],
            guardians: resident.guardians ?? [],
            wards: resident.wards ?? [],
            past_guardians: resident.past_guardians ?? [],
            care_note: resident.care_note ?? null,
            parents_note: resident.parents_note ?? null,
          }}
          linkTo={(member) => `/residents/${member.id}`}
          onAdd={isBpo ? setRelation : undefined}
          onRemove={isBpo ? unlinkRelative : undefined}
          onEndGuardianship={isBpo ? setEndingGuardian : undefined}
        />
      </div>

      {isBpo && (
        <div className="mt-6">
          <MarriageHistory resident={resident} onChanged={load} />
        </div>
      )}

      {/* Self-hides for anyone who already lives here. */}
      {isBpo && (
        <div className="mt-6">
          <ConvertToResident resident={resident} onConverted={load} />
        </div>
      )}

      {isBpo && (
        <div className="mt-6">
          <LifeStatusEditor resident={resident} onChanged={load} />
        </div>
      )}

      {/* Portal account — created automatically at registration, so this is a
          status panel with a repair button, not a form. */}
      {isBpo && !isOutside && !isDeceased && (
        <PortalAccountCard ctx={ctx} account={account} activated={activated} resident={resident} />
      )}

      {!isOutside && (
      <ServiceHistory resident={resident} />
      )}

      <EndGuardianshipModal
        guardian={endingGuardian}
        residentId={resident.id}
        wardName={resident.first_name}
        onClose={() => setEndingGuardian(null)}
        onEnded={(message) => {
          toast(message);
          load();
        }}
      />

      {relation && (
        <AddRelativeModal
          open={relation !== null}
          relation={relation}
          resident={resident}
          onClose={() => setRelation(null)}
          onSaved={(message) => {
            toast(message);
            load();
          }}
        />
      )}

      <AddSectorModal ctx={ctx} resident={resident} />

      <IssueAccountModal ctx={ctx} resident={resident} />

      <ChangePasswordModal ctx={ctx} resident={resident} />
    </div>
  );
}

