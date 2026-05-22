import { Link, Outlet } from "react-router-dom";
import { useSocket } from "../hooks/useSocket";
import { useRoom } from "../hooks/useRoom";

export const AppShell = () => {
  const { status } = useSocket();
  const { playerName } = useRoom();

  const statusLabel =
    status === "connected"
      ? "Online"
      : status === "connecting"
        ? "Connecting"
        : "Offline";

  const statusColor =
    status === "connected" ? "bg-emerald-500" : "bg-amber-400";

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-semibold text-slate-900">
            Scribble Sync
          </Link>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            {playerName && <span>Player: {playerName}</span>}
            <span className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
              {statusLabel}
            </span>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
};
