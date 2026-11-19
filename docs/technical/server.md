# Server

The server (`server/`) keeps the rooms and the players, validates every message and relays it. It is
built with Express and Socket.IO. For the protocol, see [Real-time protocol](realtime-protocol.md);
for the data it holds, see [Data model](data-model.md). Setup and scripts are in the
[README](../../README.md).

## Module map

| File                            | Role                                                            |
| ------------------------------- | --------------------------------------------------------------- |
| `src/server.ts`                 | Entry point: HTTP server, Socket.IO, catalogue loading, startup |
| `src/api/routes.ts`             | HTTP routes (only `GET /`, a health message)                    |
| `src/config.ts`                 | Reads and validates environment variables                       |
| `src/realtime/socketManager.ts` | All socket handlers and the grace-period timers                 |
| `src/realtime/roomManager.ts`   | Map of rooms, room codes, inactivity cleanup                    |
| `src/realtime/room.ts`          | `Room`: players, phase, selection, game                         |
| `src/realtime/player.ts`        | `Player`                                                        |
| `src/core/pseudoFilter.ts`      | Player name validation and profanity filter                     |
| `src/core/utils.ts`             | Helpers                                                         |
| `src/core/gameManifest.ts`      | Manifest validation                                             |
| `src/core/messagePayload.ts`    | Validation of message `type` and `data`                         |
| `src/games/catalogue.ts`        | `loadCatalogue` and the `Catalogue`                             |

## Startup sequence

1. Create the Express app and register the routes. `GET /` answers 200 with a JSON health message.
2. Create the HTTP server.
3. Create the Socket.IO `Server` with CORS open (`origin: '*'`) and
   `maxHttpBufferSize = MAX_MESSAGE_BYTES + 4096`.
4. `await loadCatalogue(GAMES_DIR)`. It never throws: a missing directory gives an empty catalogue.
   The number of games is logged.
5. Create the `SocketManager` with the Socket.IO server and the catalogue.
6. Listen on `PORT` (`process.env.PORT || 3000`, read in `server.ts` and not validated).

## Configuration

Defined in `src/config.ts`. A missing or blank value uses the default. A value that is not an integer
or is lower than 1 logs a warning and uses the default. The example file is `server/.env.example`.

| Variable               | Default    | Validation                                         | Effect                                                              |
| ---------------------- | ---------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| `PORT`                 | `3000`     | none                                               | HTTP and Socket.IO port                                             |
| `MAX_PLAYERS_PER_ROOM` | `8`        | positive integer                                   | Room capacity, and upper bound for a manifest's `maxPlayers`        |
| `MAX_MESSAGE_BYTES`    | `65536`    | positive integer                                   | Limit for message `data` and base of the Socket.IO buffer size      |
| `GAMES_DIR`            | `../games` | resolved with `path.resolve(process.cwd(), value)` | Folder scanned for game packages; relative to the working directory |

## Validation rules

| Input        | Rule                                                                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Room code    | 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, `crypto.randomInt`, unique                                                                                                 |
| Player name  | `validatePlayerName`: trimmed 1 to 20 characters, glin-profanity (French and English), aggressive leetspeak detection, unicode normalisation, custom list. Accept or reject only |
| Message type | `/^[A-Za-z0-9_.:-]+$/`, 1 to 64 characters                                                                                                                                       |
| Message data | JSON-serialisable, UTF-8 at most `MAX_MESSAGE_BYTES`                                                                                                                             |
| Role, status | `null` or trimmed 1 to 50 characters                                                                                                                                             |
| Manifest     | [Manifest reference](../game-dev/manifest.md)                                                                                                                                    |

Catalogue loading keeps a game only if its `manifest.json` parses and validates, its `id` equals the
folder name, and both entry files exist (`fs.stat` and `isFile`). Otherwise it is skipped with one
warning.

## Logging

The server logs with `console` (info, warnings, errors). Messages are in French and use emoji. There
are no structured logs or log levels yet.

## Running and testing

Setup and the `.env` files are described in the [README](../../README.md). In `server/`:

| Command         | What it does                               |
| --------------- | ------------------------------------------ |
| `npm run dev`   | Start the server in watch mode             |
| `npm run build` | Type-check and bundle to `dist/server.mjs` |
| `npm test`      | Run the Vitest tests of the package        |

`npm test` at the repository root runs every package. Tests live in `server/tests/`, mirroring
`server/src/` (for example `src/realtime/room.ts` is tested in `tests/realtime/room.test.ts`).
Socket end-to-end tests use the real SDK against a real server:
`server/tests/realtime/socketManager.test.ts`. Game fixtures for the catalogue are in
`server/tests/fixtures/games`.

## Known limitations

- The player name is checked trimmed but stored untrimmed.
- `playerId` is generated with `Math.random` (not crypto) and an unknown client-supplied `playerId`
  is accepted as the new player's id. Reconnection relies on the secrecy of the id (a secret
  reconnection token is planned, see [ADR 0001](../adr/0001-game-packages-and-launch.md)). After an
  abrupt network loss, a reconnection can be refused until Socket.IO detects the dead socket.
- An offline console can be reclaimed by anyone who knows the room code.
- `getRoom` refreshes activity on reads, which weakens inactivity cleanup. Cleanup does not
  disconnect sockets.
- `migrateHost` picks `players[0]` even if offline (no `promote_to_host` then).
- Only the host player can start or stop a game. The console cannot.
- `navigate_catalogue`, `send_action` and `broadcast_message` drop invalid input silently, with a
  server warning only.
- Player-typed text inside generic message `data` is not filtered by the server.
- Logs are in French with emoji. HTTP has only a health route. CORS is open (`*`).
- `PORT` is not validated.

## Not yet available

- Accounts with hashed passwords.
- Structured logs.
- Load tests with simulated players (bots).
- Rate limiting.
