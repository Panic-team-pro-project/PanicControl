# ADR 0001: Game packages, catalogue and launch flow

- Status: Accepted
- Date: 2026-11-19

## Context

Spec section 02-E requires each game to be a package with a manifest: name, version, player count,
controller components and accessibility features. Adding a game to the catalogue must not require
changing the platform. A game that crashes or hangs must be stopped and the players sent back home
without losing the room. The catalogue must show each game's accessibility features. The server is
authoritative: it cannot trust what a client says about a game.

## Decision

### Packages and manifest

- Packages live in `games/<id>/` at the repository root, with one `manifest.json` per game. The
  folder name is the game `id`.
- Manifest fields:
  - `id`: kebab-case, 3 to 40 characters.
  - `name`: 1 to 50 characters.
  - `version`: semver `x.y.z`.
  - `minPlayers` / `maxPlayers`: from 1 to `MAX_PLAYERS_PER_ROOM`, `min <= max`.
  - `durationMinutes`: 1 to 180.
  - `controllerComponents`: non-empty, among `button`, `dpad`, `joystick`, `touch`, `text`,
    `choice`, `drawing`, `motion`.
  - `accessibilityFeatures`: among `colorBlind`, `textSize`, `slowDown`, `textToSpeech`,
    `subtitles`, `noFlashing`, `noVibration`.
  - `entry`: `screen` and `controller`, relative `.html` paths inside the package.
  - `description`: optional, 200 characters at most.
- `entry` uses relative paths inside the package, not absolute URLs as some hosted platforms
  allow. The server validates them (and checks the files exist at startup) and builds the URL
  itself, so no third-party code origin is involved and the platform works offline and
  reproducibly. External URLs could come later behind an allow-list. The pages are declared and
  checked but not loaded yet.
- The manifest type and the allowed lists are shared in `common/gameManifest.ts`.
- The server scans `GAMES_DIR` (default `../games`) at startup, validates each manifest, skips
  invalid packages with a warning and keeps an in-memory catalogue sorted by name. A restart
  reloads it. Docker copies `games/` into the server image.

### Launch flow

- A room has a phase: `lobby` or `playing`.
- The console receives the catalogue (`CATALOGUE`) when the room is created or when the console
  reconnects.
- Only the host's phone drives the catalogue, as a remote: the d-pad (`NAVIGATE_CATALOGUE`; up or
  left selects the previous game, down or right the next one; linear, clamped) and OK
  (`START_GAME`).
- The server picks the selected game from its own catalogue (the client never sends a manifest),
  checks host rights and the min/max player count, then broadcasts `GAME_STARTED`.
- The host can send `STOP_GAME` to go back to the lobby. Roles and statuses reset on start and
  stop.

### In-game messaging

- The SDK offers typed generics: actions (controller to screen), broadcast and private messages
  (screen to controllers), a private role and a public status per player, kept across
  reconnection.
- Requests and responses use Socket.IO acknowledgements with error codes.
- Message `data` is limited by `MAX_MESSAGE_BYTES` (default 64 KB, Socket.IO `maxHttpBufferSize`
  aligned). This protects the relay, because a broadcast is fanned out to every phone.

### Message channel and isolation

The SDK sends and receives every message through one internal channel (`SocketChannel` in
`sdk/src/channel.ts`, not exported). Today it is Socket.IO. The next step extracts a `Channel`
interface, adds a `PostMessageChannel`, loads `screen.html` and `controller.html` of the package in
iframes and bridges the SDK through `postMessage`. This gives the isolation required by the spec without changing the game-facing API.
Serving `/games/<id>/...` statically comes with that step.

## Alternatives considered

- **The game sends its own manifest at runtime (`registerGame(manifest)`).** Rejected: it trusts
  the client for the game identity and the player limits.
- **Packages under `client_host/public/games`.** Rejected: two sources of truth, and the server
  still has to read the manifests.
- **Game list displayed on the host's phone instead of a remote.** Rejected by the team in favour
  of the familiar remote-style flow driving the shared screen. The phone list would have been
  easier for screen readers; to compensate, the d-pad buttons are labelled and announcements use
  `aria-live`.
- **Full iframe isolation now.** Rejected: it doubles the scope. It is planned as the next
  feature.

## Consequences

- Adding a game means dropping a folder in `games/` and restarting the server.
- The catalogue is empty until the first game ships.
- The console screen only displays the catalogue. The keyboard on the console is not used to pick
  a game, which is an open accessibility question against the spec ("keyboard on the console").
- Player-typed text inside generic message `data` is not filtered by the server. This is a gap
  against the spec golden rule, to address with a filtered `text` controller component.
- Joining during a game only checks the room limit, not the game's `maxPlayers`.
- The protocol change is breaking for SDK users.
- Reconnection is protected only by the secrecy of the player id. After an abrupt network loss, a reconnection can be refused until Socket.IO detects the dead socket (ping timeout). A secret reconnection token is the planned follow-up.
