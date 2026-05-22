import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../types/socket";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const resolveSocketUrl = (): string => {
  const envUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;
  if (envUrl && envUrl.length > 0) return envUrl;
  return "http://localhost:4000";
};

export const createSocket = (url: string): AppSocket =>
  io(url, {
    autoConnect: false,
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 6,
    reconnectionDelay: 800
  });
