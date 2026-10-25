import { useEffect, useState } from "react";
import { FiActivity, FiLock } from "react-icons/fi";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import PageHeader from "../../../shared/ui/PageHeader";
import StatusBadge from "../../../shared/ui/StatusBadge";
import { RowsSkeleton } from "../../../shared/ui/Skeleton";
import { portalApi } from "../api";
import { PageLoading, usePageLoad } from "../../../shared/ui/PageLoad";

/**
 * A resident's own health record, as a copy they can read.
 *
 * VIEW ONLY, and the page says so rather than leaving somebody to discover
 * it. A health record is written at the station by the person who took the
 * reading; a patient reading theirs is right, a patient editing it is not.
 */

interface PortalVisit {
  type?: string | null;
  visit_date?: string | null;
  visit_time?: string | null;
  visit_reason: string;
  blood_pressure?: string | null;
  temperature?: string | null;
  heart_rate?: number | null;
  respiratory_rate?: number | null;
  oxygen_saturation?: number | null;
  height_cm?: string | null;
  weight_kg?: string | null;
  treatment_advice?: string | null;
  followup_schedule?: string | null;
}

interface PortalImmunization {
  child_name?: string | null;
  vaccine_name: string;
  vaccination_date?: string | null;
  status: string;
}

interface PortalMaternalRecord {
  id: number;
  status: string;
  pregnancy_registration_date?: string | null;
  lmp?: string | null;
  expected_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  risk_indicators?: string | null;
  maternal_immunization_received?: boolean;
  post_natal_followup_required?: boolean;
  family_planning_method?: string | null;
  prenatal_visits_count?: number;
}

interface PortalChildRecord {
  id: number;
  record_date?: string | null;
  current_weight?: string | null;
  current_height?: string | null;
  nutritional_status?: string | null;
  fully_immunized_status?: string | null;
  breastfeeding_status?: string | null;
  vitamin_services_received?: boolean;
}

