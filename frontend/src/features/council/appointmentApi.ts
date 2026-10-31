import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const appointmentApi = {
  list: (...args: QueryArgs) => api.get("/appointments", ...args),
  calendar: (...args: QueryArgs) => api.get("/appointments/calendar", ...args),
  bookedSlots: (date: string, excludeId?: number | string) =>
    api.get("/appointments/booked-slots", { params: { date, exclude_id: excludeId } }),
  get: (id: PathParam, ...args: QueryArgs) => api.get(`/appointments/${id}`, ...args),
  createWalkIn: (...args: BodyArgs) => api.post("/appointments", ...args),
  approve: (id: PathParam, ...args: BodyArgs) => api.post(`/appointments/${id}/approve`, ...args),
  reject: (id: PathParam, ...args: BodyArgs) => api.post(`/appointments/${id}/reject`, ...args),
  cancel: (id: PathParam, ...args: BodyArgs) => api.post(`/appointments/${id}/cancel`, ...args),
  updateMinutes: (id: PathParam, ...args: BodyArgs) => api.put(`/appointments/${id}/minutes`, ...args),
  delete: (id: PathParam, ...args: QueryArgs) => api.delete(`/appointments/${id}`, ...args),
};

export const residentAppointmentApi = {
  list: (...args: QueryArgs) => api.get("/portal/appointments", ...args),
  bookedSlots: (date: string) =>
    api.get("/portal/appointments/booked-slots", { params: { date } }),
  book: (...args: BodyArgs) => api.post("/portal/appointments", ...args),
  cancel: (id: PathParam, ...args: BodyArgs) => api.post(`/portal/appointments/${id}/cancel`, ...args),
};

export const publicAppointmentApi = {
  book: (...args: BodyArgs) => api.post("/appointments/book", ...args),
};

