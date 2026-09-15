import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isAxiosError } from "axios";
import { clearAllDrafts } from "../lib/formDraft";
import { isOffline } from "../offline/connectivity";
import {
  cachedProfile,
  forgetOfflineGrant,
  rememberForOffline,
  signInOffline,
  updateCachedProfile,
  type OfflineSignIn,
} from "./offlineAuth";
import { authApi } from "./api";
import type { User } from "../types";

/**
 * What a sign-in attempt produced. A resident's portal account is created
 * FOR them when they are registered, so the first attempt does not sign them
 * in: it sends a code to the address on their record, and entering that is
 * what turns the account on.
 */
export type LoginResult =
  | { kind: "signed-in"; user: User }
  | { kind: "needs-activation"; email: string; otpSent: boolean; message: string };

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  /** Second half of a first sign-in: the emailed code. */
  activate: (email: string, password: string, code: string) => Promise<User>;
  logout: () => Promise<void>;
  /**
   * Re-read the signed-in account.
   *
   * For when somebody edits their own name or email: without it the sidebar
   * and the topbar keep showing what they were called a moment ago, and the
   * only way to correct that is to sign out.
   */
  refresh: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * What to tell somebody an offline sign-in refused.
 *
 * One message per reason. "Sign-in failed" covering all of them would send
 * a clerk hunting for a wrong password when the real answer is that this
 * device has never seen their account.
 */
function offlineSignInMessage(result: OfflineSignIn): string {
  switch (result.kind) {
    case "no-grant":
      return "No connection, and no account has been saved on this device yet. "
        + "Sign in once while connected to the internet first.";
    case "wrong-account":
      return "No connection. Only the account that last signed in on this device "
        + "can sign in offline.";
    case "wrong-password":
      return `Incorrect password. ${result.remaining} attempts left before this device `
        + "locks until the connection returns.";
    case "locked":
      return "Too many incorrect attempts. Connect to the internet "
        + "before signing in again.";
    case "expired":
      return "This device has not connected for a long time, so you need to "
        + "sign in while connected to the internet.";
    default:
      return "Cannot sign in offline.";
  }
}

/** Where an account lands after login. */
export function homePathFor(user: User): string {
  return user.role === "Resident" ? "/portal" : "/dashboard";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      if (!localStorage.getItem("authToken")) {
        setLoading(false);
        return;
      }

      /*
       * Offline: ask the device, not the server.
       *
       * This used to call /auth/me regardless, and a request that never
       * came back landed in the catch below — which deleted the token. So
       * refreshing the page with the line down signed the office out and
       * dropped them on a login page that cannot work without a server.
       * That was the single worst thing offline mode did.
       */
      if (isOffline()) {
        const cached = await cachedProfile();

        if (cached) {
          setUser(cached.user);
          setLoading(false);

          return;
        }
      }

      try {
        const response = await authApi.me();

        setUser(response.data.data);
        /* Keep the device's copy in step, so the next offline refresh
           restores the profile as the server last described it. */
        void updateCachedProfile(response.data.data);
      } catch (error) {
        /*
         * Only a REFUSED token ends the session. A request that never
         * arrived says nothing about whether the token is good, and
         * deleting it on that basis is how a dropped line became a
         * lock-out. The interceptor already clears on a real 401.
         */
        if (isAxiosError(error) && error.response) {
          localStorage.removeItem("authToken");
        } else {
          const cached = await cachedProfile();

          if (cached) {
            setUser(cached.user);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, []);

  /** Stores the issued token and puts the account into the session. */
  const adopt = (payload: { user: User; token: string }): User => {
    localStorage.setItem("authToken", payload.token);
    setUser(payload.user);
    return payload.user;
  };

  const refresh = async () => {
    try {
      const response = await authApi.me();
      setUser(response.data.data);
    } catch {
      /* A failed refresh must not sign anybody out — the interceptor already
         handles a token the server has actually refused. */
    }
  };

  const login = async (email: string, password: string): Promise<LoginResult> => {
    /*
     * With no line, the only thing that can check a password is this
     * device — and only for the account that last signed in on it.
     */
    if (isOffline()) {
      const attempt = await signInOffline(email, password);

      if (attempt.kind === "ok") {
        localStorage.setItem("authToken", attempt.token);
        setUser(attempt.user);

        return { kind: "signed-in", user: attempt.user };
      }

      throw new Error(offlineSignInMessage(attempt));
    }

    const response = await authApi.login({ email, password });
    const data = response.data.data;

    // No token means the credentials were right but the account has never
    // been activated — the caller shows the code entry instead of navigating.
    if (data?.requires_activation) {
      return {
        kind: "needs-activation",
        email: data.email,
        otpSent: !!data.otp_sent,
        message: response.data.message,
      };
    }

    const signedIn = adopt(data);

    /*
     * Recorded only now, with the SERVER's answer in hand. Nothing here
     * decides whether a password is right the first time — it stores that
     * the server already said so, which is what lets the same person back
     * in tomorrow with the line down.
     */
    void rememberForOffline(email, password, signedIn, data.token);

    return { kind: "signed-in", user: signedIn };
  };

  const activate = async (email: string, password: string, code: string): Promise<User> => {
    const response = await authApi.activate({ email, password, code });
    return adopt(response.data.data);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Token may already be invalid — clearing locally is enough.
    }
    localStorage.removeItem("authToken");

    /*
      * The account is forgotten only on a CONNECTED sign-out.
      *
      * Forgetting it with the line down would leave nobody able to get back
      * in — the device would have thrown away the only thing that can check
      * a password, and there is no server to ask instead. Signing out is
      * usually the last thing somebody does before walking away from a desk,
      * which is exactly when that lock-out would be discovered.
      *
      * Keeping it is safe: the grant is useless without the password, so a
      * stranger at the same desk is no better off than before.
      */
     if (!isOffline()) {
       void forgetOfflineGrant();
     }

    /*
     * Half-typed forms go with the session. A draft holds residents' names,
     * birthdates and phone numbers, and the next person at this desk has no
     * business seeing them — which is also why the form promises they last
     * only until logout.
     */
    clearAllDrafts();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, activate, logout, refresh, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