export default function HealthRecords() {
  const [visits, setVisits] = useState<PortalVisit[]>([]);
  const [shots, setShots] = useState<PortalImmunization[]>([]);
  const [maternalRecords, setMaternalRecords] = useState<PortalMaternalRecord[]>([]);
  const [childRecords, setChildRecords] = useState<PortalChildRecord[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  /* Its skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();
  /* Bumped by "Try again": the load is an effect, so this re-runs it. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    portalApi.health()
      .then((r) => {
        setVisits(r.data.data.visits ?? []);
        setShots(r.data.data.immunizations ?? []);
        setMaternalRecords(r.data.data.maternal_records ?? []);
        setChildRecords(r.data.data.child_records ?? []);
        setNote(r.data.data.note ?? "");
      })
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [attempt]);

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => setAttempt((n) => n + 1)} />;

  return (
    <div>
      <PageHeader
        title="Health Records"
        subtitle="What the Barangay Health Station holds for you."
      />

      {/*
        Said once, at the top, before anything is read — not as a
        disappointment discovered after looking for an edit button.
      */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gray bg-secondary/60 px-4 py-3 text-sm leading-relaxed text-gray-600">
        <FiLock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          {note || "This is a copy of your record. It is changed at the health station, not here."}
        </span>
      </div>

      {loading ? (
        <Card>
          <RowsSkeleton rows={4} what="your health record" />
        </Card>
      ) : (
        <div className="space-y-6">
          {maternalRecords.length > 0 && (
            <Card title="Maternal Health & Pregnancy">
              <DataTable
                columns={[
                  {
                    header: "Registered",
                    render: (m: PortalMaternalRecord) => (
                      <span className="whitespace-nowrap font-medium text-dark">
                        {m.pregnancy_registration_date
                          ? new Date(m.pregnancy_registration_date).toLocaleDateString("en-PH")
                          : "—"}
                      </span>
                    ),
                  },
                  {
                    header: "Status",
                    render: (m: PortalMaternalRecord) => <StatusBadge status={m.status} />,
                  },
                  {
                    header: "Expected Delivery (EDC)",
                    render: (m: PortalMaternalRecord) => (
                      <span className="whitespace-nowrap text-xs font-semibold text-primary">
                        {m.expected_delivery_date
                          ? new Date(m.expected_delivery_date).toLocaleDateString("en-PH")
                          : "—"}
                      </span>
                    ),
                  },
                  {
                    header: "LMP",
                    render: (m: PortalMaternalRecord) => (
                      <span className="whitespace-nowrap text-xs text-gray-600">
                        {m.lmp ? new Date(m.lmp).toLocaleDateString("en-PH") : "—"}
                      </span>
                    ),
                  },
                  {
                    header: "Prenatal Visits",
                    render: (m: PortalMaternalRecord) => (
                      <span className="text-xs font-medium text-gray-700">
                        {m.prenatal_visits_count ?? 0} {m.prenatal_visits_count === 1 ? "visit" : "visits"}
                      </span>
                    ),
                  },
                  {
                    header: "Notes / Advice",
                    render: (m: PortalMaternalRecord) => (
                      <span className="text-xs text-gray-600">
                        {m.risk_indicators || "None recorded"}
                      </span>
                    ),
                  },
                ]}
                rows={maternalRecords}
                rowKey={(m) => `maternal-${m.id}`}
                emptyMessage="No maternal record found."
              />
            </Card>
          )}

          {childRecords.length > 0 && (
            <Card title="Child Health & Growth Monitoring">
              <DataTable
                columns={[
                  {
                    header: "Date",
                    render: (c: PortalChildRecord) => (
                      <span className="whitespace-nowrap font-medium text-dark">
                        {c.record_date ? new Date(c.record_date).toLocaleDateString("en-PH") : "—"}
                      </span>
                    ),
                  },
                  {
                    header: "Weight & Height",
                    render: (c: PortalChildRecord) => (
                      <span className="text-xs text-gray-600">
                        {[c.current_weight && `${c.current_weight} kg`, c.current_height && `${c.current_height} cm`].filter(Boolean).join(" · ") || "—"}
                      </span>
                    ),
                  },
                  {
                    header: "Nutritional Status",
                    render: (c: PortalChildRecord) => (
                      <span className="text-xs font-medium text-dark">{c.nutritional_status || "—"}</span>
                    ),
                  },
                  {
                    header: "Immunization",
                    render: (c: PortalChildRecord) => (
                      <span className="text-xs text-gray-600">{c.fully_immunized_status || "—"}</span>
                    ),
                  },
                  {
                    header: "Breastfeeding",
                    render: (c: PortalChildRecord) => (
                      <span className="text-xs text-gray-600">{c.breastfeeding_status || "—"}</span>
                    ),
                  },
                ]}
                rows={childRecords}
                rowKey={(c) => `child-${c.id}`}
                emptyMessage="No child health record found."
              />
            </Card>
          )}

          <Card title="Consultations & Checkups">
            <DataTable
              columns={[
                {
                  header: "Date",
                  render: (v: PortalVisit) => (
                    <span className="whitespace-nowrap font-medium text-dark">
                      {v.visit_date
                        ? new Date(v.visit_date).toLocaleDateString("en-PH")
                        : "—"}
                      {v.visit_time && (
                        <span className="block text-xs font-normal text-gray-500">
                          {v.visit_time.slice(0, 5)}
                        </span>
                      )}
                    </span>
                  ),
                },
                { header: "Reason", render: (v: PortalVisit) => v.visit_reason },
                {
                  /*
                    The readings in ONE column, labelled.

                    Seven columns of numbers — most of them blank on any given
                    visit — is a table nobody reads across. Here each visit
                    shows only what was actually taken.
                  */
                  header: "Readings",
                  render: (v: PortalVisit) => {
                    const taken = [
                      v.blood_pressure && `BP ${v.blood_pressure}`,
                      v.temperature && `${v.temperature}°C`,
                      v.heart_rate && `Pulse ${v.heart_rate}`,
                      v.respiratory_rate && `RR ${v.respiratory_rate}`,
                      v.oxygen_saturation && `O₂ ${v.oxygen_saturation}%`,
                      v.height_cm && `${v.height_cm} cm`,
                      v.weight_kg && `${v.weight_kg} kg`,
                    ].filter(Boolean);

                    return taken.length ? (
                      <span className="text-xs text-gray-600">{taken.join(" · ")}</span>
                    ) : (
                      <span className="text-xs text-gray-400">None recorded</span>
                    );
                  },
                },
                {
                  header: "Advice / Plan",
                  render: (v: PortalVisit) => (
                    <span className="text-xs text-gray-600">{v.treatment_advice || "—"}</span>
                  ),
                },
                {
                  header: "Come back",
                  render: (v: PortalVisit) =>
                    v.followup_schedule ? (
                      <span className="whitespace-nowrap text-xs font-semibold text-primary">
                        {new Date(v.followup_schedule).toLocaleDateString("en-PH")}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    ),
                },
              ]}
              rows={visits}
              rowKey={(v: PortalVisit) => `${v.visit_date ?? ""}-${v.visit_time ?? ""}-${v.visit_reason}`}
              emptyMessage="The station has no consultation on record for you."
            />
          </Card>

          <Card title="Immunizations">
            <DataTable
              columns={[
                ...(shots.some((i) => i.child_name)
                  ? [
                      {
                        header: "Person",
                        render: (i: PortalImmunization) => (
                          <span className="text-xs font-medium text-dark">
                            {i.child_name || "Self"}
                          </span>
                        ),
                      },
                    ]
                  : []),
                {
                  header: "Vaccine",
                  render: (i: PortalImmunization) => (
                    <span className="font-medium text-dark">{i.vaccine_name}</span>
                  ),
                },
                {
                  header: "Given",
                  render: (i: PortalImmunization) => (
                    <span className="whitespace-nowrap">
                      {i.vaccination_date
                        ? new Date(i.vaccination_date).toLocaleDateString("en-PH")
                        : "—"}
                    </span>
                  ),
                },
                {
                  header: "Status",
                  render: (i: PortalImmunization) => <StatusBadge status={i.status} />,
                },
              ]}
              rows={shots}
              rowKey={(i: PortalImmunization) => `${i.child_name ?? ""}-${i.vaccine_name}-${i.vaccination_date ?? ""}`}
              emptyMessage="No immunization is on record for you."
            />
          </Card>

          <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-gray-400">
            <FiActivity aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Consultation notes are not shown here. They are the clinical
              record of the person who examined you — ask at the station if you
              need a copy or an explanation.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
