export const formatTime = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds)) return "--:--";
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};
