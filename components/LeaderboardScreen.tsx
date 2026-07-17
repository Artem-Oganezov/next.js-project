"use client";

import LeaderboardRows from "@/components/ui/LeaderboardRows";
import EmptyState from "@/components/ui/EmptyState";
import PanelSkeleton from "@/components/ui/PanelSkeleton";
import { SKINS } from "@/game";
import { useLeaderboardQuery, useRankQuery } from "@/lib/client/hooks";
import { ui } from "@/lib/i18n/ui";

type LeaderboardScreenProps = {
  username: string;
  bestScore: number;
  activeSkinId?: string;
  onBack: () => void;
};

export default function LeaderboardScreen({
  username,
  bestScore,
  activeSkinId,
  onBack,
}: LeaderboardScreenProps) {
  const { data: leaderboard = [], isLoading, isError } = useLeaderboardQuery();

  const { data: rankData } = useRankQuery(!isLoading && !isError);

  const userInTop = leaderboard.some((entry) => entry.username === username);
  const userRank = rankData?.rank ?? null;

  return (
    <div className="screen-content">
      <div className="page-header">
        <h2>{ui.leaderboard.title}</h2>
        <button type="button" className="back-link" onClick={onBack}>
          {ui.common.back}
        </button>
      </div>

      {isLoading && <PanelSkeleton rows={6} />}
      {isError && <p className="status-muted">{ui.leaderboard.loadFailed}</p>}

      {!isLoading && !isError && leaderboard.length === 0 && (
        <div className="panel">
          <EmptyState
            message={ui.leaderboard.empty}
            dinoColor={
              SKINS.find((s) => s.id === activeSkinId)?.color ?? SKINS[0]?.color
            }
          />
        </div>
      )}

      {!isLoading && !isError && leaderboard.length > 0 && (
        <>
          <div className="panel">
            <LeaderboardRows
              entries={leaderboard}
              currentUsername={username}
              activeSkinId={activeSkinId}
            />
          </div>

          {!userInTop && userRank !== null && (
            <>
              <p className="divider-label">{ui.leaderboard.yourPosition}</p>
              <div className="panel">
                <LeaderboardRows
                  entries={[{ username, bestScore }]}
                  currentUsername={username}
                  activeSkinId={activeSkinId}
                  rankOffset={userRank - 1}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
