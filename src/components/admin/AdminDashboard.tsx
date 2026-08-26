"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Report = {
  id: string;
  type: "DATA_ISSUE" | "VOTE_SPIKE";
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  message: string;
  createdAt: string;
  player: { id: string; firstName: string; lastName: string } | null;
};

type AdminPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  teamId: string | null;
  status: "ACTIVE" | "RETIRED" | "INJURED";
};

type Team = { id: string; city: string; name: string };

export function AdminDashboard() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [playerQuery, setPlayerQuery] = useState("");
  const [playerResults, setPlayerResults] = useState<AdminPlayer[]>([]);
  const [editing, setEditing] = useState<AdminPlayer | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  async function loadReports() {
    const res = await fetch("/api/admin/reports");
    if (res.ok) setReports((await res.json()).reports);
    setLoadingReports(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    loadReports();
    fetch("/api/admin/teams")
      .then((r) => r.json())
      .then((d) => setTeams(d.teams ?? []));
  }, []);

  useEffect(() => {
    if (playerQuery.trim().length < 2) return;
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/admin/players?q=${encodeURIComponent(playerQuery)}`);
      if (res.ok) setPlayerResults((await res.json()).players);
    }, 250);
    return () => clearTimeout(handle);
  }, [playerQuery]);

  const visiblePlayerResults = playerQuery.trim().length < 2 ? [] : playerResults;

  async function updateReportStatus(id: string, status: Report["status"]) {
    await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadReports();
  }

  async function runSync() {
    setSyncing(true);
    setSyncStatus(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncStatus(
          `Synced ${data.teamsSynced} teams, ${data.playersSynced} players.` +
            (data.failedTeams?.length ? ` Failed: ${data.failedTeams.join(", ")}` : "")
        );
      } else {
        setSyncStatus(data.error ?? "Sync failed.");
      }
    } finally {
      setSyncing(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setSaveStatus("Saving…");
    const res = await fetch(`/api/admin/players/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: editing.firstName,
        lastName: editing.lastName,
        teamId: editing.teamId,
        status: editing.status,
      }),
    });
    setSaveStatus(res.ok ? "Saved." : "Save failed.");
  }

  async function logout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.refresh();
  }

  const openReports = reports.filter((r) => r.status === "OPEN");
  const closedReports = reports.filter((r) => r.status !== "OPEN");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-[var(--color-fg)]">Admin</h1>
        <button
          type="button"
          onClick={logout}
          className="cursor-pointer rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)]"
        >
          Sign out
        </button>
      </div>

      <section className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--color-fg)]">Data sync</h2>
            <p className="text-sm text-[var(--color-fg-muted)]">
              Pulls current teams and rosters from the live NHL API. Manual player edits below are
              overwritten by the next sync for any field the sync touches.
            </p>
          </div>
          <button
            type="button"
            onClick={runSync}
            disabled={syncing}
            className="shrink-0 cursor-pointer rounded-full bg-[var(--color-fg)] px-4 py-2 text-sm font-medium text-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
        {syncStatus && <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{syncStatus}</p>}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold text-[var(--color-fg)]">
          Reports {loadingReports ? "" : `(${openReports.length} open)`}
        </h2>
        <div className="mt-3 space-y-2">
          {!loadingReports && openReports.length === 0 && (
            <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-fg-muted)]">
              No open reports.
            </p>
          )}
          {openReports.map((r) => (
            <ReportRow key={r.id} report={r} onUpdate={updateReportStatus} />
          ))}
        </div>

        {closedReports.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-[var(--color-fg-muted)]">
              Resolved / dismissed ({closedReports.length})
            </summary>
            <div className="mt-2 space-y-2">
              {closedReports.map((r) => (
                <ReportRow key={r.id} report={r} onUpdate={updateReportStatus} />
              ))}
            </div>
          </details>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold text-[var(--color-fg)]">Edit player data</h2>
        <input
          type="text"
          value={playerQuery}
          onChange={(e) => setPlayerQuery(e.target.value)}
          placeholder="Search a player to fix…"
          className="mt-3 w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus-visible:border-[var(--color-ring)]"
        />
        {visiblePlayerResults.length > 0 && (
          <div className="mt-2 max-w-sm divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            {visiblePlayerResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setEditing(p);
                  setSaveStatus(null);
                }}
                className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-subtle)]"
              >
                <span>
                  {p.firstName} {p.lastName}
                </span>
                <span className="text-xs text-[var(--color-fg-faint)]">
                  {p.position} · {p.teamId ?? "—"}
                </span>
              </button>
            ))}
          </div>
        )}

        {editing && (
          <div className="mt-4 max-w-sm space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <Field label="First name">
              <input
                value={editing.firstName}
                onChange={(e) => setEditing({ ...editing, firstName: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm outline-none focus-visible:border-[var(--color-ring)]"
              />
            </Field>
            <Field label="Last name">
              <input
                value={editing.lastName}
                onChange={(e) => setEditing({ ...editing, lastName: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm outline-none focus-visible:border-[var(--color-ring)]"
              />
            </Field>
            <Field label="Team">
              <select
                value={editing.teamId ?? ""}
                onChange={(e) => setEditing({ ...editing, teamId: e.target.value || null })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm outline-none focus-visible:border-[var(--color-ring)]"
              >
                <option value="">Free agent</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.city} {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as AdminPlayer["status"] })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm outline-none focus-visible:border-[var(--color-ring)]"
              >
                <option value="ACTIVE">Active</option>
                <option value="INJURED">Injured</option>
                <option value="RETIRED">Retired</option>
              </select>
            </Field>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={saveEdit}
                className="cursor-pointer rounded-full bg-[var(--color-fg)] px-4 py-1.5 text-sm font-medium text-[var(--color-bg)]"
              >
                Save
              </button>
              {saveStatus && <span className="text-xs text-[var(--color-fg-muted)]">{saveStatus}</span>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-fg-muted)]">{label}</span>
      {children}
    </label>
  );
}

function ReportRow({ report, onUpdate }: { report: Report; onUpdate: (id: string, status: Report["status"]) => void }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-faint)]">
            {report.type === "VOTE_SPIKE" ? "Vote spike" : "Data issue"}
            {report.player && (
              <>
                {" · "}
                {report.player.firstName} {report.player.lastName}
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-[var(--color-fg)]">{report.message}</p>
          <p className="mt-1 text-xs text-[var(--color-fg-faint)]">
            {new Date(report.createdAt).toLocaleString()}
          </p>
        </div>
        {report.status === "OPEN" ? (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => onUpdate(report.id, "RESOLVED")}
              className="cursor-pointer rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-medium hover:bg-[var(--color-bg-subtle)]"
            >
              Resolve
            </button>
            <button
              type="button"
              onClick={() => onUpdate(report.id, "DISMISSED")}
              className="cursor-pointer rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-medium hover:bg-[var(--color-bg-subtle)]"
            >
              Dismiss
            </button>
          </div>
        ) : (
          <span className="shrink-0 rounded-full border border-[var(--color-border)] px-2 py-1 text-[10px] uppercase text-[var(--color-fg-faint)]">
            {report.status}
          </span>
        )}
      </div>
    </div>
  );
}
