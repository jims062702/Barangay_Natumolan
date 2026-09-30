import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Card from "../../../../shared/ui/Card";
import { useModalDraft } from "../../../../shared/lib/useModalDraft";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import Modal from "../../../../shared/ui/Modal";
import ChoiceGroup from "../../../../shared/ui/ChoiceGroup";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { ageFrom } from "../../../../shared/lib/birthdate";
import { personName } from "../../../../shared/lib/names";
import type { Resident } from "../../../../shared/types";
import {
  CHILD_REFERRALS, CHILD_RELATIONSHIPS, CURRENT_SUPPORT, LIVING_ARRANGEMENTS, SUPPORT_TYPES,
} from "../../lib/caseOptions";
import { vawcApi } from "../../api";
import type { VawcCase, VawcChildDetail } from "../../types";
import { CardButton, CheckList, Chips, DetailRows, saveToCase, SubmitButton, TextBlock } from "./parts";

/**
 * A dependent's saved details, found by their record — or by the name saved
 * with them, when the record they were saved under was merged into another.
 */
function detailFor(child: Resident, saved: VawcChildDetail[]): VawcChildDetail | undefined {
  return saved.find((d) => d.resident_id === child.id)
    ?? saved.find((d) => d.name === personName(child));
}

const ageText = (child: Resident) => {
  const age = ageFrom(child.birthdate);
  return age === null ? "Age not on record" : `${age} ${age === 1 ? "year" : "years"} old`;
};

/**
 * Child & Dependent Welfare — shown only when the case has children or
 * dependents.
 *
 * Deliberately apart from any dialogue: a child's food, schooling and care
 * are a welfare matter to be referred, not a term somebody agrees to.
 */
export function ChildWelfareCard({ caseData, onEdit, active }: {
  caseData: VawcCase;
  onEdit: () => void;
  active: boolean;
}) {
  const children = caseData.dependents ?? [];
  const w = caseData.child_welfare;
  const saved = w?.children ?? [];

  return (
    <Card
      title="Child & Dependent Welfare"
      action={active && <CardButton onClick={onEdit}>{w ? "Update" : "Record"}</CardButton>}
    >
      <ul className="space-y-2">
        {children.map((child) => {
          const d = detailFor(child, saved);

          return (
            <li key={child.id} className="rounded-xl bg-secondary p-3 text-sm">
              <p className="font-semibold text-dark">
                <Link to={`/population/residents/${child.id}`} className="text-primary hover:underline">
                  {personName(child)}
                </Link>{" "}
                <span className="text-xs font-normal text-gray-500">· {ageText(child)}</span>
              </p>
              {d ? (
                <p className="mt-1 text-xs text-gray-600">
                  {[d.relationship, d.caregiver && `cared for by ${d.caregiver}`, d.living_arrangement]
                    .filter(Boolean)
                    .join(" · ") || "No details recorded"}
                  {d.immediate_needs && <span className="block">Needs: {d.immediate_needs}</span>}
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">No details recorded yet.</p>
              )}
            </li>
          );
        })}
      </ul>

      {w && (
        <div className="mt-4 space-y-3">
          <DetailRows
            rows={[
              ["Financial/material support needed", w.support_needed ?? "Not recorded"],
              ...(w.support_needed === "Yes"
                ? [["Type of support needed", <Chips key="t" items={w.support_types} />] as [string, ReactNode]]
                : []),
              ["Current support provided", w.current_support ?? "Not recorded"],
              [
                "Referral needed",
                <Chips
                  key="r"
                  empty="None"
                  items={(w.referral_needed ?? []).map((r) => (r === "Other" && w.referral_other ? w.referral_other : r))}
                />,
              ],
            ]}
          />
          <TextBlock label="Notes" text={w.notes} />
        </div>
      )}
    </Card>
  );
}

type Row = Omit<VawcChildDetail, "resident_id" | "name">;
const emptyRow = (): Row => ({ relationship: "", caregiver: "", living_arrangement: "", immediate_needs: "" });

