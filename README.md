
# Scribble Sync

Scribble Sync is a real-time multiplayer drawing and guessing game (a skribbl.io style clone) implemented with React, TypeScript, Vite, TailwindCSS, Node.js, Express and Socket.IO. The code emphasizes a clear server-side game loop, stroke-based canvas sync, and room-based isolation.

![tech:react](https://img.shields.io/badge/React-17.0.0-blue.svg) ![tech:typescript](https://img.shields.io/badge/TypeScript-4.x-blue.svg) ![tech:socket.io](https://img.shields.io/badge/Socket.IO-4.x-yellowgreen.svg) ![tech:node](https://img.shields.io/badge/Node.js-16.x-green.svg) ![tech:vite](https://img.shields.io/badge/Vite-4.x-lightgrey.svg)

---

## Table of contents
 
- Quick overview
- Live Demo
- Why Scribble Sync exists
- Features
- Architecture
- Request / Game lifecycle
- Example gameplay flow
- Engineering challenges
- Project structure
- Backend overview & key files
- Frontend overview & key files
- Socket.IO architecture
- Canvas synchronization system
- Multiplayer state management
- Developer onboarding (local)
- Deployment notes
- Environment variables
- Socket event overview
- Design notes
- Roadmap
- License
- Author
## Quick overview

The project is split into a TypeScript React frontend (Vite) and a Node/Express backend with Socket.IO. The server keeps canonical room and game state; clients render a local canvas, send compact stroke events, and receive server-authoritative updates for replay and catch-up.

## Live Demo

[Link](https://scribble-sync-ivory.vercel.app/)

## Why Scribble Sync exists

- To capture the mechanics of a synchronous drawing game and keep the server as the single source of truth.
- To use stroke-level events (not bitmaps) so clients can replay and reconstruct canvas state efficiently.
- To provide a compact, readable example of room-based real-time game flow using Socket.IO.

## Features

- Public matchmaking and private invite-only rooms with room codes
- Room creation, join/leave, and host transfer
- Server-driven rounds, drawer assignment, word options, timer ticks
- Stroke-based canvas synchronization (`draw_start`, `draw_move`, `draw_end`, `draw_undo`)
- Chat and guess handling with server-side scoring and leaderboard updates
- Reconnect support with state sync and stroke replay
- Client-side canvas replay and undo (stroke-level)

---

## Architecture

System-level ASCII diagram:

```
				 +----------------+
				 |   Static Host  |  (optional frontend hosting)
				 +----------------+
					   |
				   (HTTP / WebSocket)
					   |
    +----------------+     +----------------------+     +----------------+
    |   Browser      |<--->|  Node + Express      |     |  In-memory     |
    |  (React + Vite) |     |  + Socket.IO server  |     |  Room Store    |
    +----------------+     +----------------------+     +----------------+
					   |
				   core modules
				   (RoomManager, GameManager)
					   |
				 word lists (local JSON)
```

Component interaction (simplified):

```
Client (Canvas) --emit--> Socket.IO --> Server (validates, updates room state) --emit--> Room clients
```

Core responsibilities:
- Frontend: render UI, manage local canvas, and send stroke/guess/chat events.
- Backend: manage rooms, run rounds/timers, validate actions, broadcast canonical updates.

Room visibility and matchmaking:

- Public rooms: flagged as public on creation and considered by the `quick_play` matchmaking path; these rooms are discoverable by the server for quick-fill.
- Private rooms: created as invite-only (private) and joinable only by room code; the server enforces visibility and will not place public searchers into private rooms.

---

## Request / Game lifecycle

High-level steps:

1. Room creation: a host requests `create_room` → server allocates Room ID and initial state.
2. Joining: players call `join_room` → server validates capacity and adds player to room state.
3. Game start: host triggers `start_game` → server initializes rounds, selects a drawer, sets timer.
4. Word selection: drawer receives candidate words, selects one via `select_word` (server records the choice).
5. Drawing: drawer sends `draw_start`, `draw_move`, `draw_end` events describing strokes — server broadcasts to room and appends to room replay buffer.
6. Guessing: players send `guess` events; server evaluates guesses, awards points, emits `guess_result` and broadcasts a system `chat_message` when a correct guess occurs.
7. Round end: on timer or when all guesses correct, server computes round results, updates scores, and advances to next round or ends game.
8. Game over: server emits `game_over` and optionally persists final results (out of scope for this repo).

---

## Example gameplay flow

1. Alice creates a room (host), room code is returned.
2. Bob and Carol join using the room code.
3. Alice starts the game -> server chooses Bob as drawer for round 1.
4. Bob selects a word; server broadcasts the masked hint to guessers.
5. Bob draws; clients receive incremental strokes and render them.
6. Carol makes correct guess; server awards points and notifies clients.
7. Round ends, next drawer chosen, repeat until configured rounds complete.

---

## Engineering challenges

- Synchronization: stroke-level events are compact and ordered; the server keeps active strokes and finalizes them into a stroke history for replay.
- Disconnect handling: the server supports short reconnect windows and rebinds sockets to existing player records when possible, avoiding accidental player replacement.
- Room lifecycle: rooms are cleaned up when empty or when public rooms become unused; the `RoomManager` is responsible for pruning.
- Canvas replay: the server provides `sync_state` with the current `strokeHistory` so clients can rebuild canvas after join or reconnect.
- Authority model: drawer-only draw acceptance is enforced in `RoomManager` before broadcast.
- Timer management: rounds and hints use server-side timers so clients can rely on `timer_tick` events for UI countdowns.
- Undo: undo removes the last stroke from `strokeHistory` and broadcasts `draw_undo` to clients.

---

## Project structure

Top-level layout (important folders only):

```
client/
	├─ public/
	├─ src/
	│   ├─ assets/
	│   ├─ canvas/
	│   │   └─ draw.ts
	│   ├─ components/
	│   │   ├─ CanvasBoard.tsx
	│   │   ├─ CanvasToolbar.tsx
	│   │   └─ (UI components)
	│   ├─ context/
	│   │   ├─ GameContext.tsx
	│   │   └─ SocketContext.tsx
	│   ├─ hooks/
	│   │   └─ useSocket.ts
	│   ├─ layouts/
	│   ├─ pages/
	│   ├─ socket/
	│   │   └─ socket.ts
	│   ├─ types/
	│   └─ utils/
	└─ package.json

server/
	├─ src/
	│   ├─ socket/
	│   │   └─ SocketHandler.ts
	│   ├─ rooms/
	│   │   └─ Room.ts
	│   ├─ game/
	│   │   └─ GameManager.ts
	│   ├─ managers/
	│   │   ├─ RoomManager.ts
	│   │   └─ TimerManager.ts
	│   ├─ models/
	│   │   └─ Player.ts
	│   ├─ services/
	│   │   └─ WordService.ts
	│   └─ utils/
	└─ package.json
```

Note: The project stores room and game state in memory by design. This keeps latency low for real-time interactions and keeps the code focused on synchronization logic rather than persistence. If you need durable history or cross-instance state, add a persistence layer and a Socket.IO adapter.

---

## Backend overview & key files

- `server/src/index.ts` — Express server bootstrap and Socket.IO attachment.
- `server/src/socket/SocketHandler.ts` — Central handler that registers socket event listeners and binds them to Room/Game managers.
- `server/src/managers/RoomManager.ts` — Responsible for creating, fetching and pruning room instances.
- `server/src/game/GameManager.ts` — Game orchestration for rounds, scoring, and timers.
- `server/src/managers/TimerManager.ts` — Centralized timer logic; keeps server tick and round timers consistent.
- `server/src/rooms/Room.ts` — Encapsulates room state, players, replay buffer, and helper methods for broadcasting room events.
- `server/src/services/WordService.ts` — Loads the word list from `server/src/words/words.json` and serves random picks.

---

## Frontend overview & key files

- `client/src/socket/socket.ts` — Socket.IO client wrapper with reconnection and event helpers.
- `client/src/canvas/draw.ts` — Low-level canvas utilities and stroke serialisation.
- `client/src/context/GameContext.tsx` — Holds game-level transient UI state, exposes actions to components.
- `client/src/components/CanvasBoard.tsx` — Canvas rendering component; subscribes to socket events to replay strokes.
- `client/src/components/CanvasToolbar.tsx` — Drawing tools, color, thickness, undo.

---

## Socket.IO architecture

The server defines central namespaces and a consistent set of events (see Socket Event Overview below). The server is the authoritative source for the current game/room state and validates player actions (drawer-only draws, guess scoring, etc.).

Design notes:
- Single namespace (default) is sufficient; rooms are implemented using Socket.IO rooms for efficient broadcast.
- Broadcast strategy: targeted (to room) for most events; `volatile` for high-frequency draw moves if you accept dropped messages instead of block-induced latency.

---

## Canvas synchronization system

Why stroke data instead of images
- Stroke events are compact and semantic (x,y,pressure,thickness,color), allowing low bandwidth and deterministic replay.

Undo system
- Implemented as a stroke-level operation: the client sends `undo` which the server validates (only drawer or allowed user) and removes the last stroke from the replay buffer, then emits an update to all clients to re-render from the buffer.

Replay system
- Server persists an ordered list of stroke events per round in memory. On reconnect or join, the client requests the room's current round strokes and replays them locally to reconstruct canvas state.

Redraw logic
- Clients render strokes in the order received. On state-catchup, clients clear canvas and replay from the server-provided stroke array to reach canonical state.

---

## Multiplayer state management

- Authoritative server: all scoring, drawer assignment, and timer decisions originate on the server.
- Room isolation: each room object encapsulates player list, scores, current round, and stroke buffer; communications are scoped to room channels.
- Drawer restrictions: only the selected drawer may emit stroke events that are persisted; server ignores unauthorized draw events.
- Scoring logic: simple time- and accuracy-based scoring — first correct guesses get more points; scoring calculations live on `GameManager`.
- Reconnect handling: the server supports reconnection by `playerId` (or by matching a recently disconnected player name). On a successful reconnect the server rebinds the socket to the existing player record, emits `player_reconnected`/`player_joined`, and sends a `sync_state` payload containing room state and `strokeHistory` so the client can catch up. The client persists `playerId` and other small session fields to localStorage (`client/src/utils/storage.ts`) and `RoomContext` will include those values when attempting to rejoin, which enables a smoother reconnect flow.

---

## Developer onboarding (local development)

Prerequisites

- Node.js 16+ and npm

Frontend

```
cd client
npm install
npm run dev
```

Backend

```
cd server
npm install
npm run dev
```

Typical npm scripts (examples):

- `client`: `dev`, `build`, `preview`
- `server`: `dev` (uses ts-node or ts-node-dev), `start` (compiled Node run)

Environment

- Configure server environment variables if you need non-default values (see Environment variables above). For local development the defaults in `server/src/config/env.ts` work with `client` running on `http://localhost:5173` and the server on `http://localhost:4000`.

---

## Deployment notes

- Frontend: deploy the `client/dist` build to Vercel or any static host. Vercel supports deploying Vite projects with minimal configuration.
- Backend: Render (or similar) is recommended for Node+Socket.IO workloads. Use a single region for both frontend and backend to minimize latency.
- WebSocket considerations: If you use a platform with sticky session requirements, ensure your Socket.IO configuration supports the chosen adapter. For multiple instances you will need an adapter (Redis adapter) — this repo presently runs a single process instance.
-- CORS: Allow the frontend origin via `CORS_ORIGIN` (`server/src/config/env.ts`) and configure Socket.IO `cors` so the browser can open WebSocket/HTTP long-polling connections.

---

## Environment variables

Only include variables relevant to this stack and repo. The server reads configuration from environment variables via `server/src/config/env.ts`.

| Name | Required | Description |
|------|:--------:|-------------|
| `PORT` | no | Backend HTTP/Socket server port (default `4000`). |
| `CORS_ORIGIN` | no | Comma-separated list of allowed origins or `*`. Defaults to `http://localhost:5173` in development. |
| `MAX_PLAYERS` | no | Default maximum players per room (2-20). |
| `ROUNDS` | no | Default rounds per game (2-10). |
| `DRAW_TIME_SEC` | no | Default drawing time per round in seconds. |
| `WORD_CHOICES` | no | Number of word options shown to the drawer. |
| `HINTS_ENABLED` | no | `true`/`false` whether hint letters are revealed. |
| `HINT_COUNT` | no | How many hint reveals to schedule during a round. |
| `WORD_MODE` | no | `normal` | `hidden` | `combination` word masking mode. |
| `DISCONNECT_GRACE_MS` | no | Milliseconds to wait for a disconnected player before timing them out. |

Note: This project uses in-memory room and game state by design. Persistent storage is not configured; add a datastore if you need durable history or cross-instance state.

---

## Socket event overview

The table below lists the events the client and server use. Payload shapes are summarized — see `client/src/types/socket.ts` and `server/src/socket/SocketHandler.ts` for exact shapes.

| Event | Direction | Payload (summary) | Purpose |
|-------|-----------|-------------------|---------|
| `create_room` | C→S | { name, playerName, isPublic?, settings? } | Create a new room and join as host. |
| `room_created` | S→C | { room, playerId } | Acknowledges room creation and returns public room state. |
| `quick_play` | C→S | { playerName, roomName? } | Join an available public room via quick matchmaking. |
| `join_room` | C→S | { roomCode, playerName, playerId? } | Join existing room (optionally with `playerId` to reconnect). |
| `room_joined` | S→C | { room, playerId } | Acknowledges join and basic room state. |
| `sync_state` | S→C | { room, playerId, leaderboard, strokes, drawerWord? } | Full state sync (sent on join or reconnect). |
| `player_joined` | S→C | { player, reconnected } | Notifies room members of a join or reconnection. |
| `player_reconnected` | S→C | { player } | Notification emitted when a disconnected player returns. |
| `player_left` | S→C | { playerId, reason } | Player left or disconnected. |
| `host_changed` | S→C | { hostId } | Host role transferred to another player. |
| `leave_room` | C→S | { roomCode } | Leave the current room. |
| `start_game` | C→S | { roomCode } | Host requests the server to start the game. |
| `game_started` | S→C | { room } | Broadcast that game has started. |
| `round_started` | S→C | { roomCode, roundNumber, drawerId, phase, chooseDurationSec } | New round has begun; drawer chosen. |
| `word_options` | S→C (to drawer) | { options, chooseDurationSec } | Drawer receives candidate words. |
| `select_word` | C→S | { roomCode, word } | Drawer selects their word choice. |
| `word_selected` | S→C | { maskedWord, wordLength, drawerId, roundDurationSec, word? } | Server shares masked word and, for the drawer only, the actual word. |
| `request_state` | C→S | { roomCode } | Client asks server to re-send `sync_state` for catch-up. |
| `update_room_settings` | C→S | { roomCode, settings } | Host updates room settings in the lobby. |
| `timer_tick` | S→C | { timeLeftSec, phase } | Per-second timer updates. |
| `hint_update` | S→C | { maskedWord, revealedCount } | Server reveals letters according to hint policy. |
| `draw_start` | C→S / S→C | { strokeId, point, color, size, tool } | Drawer starts a stroke; server relays to room. |
| `draw_move` | C→S / S→C | { strokeId, point } | Drawer continues a stroke; high-frequency. |
| `draw_end` | C→S / S→C | { strokeId, point } | Drawer ends a stroke; server finalizes into history. |
| `draw_undo` | C→S / S→C | { strokeId? } | Drawer requests undo; server removes last stroke and broadcasts undo. |
| `canvas_clear` | C→S / S→C | { roomCode } | Drawer clears the canvas for the round. |
| `fill_area` | C→S / S→C | { fillId, x, y, fillColor } | Drawer fills an area; server appends a fill stroke. |
| `chat` | C→S | { roomCode, message } | Send a chat/guess message (guesses are parsed server-side). |
| `chat_message` | S→C | { id, playerId|null, name, message, ... } | Chat broadcast (including system messages). |
| `guess` | C→S | { roomCode, message } | Submit a guess string. |
| `guess_result` | S→C | { correct, playerId?, pointsAwarded?, alreadyGuessed? } | Server response to a guess; correct guesses also trigger system chat messages and leaderboard updates. |
| `round_ended` | S→C | { reason, word, leaderboard } | Round finished; includes leaderboard snapshot. |
| `leaderboard_update` | S→C | { leaderboard } | Partial leaderboard update. |
| `game_over` | S→C | { leaderboard, winnerId } | Game finished. |
| `game_reset` | S→C | { room } | Room returned to lobby state. |
| `room_settings_updated` | S→C | { settings } | Host changed room settings (emitted in lobby). |
| `socket_error` | S→C | { message, code } | Generic socket error payload.

Implementation notes:
- `draw_move` is high-frequency; the server relays it but does not persist every intermediate update (active strokes are finalized on `draw_end`).
- Reconnect: include `playerId` in `join_room` to let the server rebind your existing player record; otherwise the server may match a disconnected player by name.

---

## Design notes

- Keep server state authoritative to avoid divergent client-side state and cheating.
- Use compact stroke representation and optional batching to trade off bandwidth vs latency.
- Avoid storing strokes indefinitely; keep only recent rounds in memory or move to a persistence layer when needed.

---

## Roadmap & future improvements

- Spectator mode (read-only view of a room)
- Reconnect persistence improvements (longer session windows, persistent player identity)
- Mobile layout and input improvements (touch controls, simplified toolbar)
- Custom word lists per room and admin-managed lists
- Improved drawing tools: smoothing, pressure simulation, shape helpers
- Room browser / matchmaking improvements (filters, game counts)
- Small UX improvements: avatars, player settings, chat moderation tools

---

## License

This project is provided under the MIT License. See the `LICENSE` file for details.

---

## Author

Apoorv Gupta

