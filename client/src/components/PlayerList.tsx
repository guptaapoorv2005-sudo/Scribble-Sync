import type { LeaderboardEntry, PlayerPublic } from "../types/room";

interface PlayerListProps {
  players: PlayerPublic[];
  hostId: string;
  drawerId: string | null;
  leaderboard: LeaderboardEntry[];
}

export const PlayerList = ({
  players,
  hostId,
  drawerId,
  leaderboard
}: PlayerListProps) => {
  const scoreMap = new Map(
    leaderboard.map((entry) => [entry.playerId, entry.score])
  );

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Players</div>
        <div className="text-xs text-slate-500">{players.length}</div>
      </div>
      <div className="space-y-2 text-sm">
        {players.map((player) => {
          const score = scoreMap.get(player.id) ?? player.score;
          const guessedStyle = player.hasGuessedCorrectly
            ? "border-emerald-200 bg-emerald-50"
            : "border-transparent";
          return (
            <div
              key={player.id}
              className={`flex items-center justify-between rounded-xl border px-2 py-2 transition ${guessedStyle} hover:border-stone-200`}
            >
              <div className="flex items-center gap-2">
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
