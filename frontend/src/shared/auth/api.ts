/** Signing in, the session, and passwords. */

import { api, type BodyArgs, type QueryArgs } from "../lib/api";

export const authApi = {
  activate: (...args: BodyArgs) =>
    api.post("/auth/activate", ...args),
  changePassword: (...args: BodyArgs) =>
    api.post("/auth/change-password", ...args),
  forgotPassword: (...args: BodyArgs) =>
    api.post("/auth/forgot-password", ...args),
  login: (...args: BodyArgs) =>
    api.post("/auth/login", ...args),
  logout: (...args: BodyArgs) =>
    api.post("/auth/logout", ...args),
  me: (...args: QueryArgs) =>
    api.get("/auth/me", ...args),
  changeOwnPassword: (...args: BodyArgs) =>
    api.post("/auth/password-change", ...args),
  requestPasswordChangeCode: (...args: BodyArgs) =>
    api.post("/auth/password-change/code", ...args),
  updateProfile: (...args: BodyArgs) =>
    api.put("/auth/profile", ...args),
  resendActivation: (...args: BodyArgs) =>
    api.post("/auth/resend-activation", ...args),
  resetPassword: (...args: BodyArgs) =>
    api.post("/auth/reset-password", ...args),
  verifyResetCode: (...args: BodyArgs) =>
    api.post("/auth/verify-reset-code", ...args),
};
