import type { LeaderboardEntry, PlayerPublic } from "../types/room";

interface PlayerScoreboardProps {
  players: PlayerPublic[];
  leaderboard: LeaderboardEntry[];
  hostId: string;
  drawerId: string | null;
}

export const PlayerScoreboard = ({
  players,
  leaderboard,
  hostId,
  drawerId
}: PlayerScoreboardProps) => {
  const leaderboardMap = new Map(
    leaderboard.map((entry) => [entry.playerId, entry])
  );

  const orderedPlayers = leaderboard.length
    ? [
        ...leaderboard
          .map((entry) => players.find((player) => player.id === entry.playerId))
          .filter((player): player is PlayerPublic => Boolean(player)),
        ...players.filter((player) => !leaderboardMap.has(player.id))
      ]
    : players;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">
          Players & Scores
        </div>
        <div className="text-xs text-slate-500">{players.length}</div>
      </div>
      <div className="space-y-2 text-sm">
        {orderedPlayers.length === 0 && (
          <div className="text-xs text-slate-500">No players yet.</div>
        )}
        {orderedPlayers.map((player) => {
          const entry = leaderboardMap.get(player.id);
          const score = entry?.score ?? player.score;
          const guessedStyle = player.hasGuessedCorrectly
            ? "border-emerald-200 bg-emerald-50"
            : "border-transparent";
          return (
            <div
              key={player.id}
              className={`flex items-center justify-between rounded-xl border px-2 py-2 transition ${guessedStyle} hover:border-stone-200`}
            >
              <div className="flex items-center gap-2">
                {entry ? (
                  <span className="text-xs text-slate-500">#{entry.rank}</span>
                ) : (
                  <span className="text-xs text-slate-400">--</span>
                )}
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    player.isConnected ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
                <div className="flex flex-col">
                  <span className="text-slate-900">
                    {player.name}
                    {player.id === hostId ? " (host)" : ""}
                    {player.id === drawerId ? " (drawing)" : ""}
                  </span>
                  {!player.isConnected && (
                    <span className="text-xs text-slate-500">
                      Reconnecting...
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-slate-500">{score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
