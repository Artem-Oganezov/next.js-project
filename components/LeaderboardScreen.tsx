"use client";

import { useEffect, useState } from "react";

type LeaderboardEntry = {
  username: string;
  bestScore: number;
};

type LeaderboardScreenProps = {
  username: string;
  onBack: () => void;
};

export default function LeaderboardScreen({
  username,
  onBack,
}: LeaderboardScreenProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setLoading(true);
      setError(false);

      try {
        const response = await fetch("/api/leaderboard");
        if (!response.ok) throw new Error("Failed to load leaderboard");

        const data = (await response.json()) as {
          leaderboard: LeaderboardEntry[];
        };
        if (!cancelled) {
          setLeaderboard(data.leaderboard);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      <header className="w-full flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 text-sm border border-[#d0d0d0] rounded-sm text-[#535353] hover:bg-[#f0f0f0] transition-colors"
        >
          Назад
        </button>
        <h1 className="text-lg font-medium text-[#535353]">Рейтинг</h1>
        <span className="w-[60px]" aria-hidden />
      </header>

      <div className="w-full">
        {loading && <p className="text-sm text-[#737373] text-center">Загрузка...</p>}
        {error && (
          <p className="text-sm text-[#737373] text-center">
            Не удалось загрузить рейтинг
          </p>
        )}
        {!loading && !error && leaderboard.length === 0 && (
          <p className="text-sm text-[#737373] text-center">Пока нет результатов</p>
        )}
        {!loading && !error && leaderboard.length > 0 && (
          <ul className="w-full space-y-1">
            {leaderboard.map((entry, index) => {
              const isCurrentUser = entry.username === username;

              return (
                <li
                  key={entry.username}
                  className={`flex items-center justify-between text-sm px-3 py-2 rounded-sm ${
                    isCurrentUser
                      ? "bg-[#e8e8e8] text-[#535353] font-medium"
                      : "text-[#737373]"
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-6 shrink-0 text-right font-medium">
                      {index + 1}
                    </span>
                    <span className="truncate">{entry.username}</span>
                  </span>
                  <span className="shrink-0 ml-2">{entry.bestScore}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
