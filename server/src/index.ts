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
app.use(
  cors({
    origin: allowAnyOrigin ? "*" : corsOrigins,
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
    origin: allowAnyOrigin ? "*" : corsOrigins,
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
