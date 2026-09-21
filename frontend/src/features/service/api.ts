/** The front desk: requests and certificates. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const serviceApi = {
  certificates: (...args: QueryArgs) =>
    api.get("/certificates", ...args),
  createCertificate: (...args: BodyArgs) =>
    api.post("/certificates", ...args),
  certificate: (certificateId: PathParam, ...args: QueryArgs) =>
    api.get(`/certificates/${certificateId}`, ...args),
  updateCertificate: (certificateId: PathParam, ...args: BodyArgs) =>
    api.put(`/certificates/${certificateId}`, ...args),
  certificateStep: (certificateId: PathParam, step: PathParam, ...args: BodyArgs) =>
    api.post(`/certificates/${certificateId}/${step}`, ...args),
  markCertificatePrinted: (certificateId: PathParam, ...args: BodyArgs) =>
    api.post(`/certificates/${certificateId}/mark-printed`, ...args),
  uploadCertificatePhoto: (certificateId: PathParam, ...args: BodyArgs) =>
    api.post(`/certificates/${certificateId}/photo`, ...args),
  certificateReport: (...args: QueryArgs) =>
    api.get("/certificates/report", ...args),
  serviceRequests: (...args: QueryArgs) =>
    api.get("/service-requests", ...args),
  serviceRequest: (requestId: PathParam, ...args: QueryArgs) =>
    api.get(`/service-requests/${requestId}`, ...args),
  updateServiceRequest: (requestId: PathParam, ...args: BodyArgs) =>
    api.put(`/service-requests/${requestId}`, ...args),
};
