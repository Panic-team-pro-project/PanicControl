# Games

Each game is a package: a folder `games/<id>/` containing a `manifest.json`. The folder name must
be the game `id`. The package also holds the two pages of the game, `screen.html` and
`controller.html` (see `entry` below). Loading them in iframes comes with the isolation feature and
is not wired yet.

The server reads every package at startup and builds the catalogue shown on the console. A package
with a missing or invalid manifest is skipped, and the server logs a warning naming the folder and
the reason. Restart the server to reload the catalogue.

## `manifest.json`

| Field                   | Type     | Constraints                                                                                                                       |
| ----------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `id`                    | string   | kebab-case (`a-z`, `0-9`, single dashes), 3 to 40 characters, equal to the folder name                                            |
| `name`                  | string   | 1 to 50 characters (trimmed), shown in the catalogue                                                                              |
| `version`               | string   | `x.y.z`, digits only                                                                                                              |
| `minPlayers`            | integer  | from 1 to the room limit (`MAX_PLAYERS_PER_ROOM`, default 8), not greater than `maxPlayers`                                       |
| `maxPlayers`            | integer  | from 1 to the room limit                                                                                                          |
| `durationMinutes`       | integer  | from 1 to 180                                                                                                                     |
| `controllerComponents`  | string[] | non-empty, no duplicates, among `button`, `dpad`, `joystick`, `touch`, `text`, `choice`, `drawing`, `motion`                      |
| `accessibilityFeatures` | string[] | may be empty, no duplicates, among `colorBlind`, `textSize`, `slowDown`, `textToSpeech`, `subtitles`, `noFlashing`, `noVibration` |
| `entry`                 | object   | `{ "screen": "...", "controller": "..." }`, both required, see below                                                              |
| `description`           | string   | optional, at most 200 characters                                                                                                  |

Unknown fields are ignored.

### `entry`

- `entry.screen` is the page shown on the shared screen, `entry.controller` the page shown on each
  phone.
- Each value is a relative POSIX path inside the game folder, ending with `.html`, 1 to 200
  characters (for example `screen.html` or `dist/screen.html`). A leading `./` is accepted and
  removed. Absolute paths, backslashes, `:` (URLs, drive letters), `?`, `#`, empty segments and `.`
  or `..` segments are rejected.
- Both files must exist when the server starts, otherwise the package is skipped with a warning.
- The platform does not load these pages yet: iframes come with the isolation feature.

Package layout:

```text
games/color-rush/
├── manifest.json
├── screen.html
└── controller.html
```

## Example

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
