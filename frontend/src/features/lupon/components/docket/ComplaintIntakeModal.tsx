import Modal from "../../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import PhoneInput from "../../../../shared/ui/PhoneInput";
import ResidentPicker from "../../../resident/components/ResidentPicker";
import ResidentMultiPicker from "../../../resident/components/ResidentMultiPicker";
import { useIsOffline } from "../../../../shared/offline/useConnectivity";
import { CLASSIFICATIONS, RELATIONSHIPS } from "../../lib/docket";
import type { LuponDocketState } from "../../hooks/useLuponDocket";

/**
 * Filing a complaint: the parties, what happened, and whether the barangay can hear it.
 */
export function ComplaintIntakeModal({ ctx }: { ctx: LuponDocketState }) {
  const {
    intakeOpen, closeIntake, intake, outsideComplainant, outsideName, setOutsideName,
    complainant, setComplainant, respondents, setOutsideComplainant, setRespondents,
    outsideAddress, setOutsideAddress, outsideContact, setOutsideContact,
    classification, setClassification, occurrenceDate, setOccurrenceDate, place, setPlace,
    relationship, setRelationship, narrative, setNarrative,
  } = ctx;
  const offline = useIsOffline();

  return (
    <Modal open={intakeOpen} onClose={closeIntake} title="Complaint Intake & Screening" size="xl">
      <p className="mb-3 text-xs text-warning">
        VAWC and child-abuse matters are outside KP jurisdiction and are blocked automatically.
      </p>
      {offline && (
        <p className="mb-3 rounded-xl border border-warning/40 bg-warning/5 px-3 py-2 text-xs leading-relaxed text-gray-600">
          <span className="font-semibold text-dark">No connection.</span> You can still file this
          complaint — it is kept on this device and sent when the line returns. The jurisdiction
          and VAWC checks run here as well, so a case the Lupon may not hear is refused now rather
          than later. The KP case number is issued when the office record receives it.
        </p>
      )}
      <form onSubmit={intake} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <FormField label="Complainant" required plain>
            {outsideComplainant ? (
              <input
                value={outsideName}
                onChange={(e) => setOutsideName(e.target.value)}
                required
                className={inputClasses}
                placeholder="Full name"
              />
            ) : (
              <ResidentPicker
                value={complainant}
                onChange={setComplainant}
                excludeIds={respondents.map((r) => r.id)}
              />
            )}
          </FormField>
          <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-dark">
            <input
              type="checkbox"
              checked={outsideComplainant}
              onChange={(e) => {
                setOutsideComplainant(e.target.checked);
                setComplainant(null);
              }}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            Not a resident of this barangay
          </label>
        </div>

        <div className="sm:col-span-1 lg:col-span-2">
          <FormField
            label="Respondent(s)"
            required
            plain
            hint="One or more, and each must live in this barangay — that is what gives the Lupon jurisdiction. The complainant need not."
          >
            {/*
              Residents only, and the complainant above is deliberately not.

              KP venue follows where the RESPONDENT lives. Somebody from
              another barangay was offered here and accepted, and the filing
              was then refused by the server after the whole complaint had
              been typed — the narrative, the date, the place, all of it.
            */}
            <ResidentMultiPicker
              value={respondents}
              onChange={setRespondents}
              excludeIds={complainant ? [complainant.id] : []}
              residentsOnly
            />
          </FormField>
        </div>

        {outsideComplainant && (
          <>
            <FormField label="Complainant address">
              <input
                value={outsideAddress}
                onChange={(e) => setOutsideAddress(e.target.value)}
                className={inputClasses}
                placeholder="Barangay / municipality"
              />
            </FormField>
            <FormField label="Complainant contact number">
              <PhoneInput value={outsideContact} onChange={setOutsideContact} />
            </FormField>
            <p className="self-end pb-2.5 text-xs text-gray-400">
              They will receive notices by summons rather than in-system.
            </p>
          </>
        )}

        {/*
          ONE field, where there were two.

          "Case title" was free text and "Classification" was a list, and the
          office typed the classification into the title every time — so the
          docket carried "Theft" twice, sometimes spelt differently, and no
          report could group by either with confidence. The list is the
          answer; the title follows it.
        */}
        <FormField label="Nature of the case" required>
          <select value={classification} onChange={(e) => setClassification(e.target.value)} className={inputClasses}>
            {CLASSIFICATIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Date of occurrence" required>
          <input type="date" value={occurrenceDate} onChange={(e) => setOccurrenceDate(e.target.value)} required className={inputClasses} />
        </FormField>
        <FormField label="Place of occurrence" required>
          <input value={place} onChange={(e) => setPlace(e.target.value)} required className={inputClasses} />
        </FormField>
        <FormField label="Relationship between parties" required>
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            required
            className={inputClasses}
          >
            <option value="">Select relationship…</option>
            {RELATIONSHIPS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </FormField>

        <div className="sm:col-span-2 lg:col-span-3">
          <FormField label="Nature of dispute / narrative" required>
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              required
              rows={2}
              className={`${inputClasses} resize-none`}
            />
          </FormField>
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={respondents.length === 0 || (outsideComplainant ? !outsideName.trim() : !complainant)}
            className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            File case
          </button>
        </div>
      </form>
    </Modal>
  );
}
