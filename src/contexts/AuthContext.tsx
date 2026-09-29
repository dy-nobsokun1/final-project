"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CURRENT_USER_ID, mockUsers } from "@/lib/mock/data";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Mock auth session backed by in-memory state.
 *
 * There is no real credential check here on purpose: no password is stored,
 * compared, or logged. When a backend arrives, replace the body of `signIn`
 * with a fetch call and keep this interface stable so the UI does not change.
 * Never put API keys or secrets in this file.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const signIn = useCallback(async (email: string) => {
    setIsLoading(true);
    try {
      const match =
        mockUsers.find((candidate) => candidate.email === email) ??
        mockUsers.find((candidate) => candidate.id === CURRENT_USER_ID);
      if (match) setUser(match);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(() => setUser(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      signIn,
      signOut,
    }),
    [user, isLoading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}

