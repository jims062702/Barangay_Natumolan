import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const appointmentApi = {
  list: (...args: QueryArgs) => api.get("/appointments", ...args),
  calendar: (...args: QueryArgs) => api.get("/appointments/calendar", ...args),
  get: (id: PathParam, ...args: QueryArgs) => api.get(`/appointments/${id}`, ...args),
  createWalkIn: (...args: BodyArgs) => api.post("/appointments", ...args),
  approve: (id: PathParam, ...args: BodyArgs) => api.post(`/appointments/${id}/approve`, ...args),
  reject: (id: PathParam, ...args: BodyArgs) => api.post(`/appointments/${id}/reject`, ...args),
  updateMinutes: (id: PathParam, ...args: BodyArgs) => api.put(`/appointments/${id}/minutes`, ...args),
  delete: (id: PathParam, ...args: QueryArgs) => api.delete(`/appointments/${id}`, ...args),
};

export const residentAppointmentApi = {
  list: (...args: QueryArgs) => api.get("/portal/appointments", ...args),
  book: (...args: BodyArgs) => api.post("/portal/appointments", ...args),
};

export const publicAppointmentApi = {
  book: (...args: BodyArgs) => api.post("/appointments/book", ...args),
};
