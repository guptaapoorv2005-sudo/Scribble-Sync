import { useGame } from "../hooks/useGame";

interface WordPickerModalProps {
  isOpen: boolean;
}

export const WordPickerModal = ({ isOpen }: WordPickerModalProps) => {
  const { wordOptions, selectWord } = useGame();

  if (!isOpen || wordOptions.length === 0) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-lg">
        <div className="text-lg font-semibold text-slate-900">
          Choose a word
        </div>
        <p className="mt-1 text-sm text-slate-500">
          You are drawing this round. Pick quickly.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {wordOptions.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => selectWord(word)}
              className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-slate-900 hover:border-orange-400"
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
