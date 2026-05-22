import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { SocketProvider } from "./context/SocketContext";
import { RoomProvider } from "./context/RoomContext";
import { GameProvider } from "./context/GameContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SocketProvider>
      <RoomProvider>
        <GameProvider>
          <App />
        </GameProvider>
      </RoomProvider>
    </SocketProvider>
  </StrictMode>
);
