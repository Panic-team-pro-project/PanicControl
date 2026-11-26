# PanicControl game developer guide

PanicControl is a browser game console. A shared screen (the **console**) hosts the game and the
players' phones (the **controllers**) are the gamepads. This guide is for developers who want to
build a game for it.

## What the SDK is, and is not

The SDK (`ConsoleSDK` for the screen, `ControllerSDK` for the phones) is the link between your game
and the console: rooms, players, messages between screen and phones, roles and statuses.

It is **not** a game engine. Rendering, physics and sound come from the library of your choice
(Phaser, PixiJS, Three.js, plain DOM...). The SDK only moves messages and player state.

## Key concepts

- **Console**: the shared screen. It owns the room and runs the game screen.
- **Controller**: a player's phone. It joins the room with a code and a name.
- **Room**: one console plus its players. Identified by a room code.
- **Host**: the first player to join. Only the host can start or stop a game and navigate the
  catalogue. If the host leaves, another player is promoted.
- **Catalogue**: the list of games found on the server (see [manifest.md](manifest.md)). The host
  picks one with a d-pad on the phone.
- **Phases**: the room is either in the **lobby** (catalogue shown, no game) or **playing** (a game
  is running).
- **Actions**: messages from a controller to the screen (`sendAction` / `onAction`). The server sets
  the sender's `playerId`, it cannot be forged.
- **Messages**: messages from the screen to controllers. `broadcast` reaches every controller,
  `sendToPlayer` reaches one player privately (`meta.isPrivate` is `true` on the phone).
- **Role vs status**: a **role** is private to one player (and the console), for example "spy". A
  **status** is shared with the screen and appears in its player list, for example "ready". Both are set by the
  screen.

Actions, broadcasts and private messages are only delivered while a game is running.

## How a game plugs in

A game is a folder with a `manifest.json` and two HTML pages, dropped in `games/`. The server
validates it and adds it to the catalogue. No platform code changes. See [manifest.md](manifest.md).

## The life of a game

1. The console page creates a room. Players join from their phones; the first is the host.
2. The console shows the catalogue. The host moves the selection and presses OK.
3. The server checks the host rights and the game's min and max players (every player in the room
   counts), then sends `game started` to everyone.
4. The game runs: controllers send actions, the screen answers with broadcasts or private messages,
   sets roles and statuses.
5. The host stops the game: everybody goes back to the catalogue and roles and statuses are reset.

A player who loses connection has 30 seconds to rejoin and gets the running game, role and status
back.

## Where to go next

- [SDK reference](sdk-reference.md): every method, type, error and limit.
- [Manifest reference](manifest.md): describe your game package.
- [Tutorial](tutorial.md): from an empty folder to a small multiplayer game.
- [Testing without phones](testing-without-phones.md): developer mode and virtual controllers.
- Technical background: [SDK architecture](../technical/sdk-architecture.md),
  [realtime protocol](../technical/realtime-protocol.md),
  [ADR 0001, game packages and launch](../adr/0001-game-packages-and-launch.md).

## Not yet available

- Loading your game pages (`entry.screen` / `entry.controller`): they are validated but not loaded
  yet; the platform shows a waiting panel. Iframe isolation is planned (ADR 0001).
- Controller layouts rendered from the declared components.
- Vibration, and sensors with the iOS permission prompt and a touch fallback.
- Accessibility options readable by games.
- Developer mode: driving the game from the virtual controllers, message log, latency display.
- Game lifecycle beyond start and stop: pause, turns, scores, achievements, end screen.
