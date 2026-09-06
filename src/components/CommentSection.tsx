"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";

export type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  author: string;
  authorImage: string | null;
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function CommentSection({ playerId, initialComments }: { playerId: string; initialComments: CommentItem[] }) {
  const { data: session } = useSession();
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't post that comment.");
        return;
      }
      setComments((prev) => [data, ...prev]);
      setBody("");
    } catch {
      setError("Network error — comment not posted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {session ? (
        <form onSubmit={submit} className="mb-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share a thought about this player…"
            rows={2}
            maxLength={500}
            className="w-full resize-none rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus-visible:border-[var(--color-accent)]"
          />
          <div className="mt-1.5 flex items-center justify-between">
            {error ? (
              <p className="text-xs text-[var(--color-negative)]">{error}</p>
            ) : (
              <span className="text-xs text-[var(--color-fg-faint)]">{body.length}/500</span>
            )}
            <button
              type="submit"
              disabled={pending || !body.trim()}
              className="btn-pixel cursor-pointer rounded-md border-[var(--color-accent)] bg-[var(--color-accent)] px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wide text-[var(--color-accent-fg)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Posting…" : "Post"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mb-4 text-sm text-[var(--color-fg-muted)]">
          <Link href="/login" className="font-medium text-[var(--color-fg)] underline-offset-2 hover:underline">
            Sign in
          </Link>{" "}
          to leave a comment.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-faint)]">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border-2 border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
                {c.authorImage && <Image src={c.authorImage} alt="" fill unoptimized className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-[var(--color-fg)]">{c.author}</span>
                  <span className="text-xs text-[var(--color-fg-faint)]">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-sm text-[var(--color-fg-muted)] whitespace-pre-wrap break-words">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
