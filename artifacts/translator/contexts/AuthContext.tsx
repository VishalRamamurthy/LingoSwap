import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const SESSION_KEY = "lingo-session-token";

export type UserProfile = {
  bio: string | null;
  preferredSourceLanguage: string | null;
  preferredTargetLanguage: string | null;
  translationCount: number;
  voiceTranslationCount: number;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
};

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: AuthUser; profile: UserProfile };

type AuthContextValue = {
  state: AuthState;
  signup: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (fields: {
    name?: string;
    bio?: string;
    preferredSourceLanguage?: string;
    preferredTargetLanguage?: string;
  }) => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// API helpers — direct fetch calls, not through the generated client,
// because auth endpoints need to capture the sessionToken from the response.
// ---------------------------------------------------------------------------

async function apiPost<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  const baseUrl = (globalThis as unknown as { __apiBaseUrl?: string }).__apiBaseUrl ?? "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.message ?? "Request failed", data.field);
  return data as T;
}

async function apiGet<T>(path: string, token?: string | null): Promise<T> {
  const baseUrl = (globalThis as unknown as { __apiBaseUrl?: string }).__apiBaseUrl ?? "";
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { headers, credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.message ?? "Request failed");
  return data as T;
}

async function apiPatch<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  const baseUrl = (globalThis as unknown as { __apiBaseUrl?: string }).__apiBaseUrl ?? "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.message ?? "Request failed", data.field);
  return data as T;
}

export class ApiError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const tokenRef = useRef<string | null>(null);

  // Wire the token getter so every API call through api-client-react also
  // carries the session token on mobile (picked up as Authorization: Bearer).
  useEffect(() => {
    setAuthTokenGetter(() => tokenRef.current);
    return () => setAuthTokenGetter(null);
  }, []);

  const setToken = useCallback(async (token: string | null) => {
    tokenRef.current = token;
    if (token) {
      await AsyncStorage.setItem(SESSION_KEY, token);
    } else {
      await AsyncStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const data = await apiGet<{ user: AuthUser; profile: UserProfile }>(
        "/api/auth/me",
        tokenRef.current,
      );
      setState({ status: "authenticated", user: data.user, profile: data.profile });
    } catch {
      setState({ status: "unauthenticated" });
      await setToken(null);
    }
  }, [setToken]);

  // On mount: restore stored token and validate it
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(SESSION_KEY);
      if (stored) {
        tokenRef.current = stored;
        await refreshProfile();
      } else {
        setState({ status: "unauthenticated" });
      }
    })();
  }, [refreshProfile]);

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const data = await apiPost<{ user: AuthUser; sessionToken: string }>(
        "/api/auth/signup",
        { name, email, password },
      );
      await setToken(data.sessionToken);
      // fetch full profile (includes profile row)
      const me = await apiGet<{ user: AuthUser; profile: UserProfile }>(
        "/api/auth/me",
        data.sessionToken,
      );
      setState({ status: "authenticated", user: me.user, profile: me.profile });
    },
    [setToken],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiPost<{ user: AuthUser; sessionToken: string }>(
        "/api/auth/login",
        { email, password },
      );
      await setToken(data.sessionToken);
      const me = await apiGet<{ user: AuthUser; profile: UserProfile }>(
        "/api/auth/me",
        data.sessionToken,
      );
      setState({ status: "authenticated", user: me.user, profile: me.profile });
    },
    [setToken],
  );

  const logout = useCallback(async () => {
    try {
      await apiPost("/api/auth/logout", {}, tokenRef.current);
    } catch {
      // ignore — clear locally regardless
    }
    await setToken(null);
    setState({ status: "unauthenticated" });
  }, [setToken]);

  const updateProfile = useCallback(
    async (fields: {
      name?: string;
      bio?: string;
      preferredSourceLanguage?: string;
      preferredTargetLanguage?: string;
    }) => {
      await apiPatch("/api/auth/profile", fields, tokenRef.current);
      await refreshProfile();
    },
    [refreshProfile],
  );

  return (
    <AuthContext.Provider value={{ state, signup, login, logout, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
