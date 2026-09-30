/** What the public site reads and sends — no sign-in needed. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const publicApi = {
  announcements: (...args: QueryArgs) =>
    api.get("/announcements", ...args),
  announcement: (announcementId: PathParam | undefined, ...args: QueryArgs) =>
    api.get(`/announcements/${announcementId}`, ...args),
  askAssistant: (...args: BodyArgs) =>
    api.post("/assistant/inquiry", ...args),
  /* The chatbot's guest limit, counted by the server per DEVICE (the
     X-Guest-Device header — see features/chat/lib/guestDevice) — what is
     left today, one message taken, and one handed back when the chatbot
     could not be reached to answer it. */
  guestAllowance: (...args: QueryArgs) =>
    api.get("/assistant/allowance", ...args),
  takeGuestAllowance: (...args: BodyArgs) =>
    api.post("/assistant/allowance", ...args),
  returnGuestAllowance: (...args: BodyArgs) =>
    api.post("/assistant/allowance/return", ...args),
  sendContactMessage: (...args: BodyArgs) =>
    api.post("/contact", ...args),
  /* Beginning a KP complaint without signing in. Multipart: a photograph of
     a valid ID is required, evidence is not. What comes back is an Online
     Complaint Reference Number — not a case number. */
  fileComplaint: (...args: BodyArgs) =>
    api.post("/complaints", ...args),
  heroSlides: (...args: QueryArgs) =>
    api.get("/hero-slides", ...args),
  officials: (...args: QueryArgs) =>
    api.get("/officials", ...args),
  stats: (...args: QueryArgs) =>
    api.get("/stats", ...args),
  /* A Barangay Resident ID, checked: the page its QR opens, and the check a
     complaint form runs on an uploaded picture of one. */
  residentIdStatus: (code: PathParam, ...args: QueryArgs) =>
    api.get(`/resident-id/${code}`, ...args),
  verifyResidentId: (...args: BodyArgs) =>
    api.post("/resident-id/verify", ...args),
  /* Online Certificate Request — residents only, without signing in, by their Resident ID. */
  certificateServices: (...args: QueryArgs) =>
    api.get("/certificate-request/services", ...args),
  checkCertificateRequest: (...args: BodyArgs) =>
    api.post("/certificate-request/check", ...args),
  sendCertificateRequest: (...args: BodyArgs) =>
    api.post("/certificate-request", ...args),
  /* A VAWC report sent online — residents only, by their Resident ID. */
  sendVawcReport: (...args: BodyArgs) =>
    api.post("/vawc/report", ...args),
  verifyCertificate: (reference: PathParam, ...args: QueryArgs) =>
    api.get(`/verify/${reference}`, ...args),
};
