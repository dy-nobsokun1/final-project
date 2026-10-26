"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { clearAssistantHistory } from "@/hooks/use-assistant-history";
import { signIn as signInAction, signOut as signOutAction } from "@/lib/api/actions";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Resolves to `{}` once signed in, or to the error to show. */
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  /** Replaces the signed-in user, e.g. after registering or editing the profile. */
  setUser: (user: User | null) => void;
}

/** `needsVerification`: the password was right, but the account's email is not verified yet. */
export interface SignInResult {
  error?: string;
  needsVerification?: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Tells client components (navbar, settings) who is signed in.
 *
 * The real session is an httpOnly cookie holding the API's token. The root layout reads it on
 * the server and passes the user in as `initialUser`. Signing in and out go through Server
 * Actions, which set or clear that cookie. No token or password is kept in client state.
 */
export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: User | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(initialUser);
  const [isLoading, setIsLoading] = useState(false);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await signInAction(email, password);
      if (result.user) setUser(result.user);
      return { error: result.error, needsVerification: result.needsVerification };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    clearAssistantHistory();
    await signOutAction();
    setUser(null);
    router.push("/");
    router.refresh();
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      signIn,
      signOut,
      setUser,
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
