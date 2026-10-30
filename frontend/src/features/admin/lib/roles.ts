/**
 * Which office each staff role belongs to.
 */

/**
 * Each role's office. Must stay in step with AdminUserController::ROLES /
 * ::OFFICES and the users-table enums — the SK roles were missing here, so an
 * SK account could not be created from this form at all.
 */
export const ROLE_OFFICE: Record<string, string> = {
  "Punong Barangay": "Main Office",
  Secretary: "Main Office",
  Clerk: "Main Office",
  "VAWC Officer": "VAWC",
  "Lupon Secretary": "Lupon",
  "Population Worker": "Population",
  "Health Personnel": "Health Station",
  Admin: "Admin",
};
