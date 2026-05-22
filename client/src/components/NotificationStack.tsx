import { useGame } from "../hooks/useGame";

export const NotificationStack = () => {
  const { notifications } = useGame();

  if (notifications.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-50 space-y-2">
      {notifications.map((note) => (
        <div
          key={note.id}
          className={`rounded-xl px-4 py-2 text-sm shadow-lg ${
            note.tone === "success"
              ? "bg-emerald-500 text-white"
              : note.tone === "danger"
                ? "bg-rose-500 text-white"
                : "bg-white text-slate-900"
          }`}
        >
          {note.message}
        </div>
      ))}
    </div>
  );
};
