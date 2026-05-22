import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../types/socket";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const LOCAL_SOCKET_URL = "http://localhost:4000";

export const resolveSocketUrl = (): string => {
  const envUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;
  if (envUrl && envUrl.trim().length > 0) return envUrl.trim();

  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return LOCAL_SOCKET_URL;
    }
  }

  throw new Error("VITE_SOCKET_URL is required in production");
};

export const createSocket = (url: string): AppSocket =>
  io(url, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
  });
