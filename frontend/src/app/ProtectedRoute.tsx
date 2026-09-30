import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { AppShellSkeleton } from "../shared/ui/Skeleton";
import { useAuth, homePathFor, sessionHint } from "../shared/auth/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  /** Allow if the user's office matches ANY entry (OR'd with allowedRoles). */
  allowedOffices?: string[];
  /** Allow if the user's role matches ANY entry (OR'd with allowedOffices). */
  allowedRoles?: string[];
  /** Block these roles outright — mirrors the API's `deny_role:` middleware. */
  deniedRoles?: string[];
  /** Any staff account (blocks resident portal accounts). */
  staffOnly?: boolean;
  /** Resident portal accounts only. */
  residentOnly?: boolean;
}

export default function ProtectedRoute({
  children,
  allowedOffices,
  allowedRoles,
  deniedRoles,
  staffOnly,
  residentOnly,
}: ProtectedRouteProps) {
  const { isAuthenticated, loading, user } = useAuth();

  /*
   * A refresh has to ask the server who is signed in before it can decide
   * what to draw. That used to be a spinner on an empty page — a blank
   * screen that says "wait" and nothing about what is coming, and which on a
   * slow connection is indistinguishable from a broken one.
   *
   * The shell instead: the sidebar and the top bar are already in place, so
   * the page fills in rather than jumping from nothing to everything.
   */
  /*
   * Whether an account may open this area — ONE rule, used twice: for the
   * account the session check is still confirming (the office this device
   * last signed in as), and for the account it confirms.
   */
  const mayOpen = (account: { office: string; role: string }) => {
    const isResident = account.role === "Resident";
    if (staffOnly && isResident) return false;
    if (residentOnly && !isResident) return false;
    if (deniedRoles?.includes(account.role)) return false;
    if (allowedOffices || allowedRoles) {
      return (allowedOffices?.includes(account.office) ?? false) || (allowedRoles?.includes(account.role) ?? false);
    }

    return true;
  };

  /*
   * While the session is checked, the page's own skeleton — but only for an
   * account that will be let in. A page this office may not open never shows
   * its shape first: the shell waits empty, and then says so.
   */
  if (loading) {
    const hint = sessionHint();

    return <AppShellSkeleton withPage={!hint || mayOpen(hint)} />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const isResident = user.role === "Resident";

  // Send accounts to their own area instead of a dead end.
  if (staffOnly && isResident) return <Navigate to="/resident" replace />;
  if (residentOnly && !isResident) return <Navigate to="/dashboard" replace />;

  const denied = deniedRoles?.includes(user.role) ?? false;

  if (denied || allowedOffices || allowedRoles) {
    // A denied role loses even if its office would otherwise be allowed.
    if (!mayOpen(user)) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-secondary px-4 text-center">
          <span className="text-5xl" aria-hidden="true">🔒</span>
          <h1 className="text-2xl font-bold text-dark">Access Restricted</h1>
          <p className="max-w-md text-sm text-gray-500">
            Your account ({user.role} — {user.office}) is not authorized for this
            module. Records here are limited to the responsible office.
          </p>
          <Link
            to={homePathFor(user)}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Back to my dashboard
          </Link>
        </div>
      );
    }
  }

  return <>{children}</>;
}
