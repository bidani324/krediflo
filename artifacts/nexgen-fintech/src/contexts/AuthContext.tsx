/**
 * @fileoverview Authentication context for the Krediflo frontend.
 *
 * Provides two independent auth streams — portal users and admin operators —
 * through a single React context so any component in the tree can access the
 * current identity without prop-drilling.
 *
 * Architecture note: Both user and admin sessions share the same Express
 * session cookie (`connect.sid`).  The server enforces mutual exclusivity:
 * logging in as a user clears `adminId` from the session and vice-versa.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { API_ROUTES } from "@/config/constants";

/* ─── Domain Types ────────────────────────────────────────────────────────── */

/**
 * Shape of a logged-in portal user, as returned by `GET /api/auth/me`.
 * PAN is always masked server-side (e.g. `XXXXXP678Q`).
 */
export interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  mobile: string;
  /** Masked PAN — first 5 chars replaced with 'X'. */
  pan: string;
  address?: string | null;
  createdAt: string;
}

/**
 * Shape of a logged-in admin operator, as returned by `GET /api/admin/auth/me`.
 * Admin records intentionally carry fewer fields than user records.
 */
export interface AdminProfile {
  id: number;
  name: string;
  email: string;
}

/**
 * Public interface exposed by `useAuth()`.
 * Components should destructure only the fields they need to minimise re-renders.
 */
export interface AuthContextValue {
  /** Currently authenticated portal user, or `null` if not signed in. */
  user: UserProfile | null;
  /** Currently authenticated admin operator, or `null` if not signed in. */
  admin: AdminProfile | null;
  /** `true` while the initial `GET /api/auth/me` request is in-flight. */
  isLoadingUser: boolean;
  /** `true` while the initial `GET /api/admin/auth/me` request is in-flight. */
  isLoadingAdmin: boolean;
  /**
   * Manually sets the user state without an API round-trip.
   * Called by the Login page after a successful `POST /api/auth/login`.
   */
  loginUser: (user: UserProfile) => void;
  /**
   * Calls `POST /api/auth/logout`, destroys the server session,
   * and clears local user state.
   */
  logoutUser: () => Promise<void>;
  /**
   * Manually sets the admin state without an API round-trip.
   * Called by AdminLogin after a successful `POST /api/admin/auth/login`.
   */
  loginAdmin: (admin: AdminProfile) => void;
  /**
   * Calls `POST /api/admin/auth/logout`, destroys the server session,
   * and clears local admin state.
   */
  logoutAdmin: () => Promise<void>;
  /**
   * Re-fetches the current user session from the server.
   * Useful after profile edits or when re-mounting a protected page.
   */
  refreshUser: () => Promise<void>;
  /**
   * Re-fetches the current admin session from the server.
   */
  refreshAdmin: () => Promise<void>;
}

/* ─── Context Initialisation ─────────────────────────────────────────────── */

/**
 * Internal React context — consumers must go through `useAuth()` which
 * enforces that the hook is called within an `<AuthProvider>`.
 */
const AuthContext = createContext<AuthContextValue | null>(null);

/* ─── Provider ───────────────────────────────────────────────────────────── */

/**
 * @description Wraps the application (or a subtree) with user and admin
 *   authentication state.  On mount it silently probes both session endpoints
 *   in parallel; components render immediately with `isLoading*: true` and
 *   update once the probes resolve.
 *
 * @param {{ children: ReactNode }} props - React children to render inside the provider.
 * @returns {JSX.Element} The context provider wrapping `children`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                   = useState<UserProfile | null>(null);
  const [admin, setAdmin]                 = useState<AdminProfile | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true);

  /**
   * @description Probes `GET /api/auth/me` to restore an existing user session
   *   after a page reload.  Sets `isLoadingUser` to `false` whether or not a
   *   session is found, so guarded routes can render their fallback state.
   *
   * @returns {Promise<void>}
   * @throws Never — all errors are caught and treated as "not authenticated".
   */
  async function refreshUser(): Promise<void> {
    try {
      const res = await fetch(API_ROUTES.USER_ME, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      // Network failure — treat as unauthenticated; user can retry via login
      setUser(null);
    } finally {
      setIsLoadingUser(false);
    }
  }

  /**
   * @description Probes `GET /api/admin/auth/me` to restore an existing admin
   *   session after a page reload.  Mirrors `refreshUser` behaviour.
   *
   * @returns {Promise<void>}
   * @throws Never — all errors are caught and treated as "not authenticated".
   */
  async function refreshAdmin(): Promise<void> {
    try {
      const res = await fetch(API_ROUTES.ADMIN_ME, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAdmin(data.admin);
      } else {
        setAdmin(null);
      }
    } catch {
      setAdmin(null);
    } finally {
      setIsLoadingAdmin(false);
    }
  }

  /* Probe both sessions in parallel on first mount. */
  useEffect(() => {
    void refreshUser();
    void refreshAdmin();
  }, []);

  /**
   * @description Calls `POST /api/auth/logout` to destroy the server-side
   *   session, then clears the local user state.
   *
   * @returns {Promise<void>}
   */
  async function logoutUser(): Promise<void> {
    await fetch(API_ROUTES.USER_LOGOUT, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }

  /**
   * @description Calls `POST /api/admin/auth/logout` to destroy the server-side
   *   admin session, then clears local admin state.
   *
   * @returns {Promise<void>}
   */
  async function logoutAdmin(): Promise<void> {
    await fetch(API_ROUTES.ADMIN_LOGOUT, {
      method: "POST",
      credentials: "include",
    });
    setAdmin(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        admin,
        isLoadingUser,
        isLoadingAdmin,
        loginUser:    setUser,
        logoutUser,
        loginAdmin:   setAdmin,
        logoutAdmin,
        refreshUser,
        refreshAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ─── Consumer Hook ───────────────────────────────────────────────────────── */

/**
 * @description Returns the current authentication context.  Must be called
 *   inside a component that is a descendant of `<AuthProvider>`.
 *
 * @returns {AuthContextValue} The full auth state and action functions.
 * @throws {Error} If called outside of an `<AuthProvider>` tree.
 *
 * @example
 *   const { user, logoutUser } = useAuth();
 *   if (!user) return <Redirect to="/login" />;
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "useAuth() must be called inside an <AuthProvider>. " +
      "Ensure the component tree is wrapped with <AuthProvider> in App.tsx."
    );
  }
  return ctx;
}
