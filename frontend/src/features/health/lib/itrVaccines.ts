/**
 * The vaccines on the DOH Individual Treatment Record, in the order the form
 * prints them.
 *
 * A COPY of ImmunizationRecord::CHILD_VACCINES and ADULT_VACCINES on the
 * server, which is the authority — it refuses any other name. It is copied
 * here for one reason: a health station with no line still has to open a
 * card and write a dose on it, and the card cannot be drawn without knowing
 * which boxes it has. The server's lists are used whenever they arrive; this
 * is only what the form falls back to.
 *
 * Kept in step by api_health.sh, which fails if the two ever differ.
 */
export const CHILD_VACCINES = [
  "BCG",
  "Hep B within 24 hrs",
  "Hep B after 24 hrs",
  "Penta 1", "Penta 2", "Penta 3",
  "PCV 1", "PCV 2", "PCV 3",
  "OPV 1", "OPV 2", "OPV 3",
  "IPV",
  "MCV 1", "MCV 2",
  "HPV 1", "HPV 2",
];

export const ADULT_VACCINES = [
  "Pneumococcal",
  "Flu vaccine",
  "COVID vaccine 1st dose",
  "COVID vaccine 2nd dose",
  "COVID booster",
  "Tetanus toxoid",
  "ATS",
];

export const DELIVERY_TYPES = ["NSVD", "Cesarian"] as const;
