import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRoom } from "../hooks/useRoom";

const featureHighlights = [
  "Real-time drawing",
  "Multiplayer rooms",
  "Live guessing",
  "Fast matchmaking"
];

export const HomePage = () => {
  const {
    room,
    playerName,
    setPlayerName,
    createRoom,
    joinRoom,
    quickPlay,
    socketError,
    socketErrorCode,
    clearSocketError
  } = useRoom();
  const navigate = useNavigate();

  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomVisibility, setRoomVisibility] = useState<"private" | "public">("private");
  const [activeModal, setActiveModal] = useState<"join" | "create" | null>(null);
  const [noPublicRoomsOpen, setNoPublicRoomsOpen] = useState(false);

  useEffect(() => {
    if (room?.roomCode) {
      navigate(`/room/${room.roomCode}`);
    }
  }, [room, navigate]);

  useEffect(() => {
    if (socketErrorCode === "NO_PUBLIC_ROOM_AVAILABLE") {
      setNoPublicRoomsOpen(true);
    }
  }, [socketErrorCode]);

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!playerName.trim()) return;
    createRoom({
      name: roomName.trim() || "New Room",
      isPublic: roomVisibility === "public"
    });
    setActiveModal(null);
  };

  const handleJoin = (event: React.FormEvent) => {
    event.preventDefault();
    if (!playerName.trim()) return;
    if (!joinCode.trim()) return;
    joinRoom({ roomCode: joinCode });
    setActiveModal(null);
  };

  const handleQuickPlay = () => {
    if (!playerName.trim()) return;
    quickPlay();
  };

  const openCreateRoom = () => {
    clearSocketError();
    setNoPublicRoomsOpen(false);
    setRoomVisibility("private");
    setActiveModal("create");
  };

  const closeNoPublicRooms = () => {
    clearSocketError();
    setNoPublicRoomsOpen(false);
  };

  return (
    <main className="min-h-[calc(100vh-4.5rem)] px-6 py-10 lg:py-14">
      <div className="mx-auto w-full max-w-7xl">
        {socketError && socketErrorCode !== "NO_PUBLIC_ROOM_AVAILABLE" && (
          <div className="mb-8 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
            {socketError}
            <button
              type="button"
              onClick={clearSocketError}
              className="ml-3 text-xs text-rose-500 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex flex-col gap-12 lg:min-h-[calc(100vh-11rem)] lg:flex-row lg:items-center lg:gap-16">
          <section className="flex w-full max-w-2xl flex-col items-center text-center lg:items-start lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              Scribble Sync
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Draw together, <span className="text-orange-500">guess faster</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-500 sm:text-lg">
              Jump into a room, swap roles, and race the clock in a small multiplayer drawing game made for quick rounds with friends.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              {featureHighlights.map((feature) => (
                <span
                  key={feature}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  {feature}
                </span>
              ))}
            </div>
          </section>

          <section className="flex w-full justify-center lg:w-105 lg:shrink-0 lg:justify-end">
            <div className="w-full rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Player name
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  placeholder="Player name"
                  className="w-full max-w-xs rounded-xl border border-stone-200 bg-transparent px-3 py-2 text-center text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
                />

                <div className="flex w-full max-w-xs flex-col items-stretch gap-3">
                  <button
                    type="button"
                    onClick={handleQuickPlay}
                    className="w-full rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal("join")}
                    className="w-full rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-stone-50"
                  >
                    Join room
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRoomVisibility("private");
                      setActiveModal("create");
                    }}
                    className="w-full rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-stone-50"
                  >
                    Create room
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

      {activeModal === "join" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-lg">
            <div className="text-lg font-semibold text-slate-900">Join room</div>
            <form onSubmit={handleJoin} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Room code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="ABCD"
                  className="mt-2 w-full rounded-xl border border-stone-200 bg-transparent px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-sm text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === "create" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-lg">
            <div className="text-lg font-semibold text-slate-900">Create room</div>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Room name
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  placeholder="The cozy lobby"
                  className="mt-2 w-full rounded-xl border border-stone-200 bg-transparent px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Visibility
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${
                    roomVisibility === "private"
                      ? "border-orange-400 bg-orange-50 text-orange-700"
                      : "border-stone-200 text-slate-600"
                  }`}>
                    <input
                      type="radio"
                      name="room-visibility"
                      className="sr-only"
                      checked={roomVisibility === "private"}
                      onChange={() => setRoomVisibility("private")}
                    />
                    Private
                  </label>
                  <label className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${
                    roomVisibility === "public"
                      ? "border-orange-400 bg-orange-50 text-orange-700"
                      : "border-stone-200 text-slate-600"
                  }`}>
                    <input
                      type="radio"
                      name="room-visibility"
                      className="sr-only"
                      checked={roomVisibility === "public"}
                      onChange={() => setRoomVisibility("public")}
                    />
                    Public
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-sm text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Create room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {noPublicRoomsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-slate-900">No Public Rooms</div>
                <p className="mt-2 text-sm text-slate-500">
                  There are no public rooms available right now.
                </p>
              </div>
              <button
                type="button"
                onClick={closeNoPublicRooms}
                className="rounded-lg border border-stone-200 px-2 py-1 text-xs text-slate-500 hover:bg-stone-50"
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeNoPublicRooms}
                className="rounded-xl border border-stone-200 px-4 py-2 text-sm text-slate-600"
              >
                Close
              </button>
              <button
                type="button"
                onClick={openCreateRoom}
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Create Room
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
  );
};