export function ChildWelfareModal({ caseData, open, onClose, onSaved }: {
  caseData: VawcCase;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const children = caseData.dependents ?? [];
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [supportNeeded, setSupportNeeded] = useState<"Yes" | "No" | "Unknown" | null>(null);
  const [supportTypes, setSupportTypes] = useState<string[]>([]);
  const [currentSupport, setCurrentSupport] = useState("");
  const [referrals, setReferrals] = useState<string[]>([]);
  const [referralOther, setReferralOther] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    const w = caseData.child_welfare;
    const saved = w?.children ?? [];
    setRows(Object.fromEntries(children.map((c) => {
      const d = detailFor(c, saved);
      return [c.id, d ? {
        relationship: d.relationship ?? "",
        caregiver: d.caregiver ?? "",
        living_arrangement: d.living_arrangement ?? "",
        immediate_needs: d.immediate_needs ?? "",
      } : emptyRow()];
    })));
    setSupportNeeded(w?.support_needed ?? null);
    setSupportTypes(w?.support_types ?? []);
    setCurrentSupport(w?.current_support ?? "");
    setReferrals(w?.referral_needed ?? []);
    setReferralOther(w?.referral_other ?? "");
    setNotes(w?.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, caseData]);

  /* Tab memory only — a VAWC record is never written to the device. Kept
     through a closed dialog; gone on refresh, Discard, or logout. */
  const savedWelfare = () => {
    const w = caseData.child_welfare;
    const saved = w?.children ?? [];
    return {
      rows: Object.fromEntries(children.map((c) => {
        const d = detailFor(c, saved);
        return [c.id, d ? {
          relationship: d.relationship ?? "",
          caregiver: d.caregiver ?? "",
          living_arrangement: d.living_arrangement ?? "",
          immediate_needs: d.immediate_needs ?? "",
        } : emptyRow()];
      })) as Record<number, Row>,
      supportNeeded: (w?.support_needed ?? null) as "Yes" | "No" | "Unknown" | null,
      supportTypes: w?.support_types ?? [],
      currentSupport: w?.current_support ?? "",
      referrals: w?.referral_needed ?? [],
      referralOther: w?.referral_other ?? "",
      notes: w?.notes ?? "",
    };
  };
  const fillWelfare = (v: ReturnType<typeof savedWelfare>) => {
    setRows(v.rows);
    setSupportNeeded(v.supportNeeded);
    setSupportTypes(v.supportTypes);
    setCurrentSupport(v.currentSupport);
    setReferrals(v.referrals);
    setReferralOther(v.referralOther);
    setNotes(v.notes);
  };
  const welfareBase = savedWelfare();
  const draft = useModalDraft(
    `vawc-child-welfare:${caseData.id}`,
    open,
    { rows, supportNeeded, supportTypes, currentSupport, referrals, referralOther, notes },
    /* Only the children still on the case keep their rows. */
    (kept) => fillWelfare({
      ...welfareBase,
      ...kept,
      rows: Object.fromEntries(children.map((c) => [c.id, kept.rows?.[c.id] ?? welfareBase.rows[c.id] ?? emptyRow()])),
    }),
    {
      memoryOnly: true,
      blank: welfareBase,
      reset: () => fillWelfare(savedWelfare()),
      version: JSON.stringify(welfareBase),
    },
  );

  const setRow = (id: number, key: keyof Row, value: string) =>
    setRows((prev) => ({ ...prev, [id]: { ...(prev[id] ?? emptyRow()), [key]: value } }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveToCase(
      () => vawcApi.saveChildWelfare(caseData.id, {
        children: children.map((c) => {
          const r = rows[c.id] ?? emptyRow();
          return {
            resident_id: c.id,
            name: personName(c),
            relationship: r.relationship || null,
            caregiver: r.caregiver?.trim() || null,
            living_arrangement: r.living_arrangement || null,
            immediate_needs: r.immediate_needs?.trim() || null,
          };
        }),
        support_needed: supportNeeded,
        support_types: supportNeeded === "Yes" ? supportTypes : [],
        current_support: currentSupport || null,
        referral_needed: referrals,
        referral_other: referrals.includes("Other") ? referralOther.trim() || null : null,
        notes: notes.trim() || null,
      }),
      () => { draft.clear(); onClose(); onSaved(); },
      "Child and dependent welfare saved.",
      "Save the child and dependent welfare record?",
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Child & Dependent Welfare" size="xl">
      <form onSubmit={submit} className="space-y-5">
        <p className="text-xs leading-relaxed text-gray-500">
          Kept apart from any dialogue between the parties: a child's support is a welfare matter to be
          referred, not a term to be agreed. Each child's details and the notes are stored encrypted.
        </p>

        <div className="space-y-3">
          {children.map((child) => {
            const r = rows[child.id] ?? emptyRow();

            return (
              <fieldset key={child.id} className="rounded-xl border border-gray p-4">
                <legend className="px-1 text-sm font-semibold text-dark">
                  {personName(child)} <span className="font-normal text-gray-500">· {ageText(child)}</span>
                </legend>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <FormField label="Relationship to the victim-survivor">
                    <select
                      value={r.relationship ?? ""}
                      onChange={(e) => setRow(child.id, "relationship", e.target.value)}
                      className={inputClasses}
                    >
                      <option value="">Not recorded</option>
                      {CHILD_RELATIONSHIPS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Current caregiver">
                    <input
                      value={r.caregiver ?? ""}
                      onChange={(e) => setRow(child.id, "caregiver", e.target.value)}
                      maxLength={150}
                      className={inputClasses}
                    />
                  </FormField>
                  <FormField label="Current living arrangement">
                    <select
                      value={r.living_arrangement ?? ""}
                      onChange={(e) => setRow(child.id, "living_arrangement", e.target.value)}
                      className={inputClasses}
                    >
                      <option value="">Not recorded</option>
                      {LIVING_ARRANGEMENTS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Immediate needs">
                    <input
                      value={r.immediate_needs ?? ""}
                      onChange={(e) => setRow(child.id, "immediate_needs", e.target.value)}
                      maxLength={500}
                      className={inputClasses}
                    />
                  </FormField>
                </div>
              </fieldset>
            );
          })}
        </div>

        <div className="rounded-xl bg-secondary/60 p-4">
          <p className="mb-3 text-sm font-bold text-dark">Child support / assistance</p>
          <div className="grid gap-5 lg:grid-cols-2">
            <ChoiceGroup
              label="Is financial/material support needed?"
              value={supportNeeded}
              onChange={setSupportNeeded}
              options={(["Yes", "No", "Unknown"] as const).map((v) => ({ value: v, label: v }))}
            />
            <FormField label="Current support provided">
              <select value={currentSupport} onChange={(e) => setCurrentSupport(e.target.value)} className={inputClasses}>
                <option value="">Not recorded</option>
                {CURRENT_SUPPORT.map((o) => <option key={o}>{o}</option>)}
              </select>
            </FormField>
            {supportNeeded === "Yes" && (
              <div className="lg:col-span-2">
                <CheckList label="Type of support needed" options={SUPPORT_TYPES} value={supportTypes} onChange={setSupportTypes} columns={3} />
              </div>
            )}
            <div className="lg:col-span-2">
              <CheckList label="Referral needed?" options={CHILD_REFERRALS} value={referrals} onChange={setReferrals} columns={3} />
              {referrals.includes("Other") && (
                <input
                  value={referralOther}
                  onChange={(e) => setReferralOther(e.target.value)}
                  maxLength={150}
                  required
                  placeholder="Where else the children should be referred"
                  className={`${inputClasses} mt-2`}
                />
              )}
            </div>
          </div>
        </div>

        <FormField label="Notes" hint="Stored encrypted.">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={5000}
            className={`${inputClasses} resize-none`}
          />
        </FormField>

        <DraftNotice draft={draft} tabOnly />
        <SubmitButton>Save child & dependent welfare</SubmitButton>
      </form>
    </Modal>
  );
}
