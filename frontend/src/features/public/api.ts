/** What the public site reads and sends — no sign-in needed. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const publicApi = {
  announcements: (...args: QueryArgs) =>
    api.get("/announcements", ...args),
  announcement: (announcementId: PathParam | undefined, ...args: QueryArgs) =>
    api.get(`/announcements/${announcementId}`, ...args),
  requestAppointment: (...args: BodyArgs) =>
    api.post("/appointment-requests", ...args),
  askAssistant: (...args: BodyArgs) =>
    api.post("/assistant/inquiry", ...args),
  sendContactMessage: (...args: BodyArgs) =>
    api.post("/contact", ...args),
  heroSlides: (...args: QueryArgs) =>
    api.get("/hero-slides", ...args),
  officials: (...args: QueryArgs) =>
    api.get("/officials", ...args),
  stats: (...args: QueryArgs) =>
    api.get("/stats", ...args),
  verifyCertificate: (reference: PathParam, ...args: QueryArgs) =>
    api.get(`/verify/${reference}`, ...args),
};
