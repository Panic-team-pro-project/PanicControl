# SDK reference

The SDK is the link between a game and the console. It is not a game engine: use Phaser, PixiJS,
Three.js or plain DOM for rendering, physics and sound. Architecture:
[SDK architecture](../technical/sdk-architecture.md). Wire format:
[realtime protocol](../technical/realtime-protocol.md).

## Getting started

The SDK is the `sdk` package (local `file:` dependency). Build it with `cd sdk && npm run build`
(ESM, CJS and `.d.ts`).

```ts
import { ConsoleSDK, ControllerSDK, PanicControlError } from 'sdk';
```

Options:

- `ConsoleSDKOptions { serverUrl: string; debug?: boolean }`
- `ControllerSDKOptions { serverUrl: string; playerId?: string; debug?: boolean }`

With `debug: true` the SDK logs connection and disconnection as `[PanicControl] ...`. It is off by
default.

> The platform owns the connection. A game page gets its SDK instance from the platform and must
> never create a room or open its own connection. The `Platform` sections below are for the
> platform pages, they are listed so you know what exists. How a game page receives its instance is
> not defined yet (see [Not yet available](#not-yet-available)).

### Typing messages

Both classes take two generics: `ConsoleSDK<A, M>` and `ControllerSDK<A, M>`, where `A` is the
**actions** (controller to screen) and `M` the **messages** (screen to controllers). Both default to
`MessageMap = Record<string, unknown>`.

```ts
type Actions = { jump: void; move: { x: number } };
type Messages = { score: { value: number } };

const pad = new ControllerSDK<Actions, Messages>({ serverUrl });
pad.sendAction('jump');
pad.sendAction('move', { x: 1 });
// pad.sendAction('move'); -> type error: data required
pad.onMessage('score', (data) => data.value);
```

The data argument follows `DataArgs<T>`: optional when the type is untyped (`unknown`), forbidden
when it is `void` or `undefined`, required otherwise.

### Unsubscribing

Every `on*` method returns a `() => void` that removes exactly that listener.

```ts
const off = sdk.onUpdatePlayers((players) => render(players));
off();
```

### Errors

Methods that wait for the server reject with `PanicControlError` (`extends Error`, with
`readonly code: SdkErrorCode`). See the [error codes](#error-codes). Server messages are in English.

```ts
try {
  await sdk.sendToPlayer(id, 'question', { text: 'Hi' });
} catch (e) {
  if (e instanceof PanicControlError && e.code === 'PLAYER_DISCONNECTED') {
    // the player is in the 30 s grace period
  }
}
```

State on the SDK (`game`, `role`, `status`...) is updated by internal listeners registered before
yours, so a callback always reads the new state. State is not reset on disconnect.

## ConsoleSDK

`new ConsoleSDK<A, M>(options: ConsoleSDKOptions)`

### For games

| Member                                                                       | Description                                                                                                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `get game(): GameManifest \| null`                                           | Manifest of the running game, `null` in the lobby.                                                                      |
| `roomCode: string \| null`                                                   | The room code.                                                                                                          |
| `onConnect(cb: () => void)`                                                  | Socket connected.                                                                                                       |
| `onDisconnect(cb: (reason: string) => void)`                                 | Socket disconnected.                                                                                                    |
| `onGameStarted(cb: (game: GameManifest) => void)`                            | A game started.                                                                                                         |
| `onGameStopped(cb: () => void)`                                              | The game stopped (back to the catalogue).                                                                               |
| `onUpdatePlayers(cb: (players: PlayerListInfo[]) => void)`                   | Player list changed (join, leave, status, host).                                                                        |
| `onDisconnectedUser(cb: (playerId: string) => void)`                         | A player lost their connection.                                                                                         |
| `onAction<K>(type: K, cb: (playerId: string, data: A[K]) => void)`           | An action of exactly that type arrived. `playerId` is set by the server.                                                |
| `broadcast<K>(type: K, ...data: DataArgs<M[K]>): void`                       | Send to every controller of the room (not the console). Fire-and-forget.                                                |
| `sendToPlayer<K>(playerId, type: K, ...data: DataArgs<M[K]>): Promise<void>` | Private message to one player, acknowledged by the server.                                                              |
| `setPlayerRole(playerId: string, role: string \| null): Promise<void>`       | Private role, seen only by that player and the console.                                                                 |
| `setPlayerStatus(playerId: string, status: string \| null): Promise<void>`   | Status shared with the screen (`onUpdatePlayers`) and that player (`onPlayerStateChanged`); other phones do not get it. |

Details:

- `onAction` fires only for that exact `type`. Register one listener per action type.
- `broadcast` is ignored by the server outside a running game or when the message is invalid. It
  never throws.
- `sendToPlayer` arrives on the controller with `isPrivate: true`. It rejects with
  `PLAYER_NOT_FOUND`, `PLAYER_DISCONNECTED` (the player is in the 30 s grace period, the message is
  not queued), `NO_GAME_RUNNING`, `INVALID_PAYLOAD`, `NOT_CONSOLE`, `TIMEOUT` or `BAD_RESPONSE`.
- `setPlayerRole` keeps the role across reconnection (it is sent again), resets it when a game
  starts or stops, and is accepted while the player is in grace. Never show a role to everyone: it
  is private. `PlayerListInfo.role` is there for the console only.
- `setPlayerStatus` and `setPlayerRole` accept `null` (clear) or 1 to 50 characters after trim,
  otherwise `INVALID_PAYLOAD`.

```ts
sdk.onGameStarted(async () => {
  await sdk.setPlayerStatus(playerId, 'ready');
  sdk.broadcast('score', { value: 0 });
});
```

### Platform

Used by the platform console page, not by games.

- `createRoom(): Promise<string>`: creates a room and resolves the room code.
- `reconnectToRoom(roomCode: string): Promise<string>`: takes the room back after a reload.
  Rejects with a plain `Error` carrying the server message (`Room not found for reconnection`,
  `Room is already connected`) or a timeout message after 5 s.
- `get catalogue(): CatalogueState | null` and `onCatalogue(cb: (state: CatalogueState) => void)`:
  the games list and the selection.
- `onCatalogueSelection(cb: (selectedGame: GameManifest | null) => void)`: selection moved.
- `onReconnectedToRoom(cb: (roomCode: string) => void)`: the room was recovered; receives its code.
- `onRoomClosed(cb: (message: string) => void)`: the room was closed.
- `disconnect(): void`: closes the connection.

## ControllerSDK

`new ControllerSDK<A, M>(options: ControllerSDKOptions)`

### For games

| Member                                                               | Description                                                                |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `playerId: string \| null`, `roomCode: string \| null`               | Identity of this phone in the room.                                        |
| `get isHost(): boolean`                                              | Whether this player is the host.                                           |
| `get game(): GameManifest \| null`                                   | Running game, `null` in the lobby.                                         |
| `get role(): string \| null`, `get status(): string \| null`         | Current private role and status (shared with the screen).                  |
| `onConnect`, `onDisconnect`, `disconnect`                            | Same as on the console.                                                    |
| `onGameStarted(cb: (game: GameManifest) => void)`                    | A game started.                                                            |
| `onGameStopped(cb: () => void)`                                      | The game stopped.                                                          |
| `onPlayerStateChanged(cb: (state: PlayerState) => void)`             | The screen changed this player's role or status.                           |
| `onPromoteToHost(cb: () => void)`                                    | This player became the host.                                               |
| `onConsoleDisconnected(cb: (message: string) => void)`               | The console lost its connection.                                           |
| `onConsoleReconnected(cb: (message: string) => void)`                | The console is back.                                                       |
| `sendAction<K>(type: K, ...data: DataArgs<A[K]>): void`              | Send an action to the screen. Fire-and-forget.                             |
| `onMessage<K>(type: K, cb: (data: M[K], meta: MessageMeta) => void)` | A broadcast or private message of that type. `meta.isPrivate` tells which. |

Details:

- `sendAction` is dropped by the server outside a running game or when invalid. It never throws.
- `onMessage` receives both broadcasts and private messages. Use `meta.isPrivate` to tell them
  apart.
- `GAME_STARTED` and `GAME_STOPPED` reset `role` and `status` to `null` without calling
  `onPlayerStateChanged`.
- `disconnect()` closes the connection (not used from a game page).

```ts
pad.onPlayerStateChanged(({ role }) => {
  roleLabel.textContent = role ?? 'No role';
});
pad.onMessage('score', (data, meta) => {
  if (!meta.isPrivate) scoreLabel.textContent = String(data.value);
});
```

### Host only

The server enforces host rights and answers `NOT_HOST` otherwise. These are driven by the platform
controller page, not by game pages.

- `navigateCatalogue(direction: Direction): void`: `up` / `left` select the previous game, `down` /
  `right` the next. Fire-and-forget.
- `startGame(): Promise<void>`: rejects with `NOT_IN_ROOM`, `NOT_HOST`, `GAME_ALREADY_RUNNING`,
  `NO_GAME_SELECTED`, `NOT_ENOUGH_PLAYERS` or `TOO_MANY_PLAYERS`.
- `stopGame(): Promise<void>`: rejects with `NOT_IN_ROOM`, `NOT_HOST` or `NO_GAME_RUNNING`.

### Platform

Used by the platform controller page, not by games.

- `joinRoom(roomCode: string, playerName: string): Promise<string>`: resolves the `playerId`.
- `reconnectToRoom(roomCode: string, playerName: string, playerId: string): Promise<string>`:
  rejoins within the grace period. Reconnecting under another name updates the name. A `playerId` unknown to the room is not an
  error: it is accepted as the id of a new player.
- `get selectedGame(): GameManifest | null` and `onCatalogueSelection(cb)`: the game highlighted in
  the catalogue.

Both reject with a plain `Error` carrying the server message (`Room not found`,
`Invalid player name`, `Room is full`,
`This player is already connected.`) or a timeout message after 5 s.

## Types

```ts
type MessageMap = Record<string, unknown>;
type CatalogueState = { games: GameManifest[]; selectedGameId: string | null };
type PlayerState = { role: string | null; status: string | null };
type MessageMeta = { isPrivate: boolean };
type PlayerListInfo = {
  name: string;
  playerId: string;
  isConnected: boolean;
  isHost: boolean;
  role: string | null;
  status: string | null;
};
```

Also exported: `SdkErrorCode`, `ErrorCode`, `AccessibilityFeature`, `ControllerComponent`,
`Direction`, `GameEntry`, `GameManifest`, `ConsoleSDKOptions`, `ControllerSDKOptions`.
`GameManifest` mirrors the [manifest](manifest.md).

## Error codes

`SdkErrorCode = ErrorCode | 'TIMEOUT' | 'BAD_RESPONSE'`.

| Code                   | Meaning                                | Typical cause                                 | Methods                                            |
| ---------------------- | -------------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| `NOT_CONSOLE`          | Only the console may do this           | Controller-side call to a console-only action | `sendToPlayer`, role and status setters            |
| `NOT_HOST`             | Only the host may do this              | A non-host starts or stops a game             | `startGame`, `stopGame`                            |
| `NOT_IN_ROOM`          | The socket is not in a room            | Call before joining or after leaving          | any room method                                    |
| `INVALID_PAYLOAD`      | Payload rejected                       | Bad `type`, too large, role or status length  | `sendToPlayer`, `setPlayerRole`, `setPlayerStatus` |
| `NO_GAME_SELECTED`     | No game highlighted in the catalogue   | Start with an empty selection                 | `startGame`                                        |
| `GAME_ALREADY_RUNNING` | A game is already running              | Start twice                                   | `startGame`                                        |
| `NO_GAME_RUNNING`      | No game is running                     | Messaging or stopping in the lobby            | `stopGame`, `sendToPlayer`                         |
| `NOT_ENOUGH_PLAYERS`   | Below the game's `minPlayers`          | Too few players in the room                   | `startGame`                                        |
| `TOO_MANY_PLAYERS`     | Above the game's `maxPlayers`          | Too many players in the room                  | `startGame`                                        |
| `PLAYER_NOT_FOUND`     | Unknown player id                      | Wrong or stale `playerId`                     | `sendToPlayer`, role and status setters            |
| `PLAYER_DISCONNECTED`  | The player is in the 30 s grace period | Phone lost its connection                     | `sendToPlayer`                                     |
| `TIMEOUT`              | No answer within 5000 ms               | Network or server problem                     | any method waiting for an answer                   |
| `BAD_RESPONSE`         | Malformed answer from the server       | Version mismatch                              | any method waiting for an answer                   |

## Limits

- Message `type`: 1 to 64 characters among `A-Za-z0-9_.:-`.
- Message `data`: JSON-serialisable, at most 64 KB by default (server `MAX_MESSAGE_BYTES`). Send
  drawings stroke by stroke, not as one image.
- Role and status: at most 50 characters.
- Answers are awaited for 5 seconds.
- Players per room: 8 by default (`MAX_PLAYERS_PER_ROOM`).

## Constants

- `CONTROLLER_COMPONENTS`: `button`, `dpad`, `joystick`, `touch`, `text`, `choice`, `drawing`,
  `motion`.
- `ACCESSIBILITY_FEATURES`: `colorBlind`, `textSize`, `slowDown`, `textToSpeech`, `subtitles`,
  `noFlashing`, `noVibration`.
- `DIRECTIONS`: `up`, `down`, `left`, `right`.

## Not yet available

- A defined way for a game page to receive its SDK instance (iframe isolation, ADR 0001).
- Controller components rendered by the platform, vibration, sensors (with iOS permission and touch
  fallback).
- Reading the player's accessibility options from the SDK.
- Developer mode: controller simulator, message log, latency.
- Pause, turns, scores, achievements and end screen helpers.
