"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import type { User } from "@/types";

/**
 * Single place where client-side context is mounted.
 * Add further providers here rather than nesting them in individual routes.
 */
export function AppProviders({
  initialUser,
  children,
}: {
  initialUser: User | null;
  children: ReactNode;
}) {
  return <AuthProvider initialUser={initialUser}>{children}</AuthProvider>;
}
