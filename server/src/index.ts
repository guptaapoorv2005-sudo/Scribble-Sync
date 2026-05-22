import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { env } from "./config/env";
import { httpErrorHandler } from "./handlers/httpErrorHandler";
import { RoomManager } from "./managers/RoomManager";
import { WordService } from "./services/WordService";
import { SocketHandler } from "./socket/SocketHandler";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
} from "./types/socket";

const app = express();

const corsOrigins = env.corsOrigins;
const allowAnyOrigin = corsOrigins === "*";

const originIsAllowed = (origin: string): boolean => {
  if (allowAnyOrigin) return true;

  return corsOrigins.some((allowedOrigin) => {
    if (allowedOrigin === origin) return true;

    if (!allowedOrigin.startsWith("https://*.") && !allowedOrigin.startsWith("http://*.")) {
      return false;
    }

    try {
      const allowedUrl = new URL(allowedOrigin.replace("*.", "placeholder."));
      const originUrl = new URL(origin);
      if (allowedUrl.protocol !== originUrl.protocol) return false;

      const allowedHost = allowedUrl.hostname.replace("placeholder.", "");
      return originUrl.hostname === allowedHost || originUrl.hostname.endsWith(`.${allowedHost}`);
    } catch {
      return false;
    }
  });
};

const corsOriginOption = allowAnyOrigin
  ? "*"
  : (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        callback(null, false);
        return;
      }

      callback(null, originIsAllowed(origin));
    };
app.use(
  cors({
    origin: corsOriginOption,
    credentials: !allowAnyOrigin
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(httpErrorHandler);

const httpServer = http.createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: corsOriginOption,
    methods: ["GET", "POST"],
    credentials: !allowAnyOrigin
  }
});

const wordService = new WordService();
const roomManager = new RoomManager(io, wordService);
const socketHandler = new SocketHandler(io, roomManager);

socketHandler.register();

httpServer.listen(env.port, () => {
  console.log(`Server listening on port ${env.port}`);
});
