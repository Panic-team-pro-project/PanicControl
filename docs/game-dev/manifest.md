# Game manifest reference

Every game is a package: a folder in `games/` with a `manifest.json` and its pages.

## Package layout

```text
games/color-rush/
├── manifest.json
├── screen.html
└── controller.html
```

- The folder name must equal the manifest `id`.
- The server reads the folder given by `GAMES_DIR` (default `../games` from the server's working
  directory) at startup. Restart the server to reload.
- Adding a game never changes platform code.

## Fields

| Field                   | Type     | Constraints                                                                                                                       |
| ----------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `id`                    | string   | kebab-case (`a-z`, `0-9`, single dashes), 3 to 40 characters, equal to the folder name                                            |
| `name`                  | string   | 1 to 50 characters (trimmed)                                                                                                      |
| `version`               | string   | `x.y.z`, digits only                                                                                                              |
| `minPlayers`            | integer  | from 1 to the room limit (`MAX_PLAYERS_PER_ROOM`, default 8), not greater than `maxPlayers`                                       |
| `maxPlayers`            | integer  | from 1 to the room limit                                                                                                          |
| `durationMinutes`       | integer  | from 1 to 180                                                                                                                     |
| `controllerComponents`  | string[] | non-empty, no duplicates, among `button`, `dpad`, `joystick`, `touch`, `text`, `choice`, `drawing`, `motion`                      |
| `accessibilityFeatures` | string[] | may be empty, no duplicates, among `colorBlind`, `textSize`, `slowDown`, `textToSpeech`, `subtitles`, `noFlashing`, `noVibration` |
| `entry`                 | object   | `{ "screen": "...", "controller": "..." }`, both required                                                                         |
| `description`           | string   | optional, at most 200 characters                                                                                                  |

Unknown fields are ignored (dropped).

### Why each field exists

- `id`: stable identifier used by the server and the SDK (`game.id`); the folder name keeps packages
  and ids in sync.
- `name`, `description`: shown on the catalogue card.
- `version`: lets you tell releases of your game apart.
- `minPlayers`, `maxPlayers`: the server refuses to start the game outside this range (error
  `NOT_ENOUGH_PLAYERS` or `TOO_MANY_PLAYERS`). Every player in the room counts.
- `durationMinutes`: shown on the card, informative only.
- `controllerComponents`: which controls your phone page uses. Declared and shown in the catalogue.
- `accessibilityFeatures`: which accessibility options your game supports. Shown in the catalogue.
- `entry`: the two pages of the game.

### `entry`

- `entry.screen` is the page for the shared screen, `entry.controller` the page for each phone.
- Each value is a relative POSIX path inside the game folder, ending with `.html`, 1 to 200
  characters (for example `screen.html` or `dist/screen.html`). A leading `./` is removed.
- Rejected: absolute paths (leading `/`), backslashes, `:`, `?`, `#`, empty segments, `.` and `..`
  segments.
- Both files must exist when the server starts, otherwise the package is skipped.

Paths are relative, not URLs: the server validates them and builds the URL itself. External URLs
could come later behind an allow-list (see
[ADR 0001](../adr/0001-game-packages-and-launch.md)).

## Full example

`games/color-rush/manifest.json`:

```json
{
  "id": "color-rush",
  "name": "Color Rush",
  "version": "1.0.0",
  "minPlayers": 2,
  "maxPlayers": 6,
  "durationMinutes": 10,
  "controllerComponents": ["button", "dpad"],
  "accessibilityFeatures": ["colorBlind", "noFlashing"],
  "entry": { "screen": "screen.html", "controller": "controller.html" },
  "description": "Race to tap the right colour before the others."
}
```

## How the catalogue uses it

The console shows one card per valid game with its name, description, player range, duration and
accessibility features. The catalogue is sorted by game name (`localeCompare`), so the initially selected game is the
first by name. The host navigates with the d-pad on their phone. Games receive their own
manifest through `sdk.game` and `onGameStarted`.

## Validation

At startup the server checks every folder of `games/`. A package with a missing or invalid manifest,
or a missing entry file, is skipped. The server logs one warning naming the folder and the reason;
it does not crash and the other games stay available.

## Add a game

1. Create `games/<id>/` with `manifest.json` and the two pages.
2. Restart the server.
3. Check the server logs for a warning, and the game in the catalogue.

## Not yet available

- Loading `entry.screen` and `entry.controller`: they are validated but the platform does not load
  them yet.
- Controller layouts built from `controllerComponents`.
- Applying or exposing `accessibilityFeatures` to games.
- External entry URLs and hot reload of the catalogue.
