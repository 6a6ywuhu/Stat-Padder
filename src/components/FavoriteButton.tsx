"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Star } from "@phosphor-icons/react";

export function FavoriteButton({ playerId, initialFavorited }: { playerId: string; initialFavorited: boolean }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (!session) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setPending(true);
    const next = !favorited;
    setFavorited(next); // optimistic
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) {
        setFavorited(!next); // revert
      }
    } catch {
      setFavorited(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      title={favorited ? "Remove from favorites" : "Add to favorites"}
      className={`btn-hero-chip cursor-pointer disabled:opacity-60 ${favorited ? "is-active" : ""}`}
    >
      <Star size={13} weight={favorited ? "fill" : "regular"} />
      {favorited ? "Favorited" : "Favorite"}
    </button>
  );
}
