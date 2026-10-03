import { useEffect, useState } from "react";
import { FiAlertTriangle, FiInfo } from "react-icons/fi";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import ResidentPicker from "../../../resident/components/ResidentPicker";
import { personName } from "../../../../shared/lib/names";
import { ageFrom } from "../../../../shared/lib/birthdate";
import { residentApi } from "../../../resident/api";
import type { Resident } from "../../../../shared/types";
import type { CertificateDeskState } from "../../hooks/useCertificateDesk";
import type { FilingItem } from "../../hooks/useCertificateFiling";

interface DeathCertificateWalkinFieldsProps {
  ctx: CertificateDeskState;
  item: FilingItem;
  requester: Resident | null;
}

export function DeathCertificateWalkinFields({ ctx, item, requester }: DeathCertificateWalkinFieldsProps) {
  const { changeField } = ctx;
  const [selectedDeceased, setSelectedDeceased] = useState<Resident | null>(null);
  const [isRelationshipDirty, setIsRelationshipDirty] = useState(Boolean(item.fields.relationship_to_deceased));
  const [isAgeDirty, setIsAgeDirty] = useState(Boolean(item.fields.deceased_age));
  const [isAddressDirty, setIsAddressDirty] = useState(Boolean(item.fields.deceased_address));

  // If restoring draft with deceased ID but no object in state
  useEffect(() => {
    const id = item.fields.deceased_resident_id;
    if (id && (!selectedDeceased || String(selectedDeceased.id) !== String(id))) {
      residentApi.resident(id)
        .then((res) => {
          if (res.data?.data) {
            setSelectedDeceased(res.data.data as Resident);
          }
        })
        .catch(() => undefined);
    }
  }, [item.fields.deceased_resident_id, selectedDeceased]);

  const handleSelectDeceased = (deceased: Resident | null) => {
    setSelectedDeceased(deceased);
    if (!deceased) {
      changeField(item.key, "deceased_resident_id", "");
      changeField(item.key, "deceased_name", "");
      return;
    }

    changeField(item.key, "deceased_resident_id", String(deceased.id));
    changeField(item.key, "deceased_name", personName(deceased));

    // Auto-calculate age from birthdate if not manually edited
    if (!isAgeDirty) {
      const calculatedAge = deceased.birthdate ? ageFrom(deceased.birthdate) : null;
      if (calculatedAge !== null) {
        changeField(item.key, "deceased_age", String(calculatedAge));
      }
    }

    // Auto-populate address if not manually edited
    if (!isAddressDirty) {
      const addr = deceased.address || (deceased.zone_purok ? `Zone ${deceased.zone_purok}, Barangay Natumolan` : "Barangay Natumolan");
      changeField(item.key, "deceased_address", addr);
    }

    // Lookup relationship to requester if not manually edited
    if (!isRelationshipDirty && requester?.id) {
      residentApi.relationship(requester.id, deceased.id)
        .then((res) => {
          const rel = res.data?.data?.relationship;
          if (rel && !isRelationshipDirty) {
            changeField(item.key, "relationship_to_deceased", rel);
          }
        })
        .catch(() => undefined);
    }
  };

  const isDeceasedAlready = selectedDeceased && selectedDeceased.life_status === "Deceased";

  return (
    <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/[0.02] p-4">
      {/* Informational Guidance Notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs leading-relaxed text-dark">
        <FiInfo className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="font-semibold text-primary">Important Staff Guidance</p>
          <p className="text-gray-600">
            Selecting a resident for Certification of Death does <strong>not</strong> immediately mark them as deceased in the population records. Official status update to <em>Deceased</em> will take place only when this certificate is officially filed.
          </p>
        </div>
      </div>

      {/* Warning if resident is already marked deceased */}
      {isDeceasedAlready && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-dark">
          <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <p className="font-semibold text-warning-dark">Already Recorded as Deceased</p>
            <p className="text-gray-700">
              This resident is already recorded as <strong>Deceased</strong> in the population register. Filing this certificate will issue an official copy without duplicating status changes.
            </p>
          </div>
        </div>
      )}

      {/* Search Deceased Resident */}
      <FormField label="Name of the deceased" required plain hint="Must be a resident on the official register">
        <ResidentPicker
          value={selectedDeceased}
          onChange={handleSelectDeceased}
          excludeIds={requester ? [requester.id] : []}
          residentsOnly
          placeholder="Search deceased resident by name…"
          notFound="A Certification of Death can only be issued for a resident on the barangay's register. Please coordinate with the Population Office to verify or register the record first."
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Relationship to Deceased */}
        <FormField
          label="Their relationship to the deceased"
          required
          hint="Auto-detected from family tree if available. Fully editable."
        >
          <input
            list="death-cert-relationship-suggestions"
            value={item.fields.relationship_to_deceased ?? ""}
            onChange={(e) => {
              setIsRelationshipDirty(true);
              changeField(item.key, "relationship_to_deceased", e.target.value);
            }}
            required
            className={inputClasses}
            placeholder="e.g. Spouse, Child, Parent, Sibling"
          />
          <datalist id="death-cert-relationship-suggestions">
            <option value="Spouse" />
            <option value="Child" />
            <option value="Parent" />
            <option value="Sibling" />
            <option value="Grandchild" />
            <option value="Grandparent" />
            <option value="Relative" />
            <option value="Guardian" />
            <option value="Legal Representative" />
          </datalist>
        </FormField>

        {/* Age of Deceased */}
        <FormField
          label="Age of the deceased"
          required
          hint="Auto-calculated from birthdate. Modifying here will NOT alter official birthdate."
        >
          <input
            type="number"
            min="0"
            max="150"
            value={item.fields.deceased_age ?? ""}
            onChange={(e) => {
              setIsAgeDirty(true);
              changeField(item.key, "deceased_age", e.target.value);
            }}
            required
            className={inputClasses}
            placeholder="e.g. 68"
          />
        </FormField>

        {/* Address of Deceased */}
        <div className="sm:col-span-2">
          <FormField
            label="Address of the deceased"
            required
            hint="Auto-populated from resident record. Modifying here will NOT alter their permanent population address."
          >
            <input
              value={item.fields.deceased_address ?? ""}
              onChange={(e) => {
                setIsAddressDirty(true);
                changeField(item.key, "deceased_address", e.target.value);
              }}
              required
              className={inputClasses}
              placeholder="e.g. Zone 2, Barangay Natumolan, Tagoloan, Misamis Oriental"
            />
          </FormField>
        </div>

        {/* Date of death */}
        <FormField
          label="Date of death"
          required
          hint="Must not be in the future. Does NOT default to today."
        >
          <input
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={item.fields.date_of_death ?? ""}
            onChange={(e) => changeField(item.key, "date_of_death", e.target.value)}
            required
            className={inputClasses}
          />
        </FormField>

        {/* Time of death */}
        <FormField
          label="Time of death"
          required
          hint="e.g. 10:30 AM or 3:00 o'clock in the afternoon. Does NOT default to current time."
        >
          <input
            value={item.fields.time_of_death ?? ""}
            onChange={(e) => changeField(item.key, "time_of_death", e.target.value)}
            required
            className={inputClasses}
            placeholder="e.g. 10:30 AM"
          />
        </FormField>

        {/* Place of death */}
        <div className="sm:col-span-2">
          <FormField
            label="Place of death"
            required
            hint="Exact place of death (e.g. House address, hospital name, municipality/city). Does NOT assume Barangay Natumolan."
          >
            <input
              value={item.fields.place_of_death ?? ""}
              onChange={(e) => changeField(item.key, "place_of_death", e.target.value)}
              required
              className={inputClasses}
              placeholder="e.g. Northern Mindanao Medical Center, Cagayan de Oro City"
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}
