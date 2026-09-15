/** The system administrator's calls: accounts and the non-resident register. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const adminApi = {
  nonResidents: (...args: QueryArgs) =>
    api.get("/admin/non-residents", ...args),
  users: (...args: QueryArgs) =>
    api.get("/admin/users", ...args),
  createUser: (...args: BodyArgs) =>
    api.post("/admin/users", ...args),
  updateUser: (userId: PathParam, ...args: BodyArgs) =>
    api.put(`/admin/users/${userId}`, ...args),
  deleteUser: (userId: PathParam, ...args: QueryArgs) =>
    api.delete(`/admin/users/${userId}`, ...args),
};
