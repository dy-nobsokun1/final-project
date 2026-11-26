// Who is signed in. The login token is kept ONLY in the phone's secure storage (expo-secure-store,
// the iOS Keychain), under "uniswap_token". On start we read it and ask the API who it belongs to.
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { ApiError, apiFetch } from "@/lib/api";
import type { User } from "@/types";

const TOKEN_KEY = "uniswap_token";

interface AuthState {
  token: string | null;
  user: User | null;
  /** True until the stored token has been checked, so screens do not flash "signed out". */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restore() {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!stored) return;
      try {
        const data = await apiFetch<{ user: User }>("/api/auth/me", { token: stored });
        setToken(stored);
        setUser(data.user);
      } catch (error) {
        // 401: the token is old (expired, or the password changed), so forget it.
        if (error instanceof ApiError && error.status === 401) await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    }
    restore().finally(() => setLoading(false));
  }, []);

  async function signIn(email: string, password: string) {
    const data = await apiFetch<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function signOut() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return <AuthContext value={{ token, user, loading, signIn, signOut }}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside <AuthProvider>.");
  return auth;
}
