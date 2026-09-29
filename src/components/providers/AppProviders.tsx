"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";

/**
 * Single place where client-side context is mounted.
 * Add further providers here rather than nesting them in individual routes.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

