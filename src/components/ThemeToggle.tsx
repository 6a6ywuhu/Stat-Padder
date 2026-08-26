"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "@phosphor-icons/react";
import { useHasMounted } from "@/lib/use-has-mounted";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  if (!mounted) {
    return <div className="h-9 w-9" aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-subtle)]"
    >
      {isDark ? <Sun size={18} weight="bold" /> : <Moon size={18} weight="bold" />}
    </button>
  );
}
