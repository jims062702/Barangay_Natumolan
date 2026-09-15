/** The barangay's document archive. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const recordsApi = {
  records: (...args: QueryArgs) =>
    api.get("/administrative-records", ...args),
  createRecord: (...args: BodyArgs) =>
    api.post("/administrative-records", ...args),
  updateRecord: (recordId: PathParam, ...args: BodyArgs) =>
    api.put(`/administrative-records/${recordId}`, ...args),
  deleteRecord: (recordId: PathParam, ...args: QueryArgs) =>
    api.delete(`/administrative-records/${recordId}`, ...args),
  approveRecord: (recordId: PathParam, ...args: BodyArgs) =>
    api.post(`/administrative-records/${recordId}/approve`, ...args),
  archiveRecord: (recordId: PathParam, ...args: BodyArgs) =>
    api.post(`/administrative-records/${recordId}/archive`, ...args),
};
