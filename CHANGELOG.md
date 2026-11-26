# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Server: room creation with a 6-character code, joining with a player name, player list updates.
- Server: reconnection within 30 seconds after a player loses the connection.
- Server: automatic closing of rooms inactive for 15 minutes.
- Server: player name validation and profanity filter.
- SDK: `ConsoleSDK` and `ControllerSDK` client libraries, with event names shared through `common`.
- Web app: home page, "Bonjour Martin" test game with a console page (room code, QR code, player
  list) and a phone controller page.
- Configuration through environment variables, documented in `.env.example` files.
- Lint and formatting (ESLint, Prettier) and Git hooks checking commit messages (Husky, commitlint).
- Contribution rules, good practice guide, code of conduct, issue and pull request templates.
- Docker images for the server and the web app, and a Compose file that runs the whole platform.
- GitHub Actions pipeline running lint, format, build and unit tests on every pull request.
- Unit tests for the server, SDK and web app (Vitest), run from the repository root with `npm test`.
- Server tests for rooms, players, room codes and room cleanup, and tests of the socket connections
  and messages between the server, the console and the controllers, through the real SDK.
- Development stack with Compose Watch (`compose.dev.yaml`), checked on every pull request.
- Games: game packages in `games/<id>/manifest.json`, discovered and validated by the server at
  startup (`GAMES_DIR`); manifests declare `entry.screen` / `entry.controller` (relative `.html`
  paths checked at startup; not loaded yet); format documented in `games/README.md` and ADR 0001.
- Console/Controller: the host's phone drives the game catalogue shown on the screen with a d-pad
  and starts or stops a game; the server checks host rights and the game's player count.
- SDK: typed messaging with generics (`ControllerSDK.sendAction` / `ConsoleSDK.onAction`,
  `ConsoleSDK.broadcast`, `ConsoleSDK.sendToPlayer` for private messages, `ControllerSDK.onMessage`);
  per-player private role and public status (`setPlayerRole`, `setPlayerStatus`,
  `onPlayerStateChanged`), kept across reconnection; catalogue and game lifecycle listeners
  (`onCatalogue`, `onCatalogueSelection`, `onGameStarted`, `onGameStopped`); `PanicControlError`
  with an error `code` (the server's codes, plus `TIMEOUT` and `BAD_RESPONSE` raised by the SDK).
- Server: `MAX_MESSAGE_BYTES` setting (default 64 KB) limiting game message size.
- Web: `VITE_SDK_DEBUG=true` turns on the SDK debug logs on the console and controller pages
  (`client_host/.env.example`, Docker build argument).
- Web: developer mode, to test a game without phones. `?debug` or Ctrl+Shift+D turns it on, in
  development and production builds. A 🛠 Dev button opens a small see-through window that can be
  dragged anywhere on the screen, on every page. Its virtual controllers join a room like phones:
  each one is a real `ControllerSDK`, so the server applies the same rules (player limit, host,
  reconnection), and they stay connected across pages.
- Docs: technical documentation (architecture, data model, real-time protocol, server, SDK architecture) and a game developer guide (SDK reference, manifest, tutorial preview) in `docs/`.

### Changed

- **BREAKING** SDK: constructors take an options object (`new ConsoleSDK({ serverUrl, debug })`,
  `new ControllerSDK({ serverUrl, playerId, debug })`); no console logs unless `debug` is true.
- SDK: every `onXxx` method returns an unsubscribe function.
- **BREAKING** Protocol: `player_joined` now carries `isHost`; `update_players` is sent to the
  console only and includes `role` and `status`.
- **BREAKING** Protocol: `disconnected_user` is sent to the console only.
- Server: reconnecting with the id of a player who is still connected is refused.

### Removed

- **BREAKING** Protocol/SDK: placeholder `game_info` event and `ConsoleSDK.onGameInfo`.

### Fixed

- `join_room` and `reconnect_to_room` refuse arguments of the wrong type with `Invalid payload`
  instead of crashing the handler.
- A console that disconnects, comes back and disconnects again gets the full 30 seconds the second
  time: the first timer no longer closes the room early.
- `ConsoleSDK.onReconnectedToRoom` receives the room code instead of `undefined`.
- A player who reconnects under another name is shown with the new name on the console (the name
  still goes through the filter).
- Errors from the server reach the user as readable text instead of "[object Object]".
- The player list sent to the console uses each player's ID instead of their connection ID.
- The console receives the ID of a player who disconnects instead of an object.
- A room accepts 8 players instead of 2. `MAX_PLAYERS_PER_ROOM` in `server/.env` changes the limit,
  for example to test a full room.
- Room codes always have 6 characters, leave out characters that look alike (0, O, 1, I) and are
  never shared by two open rooms.
