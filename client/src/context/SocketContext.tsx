import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { ReactNode } from "react";
import { createSocket, resolveSocketUrl, type AppSocket } from "../socket/socket";

export type SocketStatus = "idle" | "connecting" | "connected" | "disconnected";

interface SocketContextValue {
  socket: AppSocket | null;
  status: SocketStatus;
  lastError: string | null;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [status, setStatus] = useState<SocketStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const url = resolveSocketUrl();
    const nextSocket = createSocket(url);

    setSocket(nextSocket);
    setStatus("connecting");
    nextSocket.connect();

    const handleConnect = () => {
      setStatus("connected");
      setLastError(null);
      console.debug("[CLIENT][SOCKET] connected", { socketId: nextSocket.id });
    };

    const handleDisconnect = () => {
      setStatus("disconnected");
      console.debug("[CLIENT][SOCKET] disconnected");
    };

    const handleError = (error: Error) => {
      setLastError(error.message);
      setStatus("disconnected");
      console.debug("[CLIENT][SOCKET] connect_error", { message: error.message });
    };

    nextSocket.on("connect", handleConnect);
    nextSocket.on("disconnect", handleDisconnect);
    nextSocket.on("connect_error", handleError);

    return () => {
      nextSocket.off("connect", handleConnect);
      nextSocket.off("disconnect", handleDisconnect);
      nextSocket.off("connect_error", handleError);
      nextSocket.disconnect();
    };
  }, []);

  const value = useMemo(
    () => ({
      socket,
      status,
      lastError
    }),
    [socket, status, lastError]
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

export const useSocketContext = (): SocketContextValue => {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("SocketContext is not available");
  }
  return ctx;
};
