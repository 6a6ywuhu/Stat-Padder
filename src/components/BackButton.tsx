"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

/** Returns to wherever the visitor came from (browser history), not a fixed route. */
export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
    >
      <ArrowLeft size={14} weight="bold" />
      Back
    </button>
  );
}
