"use client";

import { SessionProvider } from "next-auth/react";

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  // Votes are anonymous; the session only drives the account menu and the
  // favourite button. Default SessionProvider polls `/api/auth/session` on
  // an interval and on every window focus — on a serverless + Neon setup
  // each of those is an uncached function hit, and a burst of them on page
  // load starves hydration so the vote buttons don't respond to the first
  // clicks. One fetch on mount is enough.
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      {children}
    </SessionProvider>
  );
}
