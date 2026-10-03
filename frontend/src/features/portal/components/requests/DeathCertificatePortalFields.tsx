import { useEffect, useRef, useState } from "react";
import { FiAlertTriangle, FiInfo, FiSearch, FiUser, FiX } from "react-icons/fi";
import { useAuth } from "../../../../shared/auth/AuthContext";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import { portalApi } from "../../api";
import type { RequestItem } from "../../hooks/usePortalRequests";

interface DeceasedResult {
  id: number;
  full_name: string;
  resident_number: string;
  birthdate?: string | null;
  age?: number | null;
  address?: string;
  zone_purok?: string | null;
  life_status?: string;
  is_deceased?: boolean;
  relationship?: string | null;
}

interface DeathCertificatePortalFieldsProps {
  item: RequestItem;
  patchItem: (key: string, patch: Partial<RequestItem>) => void;
}

export function DeathCertificatePortalFields({ item, patchItem }: DeathCertificatePortalFieldsProps) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<DeceasedResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isRelationshipDirty, setIsRelationshipDirty] = useState(Boolean(item.relationshipToDeceased));
  const [isAgeDirty, setIsAgeDirty] = useState(Boolean(item.deceasedAge));
  const [isAddressDirty, setIsAddressDirty] = useState(Boolean(item.deceasedAddress));
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch initial family suggestions or matching residents
  useEffect(() => {
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      portalApi.searchDeceased({ params: { q: searchTerm.trim() } })
        .then((res) => {
          if (!active) return;
          setResults((res.data?.data ?? []) as DeceasedResult[]);
        })
        .catch(() => {
          if (active) setResults([]);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, searchTerm ? 250 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (r: DeceasedResult) => {
    const patch: Partial<RequestItem> = {
      deceasedResidentId: String(r.id),
      deceasedName: r.full_name,
    };

    if (!isAgeDirty && r.age !== null && r.age !== undefined) {
      patch.deceasedAge = String(r.age);
    }
    if (!isAddressDirty && r.address) {
      patch.deceasedAddress = r.address;
    }
    if (!isRelationshipDirty && r.relationship) {
      patch.relationshipToDeceased = r.relationship;
    }

    patchItem(item.key, patch);
    setShowDropdown(false);
    setSearchTerm("");
  };

  const handleClearSelected = () => {
    patchItem(item.key, {
      deceasedResidentId: "",
      deceasedName: "",
    });
    setSearchTerm("");
  };

  const selectedId = item.deceasedResidentId;
  const selectedName = item.deceasedName;

  return (
    <div className="space-y-4 rounded-2xl border border-primary/20 bg-secondary/40 p-4">
      {/* Read-only Requested By display */}
      <div className="flex items-center justify-between rounded-xl border border-gray bg-white px-3.5 py-2.5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Requested by</span>
          <p className="text-sm font-bold text-dark">
            You ({user?.name || "Resident"})
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          Verified Resident
        </span>
      </div>

      {/* Informational Guidance Notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs leading-relaxed text-dark">
        <FiInfo className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="font-semibold text-primary">Important Review Notice</p>
          <p className="text-gray-600">
            Submitting this request will be officially reviewed and verified by the Barangay Office. Submitting does <strong>not</strong> immediately change the resident&apos;s status to Deceased. Official updates will only take place once verified and issued by the office.
          </p>
        </div>
      </div>

      {/* Deceased Resident Search / Display */}
      <div className="relative" ref={dropdownRef}>
        <FormField
          label="Name of the deceased"
          required
          hint={selectedId ? "Selected resident from barangay records" : "Search by name from barangay resident records"}
        >
          {selectedId && selectedName ? (
            <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-white px-3 py-2">
              <div className="flex items-center gap-2">
                <FiUser className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="text-sm font-semibold text-dark">{selectedName}</span>
              </div>
              <button
                type="button"
                onClick={handleClearSelected}
                className="cursor-pointer text-xs font-semibold text-gray-400 hover:text-danger"
                aria-label="Change deceased resident"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <FiSearch className="h-4 w-4 text-gray-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Type resident's name to search…"
                className={`${inputClasses} pl-9`}
              />
            </div>
          )}
        </FormField>

        {/* Dropdown search results */}
        {showDropdown && !selectedId && (
          <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray bg-white p-1.5 shadow-lg">
            {searching ? (
              <p className="p-3 text-center text-xs text-gray-500">Searching records…</p>
            ) : results.length === 0 ? (
              <p className="p-3 text-center text-xs text-gray-500">
                {searchTerm ? "No matching resident found on the barangay register." : "No family members found to suggest. Type to search."}
              </p>
            ) : (
              <ul className="space-y-1">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(r)}
                      className="flex w-full cursor-pointer flex-col rounded-lg px-3 py-2 text-left hover:bg-secondary transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-dark">{r.full_name}</span>
                        {r.relationship && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                            {r.relationship}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {r.age !== null && r.age !== undefined && <span>{r.age} yrs old</span>}
                        {r.zone_purok && <span>Zone {r.zone_purok}</span>}
                        {(r.is_deceased || r.life_status === "Deceased") && (
                          <span className="flex items-center gap-1 text-warning">
                            <FiAlertTriangle className="h-3 w-3" /> Already recorded as Deceased
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Relationship */}
        <FormField
          label="Your relationship to the deceased"
          required
          hint="e.g. Spouse, Child, Parent, Sibling"
        >
          <input
            list="portal-death-cert-relationships"
            value={item.relationshipToDeceased ?? ""}
            onChange={(e) => {
              setIsRelationshipDirty(true);
              patchItem(item.key, { relationshipToDeceased: e.target.value });
            }}
            required
            className={inputClasses}
            placeholder="e.g. Spouse, Child, Parent"
          />
          <datalist id="portal-death-cert-relationships">
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
          hint="Auto-filled from birthdate. Editable if verified otherwise."
        >
          <input
            type="number"
            min="0"
            max="150"
            value={item.deceasedAge ?? ""}
            onChange={(e) => {
              setIsAgeDirty(true);
              patchItem(item.key, { deceasedAge: e.target.value });
            }}
            required
            className={inputClasses}
            placeholder="e.g. 70"
          />
        </FormField>

        {/* Address */}
        <div className="sm:col-span-2">
          <FormField
            label="Address of the deceased"
            required
            hint="Auto-populated from resident records. Editable if needed."
          >
            <input
              value={item.deceasedAddress ?? ""}
              onChange={(e) => {
                setIsAddressDirty(true);
                patchItem(item.key, { deceasedAddress: e.target.value });
              }}
              required
              className={inputClasses}
              placeholder="e.g. Zone 2, Barangay Natumolan"
            />
          </FormField>
        </div>

        {/* Date of death */}
        <FormField
          label="Date of death"
          required
          hint="Select the actual date of death"
        >
          <input
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={item.dateOfDeath ?? ""}
            onChange={(e) => patchItem(item.key, { dateOfDeath: e.target.value })}
            required
            className={inputClasses}
          />
        </FormField>

        {/* Time of death */}
        <FormField
          label="Time of death"
          required
          hint="e.g. 10:30 AM or 3:00 PM"
        >
          <input
            value={item.timeOfDeath ?? ""}
            onChange={(e) => patchItem(item.key, { timeOfDeath: e.target.value })}
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
            hint="Enter exact place of death (home address, hospital, city/municipality)"
          >
            <input
              value={item.placeOfDeath ?? ""}
              onChange={(e) => patchItem(item.key, { placeOfDeath: e.target.value })}
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
