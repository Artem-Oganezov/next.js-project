"use client";

import { useCallback, useEffect, useState } from "react";
import { formatAntiCheatReason } from "@/lib/security/anti-cheat-labels";

type Submission = {
  id: string;
  userId: string;
  username: string;
  score: number;
  reason: string;
  elapsedMs: number | null;
  createdAt: string;
};

export default function AdminPage() {
  const [secretInput, setSecretInput] = useState("");
  const [activeSecret, setActiveSecret] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const adminFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!activeSecret) {
        throw new Error("Admin secret is not set");
      }
      const response = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Secret": activeSecret,
          ...init?.headers,
        },
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? `HTTP ${response.status}`);
      }
      return response;
    },
    [activeSecret],
  );

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminFetch("/api/admin/submissions?limit=50");
      const data = (await response.json()) as { submissions: Submission[] };
      setSubmissions(data.submissions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    if (activeSecret) {
      void loadSubmissions();
    }
  }, [activeSecret, loadSubmissions]);

  const handleUnlockSecret = () => {
    if (secretInput.length < 32) {
      setError("Secret must be at least 32 characters");
      return;
    }
    setActiveSecret(secretInput);
    setError(null);
  };

  const handleLogout = () => {
    setActiveSecret(null);
    setSubmissions([]);
    setSecretInput("");
  };

  const handleBan = async (userId: string, username: string) => {
    setActionMessage(null);
    setError(null);
    try {
      await adminFetch(`/api/admin/users/${userId}/ban`, {
        method: "POST",
        body: JSON.stringify({ reason: "admin-panel" }),
      });
      setActionMessage(`User ${username} banned`);
      await loadSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ban user");
    }
  };

  if (!activeSecret) {
    return (
      <main className="mx-auto max-w-md p-6 space-y-4">
        <h1 className="text-xl font-bold text-[#535353]">Admin</h1>
        <p className="text-sm text-[#737373]">
          Enter <code className="text-xs">ADMIN_SECRET</code> from the server environment.
          The secret stays in memory only for this tab session.
        </p>
        <label className="flex flex-col gap-1 text-sm text-[#535353]">
          Admin secret
          <input
            type="password"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            data-testid="admin-secret-input"
            className="px-3 py-2 border border-[#d0d0d0] rounded-sm"
          />
        </label>
        <button
          type="button"
          onClick={handleUnlockSecret}
          data-testid="admin-unlock-btn"
          className="px-4 py-2 bg-[#535353] text-white rounded-sm text-sm"
        >
          Unlock
        </button>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-[#535353]">Suspicious submissions</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadSubmissions()}
            data-testid="admin-refresh-btn"
            className="px-3 py-1 text-sm border border-[#d0d0d0] rounded-sm"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1 text-sm border border-[#d0d0d0] rounded-sm"
          >
            Log out
          </button>
        </div>
      </header>

      {loading && <p className="text-sm text-[#737373]">Loading…</p>}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {actionMessage && <p className="text-sm text-green-700">{actionMessage}</p>}

      <div className="overflow-x-auto border border-[#d0d0d0] rounded-sm">
        <table className="w-full text-sm" data-testid="admin-submissions-table">
          <thead className="bg-[#f0f0f0] text-left">
            <tr>
              <th className="p-2">Time</th>
              <th className="p-2">User</th>
              <th className="p-2">Score</th>
              <th className="p-2">Reason</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {submissions.map((entry) => (
              <tr key={entry.id} className="border-t border-[#e8e8e8]">
                <td className="p-2 whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="p-2">{entry.username}</td>
                <td className="p-2">{entry.score}</td>
                <td className="p-2 max-w-xs truncate" title={entry.reason}>
                  {formatAntiCheatReason(entry.reason)}
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => void handleBan(entry.userId, entry.username)}
                    data-testid={`ban-${entry.userId}`}
                    className="text-red-600 hover:underline"
                  >
                    Ban
                  </button>
                </td>
              </tr>
            ))}
            {!loading && submissions.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-[#737373]">
                  No entries
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
