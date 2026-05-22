import { useEffect, useRef, useState, type FormEvent } from "react";
import { useGame } from "../hooks/useGame";
import { useRoom } from "../hooks/useRoom";

interface ChatPanelProps {
  isDrawer: boolean;
}

export const ChatPanel = ({ isDrawer }: ChatPanelProps) => {
  const {
    chatMessages,
    sendChat,
    sendGuess,
    guessFeedback,
    hasGuessedCorrectly
  } = useGame();
  const { room, playerId } = useRoom();
  const [message, setMessage] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScroll = useRef(true);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (!shouldAutoScroll.current) return;
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [chatMessages]);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    const threshold = 80;
    const distance = list.scrollHeight - list.scrollTop - list.clientHeight;
    shouldAutoScroll.current = distance <= threshold;
  };

  const isGuessMode =
    room?.phase === "drawing" && !isDrawer && !hasGuessedCorrectly;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    if (isDrawer) return;
    if (isGuessMode) {
      sendGuess(trimmed);
    } else {
      sendChat(trimmed);
    }
    setMessage("");
  };

  const placeholder = isDrawer
    ? "You are drawing"
    : isGuessMode
      ? "Type your guess"
      : "Type a message";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 px-4 py-3">
        <div className="text-sm font-semibold text-slate-900">Chat</div>
        <div className="text-xs text-slate-500">
          {room?.phase === "drawing" ? "Guesses go here" : "Waiting for round"}
        </div>
      </div>
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 space-y-2 overflow-y-auto px-4 py-3 text-sm"
      >
        {chatMessages.map((msg) => {
          const isSelf = msg.playerId && msg.playerId === playerId;
          const systemStyle = msg.variant === "join"
            ? "bg-emerald-50 text-emerald-700"
            : msg.variant === "leave"
              ? "bg-rose-50 text-rose-700"
              : msg.variant === "correct_guess"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-stone-50 text-slate-500";
          const chatStyle = msg.variant === "guess"
            ? "text-slate-900"
            : "text-slate-900";
          return (
            <div
              key={msg.id}
              className={
                msg.isSystem
                  ? `rounded-lg px-3 py-2 text-xs ${systemStyle}`
                  : "flex flex-col"
              }
            >
              {msg.isSystem ? (
                <span>{msg.message}</span>
              ) : (
                <>
                  <span className="text-xs text-slate-500">
                    {msg.name}
                    {isSelf ? " (you)" : ""}
                  </span>
                  <span className={chatStyle}>{msg.message}</span>
                </>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} className="h-px" />
      </div>
      {guessFeedback && (
        <div className="border-t border-stone-200 px-4 py-2 text-xs text-slate-500">
          {guessFeedback.correct
            ? `Correct! +${guessFeedback.pointsAwarded ?? 0} points`
            : guessFeedback.alreadyGuessed
              ? "You already guessed correctly"
              : "Not quite"}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="border-t border-stone-200 p-3"
      >
        <input
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={placeholder}
          disabled={isDrawer}
          className="w-full rounded-xl border border-stone-200 bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </form>
    </div>
  );
};
