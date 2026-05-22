import { useGame } from "../hooks/useGame";
import { useRoom } from "../hooks/useRoom";

export const GameOverModal = () => {
  const { gameOver } = useGame();
  const { returnToLobby, room } = useRoom();

  if (!gameOver) return null;

  const winner = gameOver.leaderboard.find(
    (entry) => entry.playerId === gameOver.winnerId
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-lg">
        <div className="text-lg font-semibold text-slate-900">Game over</div>
        <p className="mt-2 text-sm text-slate-500">
          {winner ? `${winner.name} wins the game!` : "Thanks for playing."}
        </p>
        <div className="mt-4 space-y-2">
          {gameOver.leaderboard.map((entry) => (
            <div key={entry.playerId} className="flex justify-between text-sm">
              <span className="text-slate-900">#{entry.rank} {entry.name}</span>
              <span className="text-slate-500">{entry.score}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => returnToLobby(room?.roomCode)}
          className="mt-6 w-full rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
