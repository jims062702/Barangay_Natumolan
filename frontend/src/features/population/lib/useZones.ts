import { useEffect, useState } from "react";
import { populationApi } from "../api";

/**
 * A zone of the barangay.
 *
 * The health worker who covered each one went with the "Zones & BHWs"
 * screen that managed them — nothing else in the system ever read a BHW.
 */
export interface Zone {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
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

/*
 * No `forgetZones` any more. It dropped the shared copy after the "Zones &
 * BHWs" screen added or renamed one, so every form open at the time picked
 * the new list up. With that screen gone nothing changes the list inside a
 * session, and the cache is only ever filled once.
 */

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
