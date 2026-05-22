import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CanvasBoard } from "../components/CanvasBoard";
import { CanvasToolbar } from "../components/CanvasToolbar";
import { ChatPanel } from "../components/ChatPanel";
import { PlayerScoreboard } from "../components/PlayerScoreboard";
import { NotificationStack } from "../components/NotificationStack";
import { WordPickerModal } from "../components/WordPickerModal";
import { RoundSummaryModal } from "../components/RoundSummaryModal";
import { GameOverModal } from "../components/GameOverModal";
import { useGame } from "../hooks/useGame";
import { useRoom } from "../hooks/useRoom";
import { useSocket } from "../hooks/useSocket";
import { formatTime } from "../utils/format";
import type { ToolType } from "../types/game";

export const GamePage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const {
    room,
    playerId,
    playerName,
    reconnectToRoom,
    drawerWord,
    suppressReconnect
  } = useRoom();
  const { socket } = useSocket();
  const {
    leaderboard,
    wordOptions,
    sendUndo,
    sendCanvasClear
  } = useGame();

  const [tool, setTool] = useState<ToolType>("pen");
  const [color, setColor] = useState("#0f172a");
  const [size, setSize] = useState(8);

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
    if (room?.phase === "lobby") {
      navigate(`/room/${room.roomCode}`);
    }
  }, [room, navigate]);

  useEffect(() => {
    if (!room) return;
    console.debug("[CLIENT][DRAW_STATE]", {
      socketId: socket?.id ?? null,
      playerId,
      currentDrawerId: room.currentDrawerId,
      phase: room.phase
    });
  }, [room?.currentDrawerId, room?.phase, socket?.id, playerId]);

  const drawer = useMemo(
    () => room?.players.find((player) => player.id === room.currentDrawerId),
    [room]
  );

  if (!room) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-10 text-slate-900">
        <h2 className="text-xl font-semibold">Loading game...</h2>
        <p className="text-sm text-slate-500">
          Waiting for the server to send game data.
        </p>
      </div>
    );
  }

  const isDrawer = room.currentDrawerId === playerId;
  const canDraw = room.phase === "drawing" && isDrawer;
  const wordDisplay = isDrawer
    ? drawerWord || "Selecting word..."
    : room.maskedWord || "_".repeat(Math.max(room.wordLength, 1));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <NotificationStack />
      <WordPickerModal isOpen={isDrawer && wordOptions.length > 0} />
      <RoundSummaryModal />
      <GameOverModal />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Room {room.roomCode}
          </div>
          <div className="text-2xl font-semibold text-slate-900">{room.name}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-stone-200 px-4 py-2 text-sm text-slate-900">
            Round {room.roundNumber} / {room.totalRounds || 0}
          </div>
          <div className="rounded-full border border-stone-200 px-4 py-2 text-sm text-slate-900">
            {drawer ? `Drawing: ${drawer.name}` : "Waiting for drawer"}
          </div>
          <div className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white">
            {formatTime(room.timeLeftSec)}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Word
            </div>
            <div className="mt-1 text-lg font-semibold tracking-[0.2em] text-slate-900">
              {wordDisplay}
            </div>
            {room.phase === "choosing" && !isDrawer && (
              <div className="mt-2 text-xs text-slate-500">
                Drawer is choosing a word.
              </div>
            )}
          </div>

          <CanvasToolbar
            tool={tool}
            color={color}
            size={size}
            canDraw={canDraw}
            onToolChange={setTool}
            onColorChange={setColor}
            onSizeChange={setSize}
            onUndo={sendUndo}
            onClear={sendCanvasClear}
          />

          <div className="aspect-[4/3]">
            <CanvasBoard tool={tool} color={color} size={size} canDraw={canDraw} />
          </div>
        </div>

        <div className="flex h-full min-h-0 flex-col gap-4">
          <PlayerScoreboard
            players={room.players}
            hostId={room.hostId}
            drawerId={room.currentDrawerId}
            leaderboard={leaderboard}
          />
          <div className="h-[420px] max-h-[420px] overflow-hidden">
            <ChatPanel isDrawer={isDrawer} />
          </div>
        </div>
      </div>
    </div>
  );
};
