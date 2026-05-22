import type { LeaderboardEntry, PlayerPublic } from "../types/room";

interface LeaderboardProps {
  leaderboard: LeaderboardEntry[];
  players: PlayerPublic[];
}

export const Leaderboard = ({ leaderboard, players }: LeaderboardProps) => {
  const guessedMap = new Map(
    players.map((player) => [player.id, player.hasGuessedCorrectly])
  );
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-slate-900">Leaderboard</div>
      <div className="space-y-2 text-sm">
        {leaderboard.length === 0 && (
          <div className="text-xs text-slate-500">
            Scores will appear here after the first guesses.
          </div>
        )}
        {leaderboard.map((entry) => {
          const guessed = guessedMap.get(entry.playerId);
          const guessedStyle = guessed
            ? "border-emerald-200 bg-emerald-50"
            : "border-transparent";
          return (
          <div
            key={entry.playerId}
            className={`flex items-center justify-between rounded-xl border px-2 py-2 transition ${guessedStyle} hover:border-stone-200`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">#{entry.rank}</span>
              <span className="text-slate-900">{entry.name}</span>
            </div>
            <span className="text-xs text-slate-500">{entry.score}</span>
          </div>
        );
        })}
      </div>
    </div>
  );
};
