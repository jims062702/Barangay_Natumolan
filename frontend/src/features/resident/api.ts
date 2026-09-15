/** The resident register: records, families, marriages, merges and transfers. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const residentApi = {
  residents: (...args: QueryArgs) =>
    api.get("/residents", ...args),
  register: (...args: BodyArgs) =>
    api.post("/residents", ...args),
  importRegister: (...args: BodyArgs) =>
    api.post("/residents-import", ...args),
  previewImport: (...args: BodyArgs) =>
    api.post("/residents-import/preview", ...args),
  resident: (residentId: PathParam | undefined, ...args: QueryArgs) =>
    api.get(`/residents/${residentId}`, ...args),
  updateResident: (residentId: PathParam | undefined, ...args: BodyArgs) =>
    api.put(`/residents/${residentId}`, ...args),
  deleteResident: (residentId: PathParam, ...args: QueryArgs) =>
    api.delete(`/residents/${residentId}`, ...args),
  convertToResident: (residentId: PathParam, ...args: BodyArgs) =>
    api.post(`/residents/${residentId}/convert-to-resident`, ...args),
  duplicates: (residentId: PathParam, ...args: QueryArgs) =>
    api.get(`/residents/${residentId}/duplicates`, ...args),
  addRelative: (residentId: PathParam, relation: PathParam, ...args: BodyArgs) =>
    api.post(`/residents/${residentId}/family/${relation}`, ...args),
  unlinkRelative: (residentId: PathParam | undefined, relativeId: PathParam, ...args: QueryArgs) =>
    api.delete(`/residents/${residentId}/family/${relativeId}`, ...args),
  linkRelative: (residentId: PathParam, ...args: BodyArgs) =>
    api.post(`/residents/${residentId}/family/link`, ...args),
  endGuardianship: (residentId: PathParam, guardianshipId: PathParam, ...args: BodyArgs) =>
    api.post(`/residents/${residentId}/guardianships/${guardianshipId}/end`, ...args),
  updateLifeStatus: (residentId: PathParam, ...args: BodyArgs) =>
    api.post(`/residents/${residentId}/life-status`, ...args),
  marriages: (residentId: PathParam, ...args: QueryArgs) =>
    api.get(`/residents/${residentId}/marriages`, ...args),
  endMarriage: (residentId: PathParam, marriageId: PathParam, ...args: BodyArgs) =>
    api.post(`/residents/${residentId}/marriages/${marriageId}/end`, ...args),
  setMarriageVisibility: (residentId: PathParam, marriageId: PathParam, ...args: BodyArgs) =>
    api.post(`/residents/${residentId}/marriages/${marriageId}/visibility`, ...args),
  merge: (residentId: PathParam, ...args: BodyArgs) =>
    api.post(`/residents/${residentId}/merge`, ...args),
  merges: (residentId: PathParam, ...args: QueryArgs) =>
    api.get(`/residents/${residentId}/merges`, ...args),
  undoMerge: (residentId: PathParam, mergeId: PathParam, ...args: BodyArgs) =>
    api.post(`/residents/${residentId}/merges/${mergeId}/undo`, ...args),
  addSector: (residentId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/residents/${residentId}/sectors`, ...args),
  removeSector: (residentId: PathParam | undefined, sectorId: PathParam, ...args: QueryArgs) =>
    api.delete(`/residents/${residentId}/sectors/${sectorId}`, ...args),
  registerHousehold: (...args: BodyArgs) =>
    api.post("/residents/household", ...args),
  householdOptions: (...args: QueryArgs) =>
    api.get("/residents/household-options", ...args),
  search: (...args: QueryArgs) =>
    api.get("/residents/search", ...args),
};
