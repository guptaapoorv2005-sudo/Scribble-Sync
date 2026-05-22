import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRoom } from "../hooks/useRoom";
import { RoomSettingsPanel } from "../components/RoomSettingsPanel";
import { PlayerScoreboard } from "../components/PlayerScoreboard";

export const LobbyPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const {
    room,
    playerId,
    playerName,
    reconnectToRoom,
    leaveRoom,
    startGame,
    suppressReconnect
  } = useRoom();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    if (!playerName.trim()) {
      navigate("/");
      return;
    }
    if (suppressReconnect) return;
    if (!room || room.roomCode !== roomId.toUpperCase()) {
      reconnectToRoom(roomId);
    }
  }, [roomId, room, playerName, reconnectToRoom, navigate, suppressReconnect]);

  useEffect(() => {
    if (room?.phase === "drawing" || room?.phase === "choosing") {
      navigate(`/game/${room.roomCode}`);
    }
  }, [room, navigate]);

  if (!room) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-10 text-slate-900">
        <h2 className="text-xl font-semibold">Joining room...</h2>
        <p className="text-sm text-slate-500">
          Waiting for the server to send room data.
        </p>
      </div>
    );
  }

  const isHost = room.hostId === playerId;
  const connectedCount = room.players.filter((player) => player.isConnected).length;
  const canStart = isHost && connectedCount >= 2;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleLeave = () => {
    leaveRoom(room.roomCode);
    navigate("/");
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {room.name}
          </h2>
          <p className="text-sm text-slate-500">
            Room code: <span className="font-semibold">{room.roomCode}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-xl border border-stone-200 px-4 py-2 text-sm text-slate-900"
          >
            {copied ? "Copied" : "Copy code"}
          </button>
          <button
            type="button"
            onClick={handleLeave}
            className="rounded-xl border border-stone-200 px-4 py-2 text-sm text-slate-500"
          >
            Leave
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <RoomSettingsPanel settings={room.settings} />
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Start the game</div>
            <p className="mt-2 text-sm text-slate-500">
              {canStart
                ? "Everyone is ready. Start when you are."
                : isHost
                  ? "Waiting for at least 2 players to connect."
                  : "Waiting for the host to start the game."}
            </p>
            {isHost && (
              <button
                type="button"
                onClick={startGame}
                disabled={!canStart}
                className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start game
              </button>
            )}
          </div>
        </div>

        <PlayerScoreboard
          players={room.players}
          hostId={room.hostId}
          drawerId={room.currentDrawerId}
          leaderboard={[]}
        />
      </div>
    </div>
  );
};
