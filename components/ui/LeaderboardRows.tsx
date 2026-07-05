import DinoSvg from "@/components/ui/DinoSvg";
import { avatarColorForUsername } from "@/lib/ui/avatar-color";
import { ui } from "@/lib/i18n/ui";

export type LeaderboardEntry = {
  username: string;
  bestScore: number;
};

type LeaderboardRowsProps = {
  entries: LeaderboardEntry[];
  currentUsername: string;
  activeSkinId?: string;
  limit?: number;
  rankOffset?: number;
};

export default function LeaderboardRows({
  entries,
  currentUsername,
  activeSkinId,
  limit,
  rankOffset = 0,
}: LeaderboardRowsProps) {
  const rows = limit ? entries.slice(0, limit) : entries;

  return (
    <>
      {rows.map((entry, index) => {
        const isCurrentUser = entry.username === currentUsername;
        const rank = rankOffset + index + 1;
        const avatarColor = avatarColorForUsername(entry.username, {
          isCurrentUser,
          activeSkinId,
        });

        return (
          <div
            key={`${entry.username}-${rank}`}
            className={`lb-row${isCurrentUser ? " lb-row-me" : ""}`}
          >
            <span className="lb-rank">{rank}</span>
            <span className="lb-avatar">
              <DinoSvg color={avatarColor} size={18} />
            </span>
            <span className="lb-name">
              {entry.username}
              {isCurrentUser ? ui.home.youSuffix : ""}
            </span>
            <span className="lb-score">{entry.bestScore}</span>
          </div>
        );
      })}
    </>
  );
}
