/** Barangay Health Station records. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const healthApi = {
  /* Child Health & Nutrition — every weighing kept. */
  childHealth: (...args: QueryArgs) =>
    api.get("/health/child-health", ...args),
  recordChildHealth: (...args: BodyArgs) =>
    api.post("/health/child-health", ...args),
  updateChildHealth: (id: PathParam, ...args: BodyArgs) =>
    api.put(`/health/child-health/${id}`, ...args),
  deleteChildHealth: (id: PathParam, ...args: QueryArgs) =>
    api.delete(`/health/child-health/${id}`, ...args),
  /* A child's register details, parents and every weighing. */
  childHistory: (residentId: PathParam, ...args: QueryArgs) =>
    api.get(`/health/child-health/children/${residentId}`, ...args),
  /* A mother on the register, and the children the register lists as hers. */
  motherChildren: (residentId: PathParam, ...args: QueryArgs) =>
    api.get(`/health/child-health/mother/${residentId}`, ...args),

  immunizations: (...args: QueryArgs) =>
    api.get("/health/immunization", ...args),
  /* One person's immunization record, as the ITR lays it out — read, and
     written back whole. */
  /* Doses owed, worked out from birth dates and the DOH schedule. */
  immunizationDue: (...args: QueryArgs) =>
    api.get("/health/immunization-due", ...args),
  immunizationCard: (residentId: PathParam, ...args: QueryArgs) =>
    api.get(`/health/immunization-card/${residentId}`, ...args),
  saveImmunizationCard: (residentId: PathParam, ...args: BodyArgs) =>
    api.put(`/health/immunization-card/${residentId}`, ...args),

  /* Maternal Health — one record per pregnancy. */
  maternalHealth: (...args: QueryArgs) =>
    api.get("/health/maternal-health", ...args),
  recordMaternalHealth: (...args: BodyArgs) =>
    api.post("/health/maternal-health", ...args),
  pregnancy: (id: PathParam, ...args: QueryArgs) =>
    api.get(`/health/maternal-health/${id}`, ...args),
  motherPregnancies: (residentId: PathParam, ...args: QueryArgs) =>
    api.get(`/health/maternal-health/mother/${residentId}`, ...args),
  updatePregnancy: (id: PathParam, ...args: BodyArgs) =>
    api.put(`/health/maternal-health/${id}`, ...args),
  deletePregnancy: (id: PathParam, ...args: QueryArgs) =>
    api.delete(`/health/maternal-health/${id}`, ...args),
  completePregnancy: (id: PathParam, ...args: BodyArgs) =>
    api.post(`/health/maternal-health/${id}/complete`, ...args),
  reopenPregnancy: (id: PathParam, ...args: BodyArgs) =>
    api.post(`/health/maternal-health/${id}/reopen`, ...args),

  /* Prenatal Records — counted per pregnancy, never typed. */
  prenatalRecords: (...args: QueryArgs) =>
    api.get("/health/prenatal-visits", ...args),
  recordPrenatal: (...args: BodyArgs) =>
    api.post("/health/prenatal-visits", ...args),
  updatePrenatal: (id: PathParam, ...args: BodyArgs) =>
    api.put(`/health/prenatal-visits/${id}`, ...args),
  deletePrenatal: (id: PathParam, ...args: QueryArgs) =>
    api.delete(`/health/prenatal-visits/${id}`, ...args),

  coverageReport: (...args: QueryArgs) =>
    api.get("/health/reports/coverage", ...args),
  recordsSummary: (...args: QueryArgs) =>
    api.get("/health/reports/summary", ...args),
  /* The one-page BARANGAY MONTHLY REPORT's figures for ?year=&month=. */
  barangayMonthly: (...args: QueryArgs) =>
    api.get("/health/reports/barangay-monthly", ...args),
  /* child | maternal | prenatal; monthly with a month, yearly without. */
  recordsReport: (kind: PathParam, ...args: QueryArgs) =>
    api.get(`/health/reports/records/${kind}`, ...args),

  visits: (...args: QueryArgs) =>
    api.get("/health/visits", ...args),
  recordVisit: (...args: BodyArgs) =>
    api.post("/health/visits", ...args),
};
