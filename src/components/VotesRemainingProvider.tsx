"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type VotesRemainingState = {
  used: number;
  remaining: number;
  limit: number;
  resetAt: string | null;
};

type VotesRemainingContextValue = {
  status: VotesRemainingState | null;
  /** Optimistically apply the result of a vote the caller just made. */
  applyVoteResult: (remaining: number, limit: number) => void;
  refresh: () => void;
};

const VotesRemainingContext = createContext<VotesRemainingContextValue | null>(null);

export function VotesRemainingProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<VotesRemainingState | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/votes/remaining")
      .then((r) => r.json())
      .then((data: VotesRemainingState) => setStatus(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const applyVoteResult = useCallback((remaining: number, limit: number) => {
    setStatus((prev) => ({
      used: limit - remaining,
      remaining,
      limit,
      resetAt: prev?.resetAt ?? null,
    }));
  }, []);

  return (
    <VotesRemainingContext.Provider value={{ status, applyVoteResult, refresh }}>
      {children}
    </VotesRemainingContext.Provider>
  );
}

export function useVotesRemaining() {
  const ctx = useContext(VotesRemainingContext);
  if (!ctx) throw new Error("useVotesRemaining must be used within VotesRemainingProvider");
  return ctx;
}
