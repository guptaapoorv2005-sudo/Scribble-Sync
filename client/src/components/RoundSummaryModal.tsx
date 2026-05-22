import { useGame } from "../hooks/useGame";

export const RoundSummaryModal = () => {
  const { roundSummary, dismissRoundSummary } = useGame();

  if (!roundSummary) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-lg">
        <div className="text-lg font-semibold text-slate-900">Round ended</div>
        <p className="mt-2 text-sm text-slate-500">
          The word was <span className="font-semibold text-slate-900">{roundSummary.word}</span>.
        </p>
        <div className="mt-4 space-y-2">
          {roundSummary.leaderboard.slice(0, 3).map((entry) => (
            <div key={entry.playerId} className="flex justify-between text-sm">
              <span className="text-slate-900">{entry.name}</span>
              <span className="text-slate-500">{entry.score}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={dismissRoundSummary}
          className="mt-6 w-full rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
