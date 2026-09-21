import { useEffect, useState } from "react";
import { populationApi } from "../api";

/** A zone of the barangay, and the health worker who covers it. */
export interface Bhw {
  id: number;
  name: string;
  contact_number?: string | null;
  is_active: boolean;
}

export interface Zone {
  id: number;
  name: string;
  sort_order: number;
  bhw_id: number | null;
  is_active: boolean;
  bhw?: Bhw | null;
}

/**
 * The barangay's zones, from the office that keeps them.
 *
 * Every form that asks where somebody lives used to carry its own copy of
 * the list — "Purok 1" to "Purok 5", written out four times in four files.
 * Barangay Natumolan has twenty-five zones and none of them is called that,
 * so all four were offering a choice that does not exist.
 *
 * One request, shared by every caller through the module-level cache below:
 * the intake form, the census and the household record are often on screen
 * together, and three identical requests for a list of twenty-five rows is
 * three chances for one of them to be the one that fails.
 */
let held: Zone[] | null = null;
let inFlight: Promise<Zone[]> | null = null;

async function fetchZones(): Promise<Zone[]> {
  const response = await populationApi.zones();

  return (response.data.data.zones ?? []) as Zone[];
}

/** Drops the shared copy, so the next read comes from the server. */
export function forgetZones(): void {
  held = null;
  inFlight = null;
}

export function useZones(): { zones: Zone[]; loading: boolean } {
  const [zones, setZones] = useState<Zone[]>(held ?? []);
  const [loading, setLoading] = useState(held === null);

  useEffect(() => {
    if (held !== null) {
      setZones(held);
      setLoading(false);

      return;
    }

    let alive = true;

    inFlight ??= fetchZones();
    inFlight
      .then((rows) => {
        held = rows;
        if (alive) setZones(rows);
      })
      .catch(() => {
        /* No line, or no permission. The caller shows an empty list rather
           than a stale one — a zone that has been renamed is worse than a
           dropdown that says nothing yet. */
        inFlight = null;
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return { zones, loading };
}

/** Just the names, for a plain dropdown. */
export function useZoneNames(): string[] {
  return useZones().zones.map((zone) => zone.name);
}
