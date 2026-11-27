# Testing without phones

Developer mode lets you test a game on one computer: **virtual controllers** join a room like
phones, so you don't need to hold several phones, and a **message log** shows what goes through
the room.

## Turning developer mode on

Developer mode works the same with the Vite dev server and in the production build.

- Add `?debug` to the address, for example `http://localhost:5173/bonjour-martin?debug`. Developer
  mode stays on in that browser tab, even when you change page or reload.
- Or press **Ctrl+Shift+D** (**Cmd+Shift+D** on a Mac) on any page. The same shortcut turns it off.

While it's on, a **🛠 Dev** button sits in the bottom-right corner of every page. It opens the
developer overlay, and shows how many virtual controllers are connected. While it's off, nothing
shows, so players never see it.

The overlay is a small see-through window that floats over the page. The page behind stays usable:
you can create a room or watch the player list while the overlay is open.

- **Move it** by dragging its title bar, with the mouse or a finger. With the keyboard, focus the ⠿
  handle and use the arrow keys (Shift + arrow for bigger steps). It stays inside the window, and
  comes back where you left it, in the same tab.
- **⧉ Ouvrir dans une fenêtre**, in the virtual controllers' toolbar and in the log's, moves that
  tool to a separate browser window that updates live, to keep it beside the page or on another
  screen. The controllers stay connected when they move. "Ramener dans la page", or closing the
  window, brings the tool back. The windows close with the page, and when developer mode is turned
  off. If the browser blocks them, allow pop-up windows for the site.
- **Close it** with ✕ or Escape. The virtual controllers stay connected when it's closed, and when
  you change page.

Turning developer mode off disconnects every virtual controller, so no hidden player stays in a
room.

## Virtual controllers

Each virtual controller is a real `ControllerSDK` connected to the server, exactly like a phone.
The server can't tell the difference, so it applies the same rules:

- it appears in the console's player list;
- it counts toward the room limit (`MAX_PLAYERS_PER_ROOM`);
- the first player to join is the host, whether a phone or a virtual controller.

### Choosing the room

- **On the console page**, "Code du salon" is filled with the page's room as soon as the page has
  one: create a room, then open the overlay. It's filled again when the page creates another room.
- **On any page**, type a room code in "Code du salon". The controllers join that room, for example
  a console open in another tab or on another computer.

### Adding and removing

"Ajouter une manette virtuelle" adds a controller with the name you typed, or `Bot 1`, `Bot 2`...
when the field is empty. Each controller gets a box showing:

- its name, a 👑 badge when it's the host, and its state: Connexion…, En ligne, Connexion coupée
  or Refusée;
- the room it joined;
- "La console est déconnectée" while the room's console is offline;
- why the server refused it, for example `Room is full` or `Room not found`.

"Retirer" disconnects one controller for good, and "Tout retirer" disconnects them all.

### Testing a lost connection

1. "Couper la connexion" closes the controller's socket, like a phone losing the network. The
   console shows the player as disconnected.
2. "Reconnecter" comes back with the same player ID. Within 30 seconds, the player gets the same
   place back. After that, the server has removed the player, so the controller comes back as a new
   player.

Virtual controllers live in the browser tab: they disappear when you reload the page.

## Driving the game

Once a controller has joined, its box shows **the same controls as the phone controller page**,
from the same component, so they behave exactly the same:

| Room phase   | Host                                                                            | Other players                                  |
| ------------ | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| Lobby        | The selected game, the d-pad to move in the catalogue, and "OK — Lancer le jeu" | "L'hôte choisit un jeu…" and the selected game |
| Game running | "Partie en cours" and "Quitter la partie"                                       | "Partie en cours"                              |

A refusal shows the same French message as on a phone, for example "Il faut au moins 2 joueurs
pour ce jeu."

The catalogue lists the games of the server's `GAMES_DIR` folder. The root `games/` folder has no
game yet; to try the controls, start the server with the sample games of the tests:

```
GAMES_DIR=tests/fixtures/games
```

in `server/.env`. The server skips the sample packages that are broken on purpose, with a warning.

Two helpers exist only in the boxes, for developers:

- **Role and status**: the player's secret role and status, when the screen sets them.
- **Sending an action**, while a game runs: type an action name, such as `jump`, and optional JSON
  data, such as `{ "x": 1 }`, then "Envoyer l'action". The screen receives it with
  `onAction('jump', ...)`, from this player. The last 5 action names stay as buttons, to send them
  again without data.

Each box also lists the **last 5 game messages it received**: 🔒 for a message sent to this player
only (`sendToPlayer`), 📢 for a message sent to everyone (`broadcast`).

## Message log

The overlay's **Journal** tab lists the messages sent and received by:

- the console page (source "Console"), while it's open in this tab;
- each virtual controller (source: its name).

Real phones aren't in the log from their side: you see their actions as `player_action` received by
the console. The log is in the browser tab, not on the server.

Each line shows the time, the direction, the source, the socket event and the start of its data.
Click a line to see the full data.

| Symbol | Direction | Examples                                                  |
| ------ | --------- | --------------------------------------------------------- |
| ↑      | Sent      | `send_action`, `navigate_catalogue`, `broadcast_message`  |
| ↓      | Received  | `player_action`, `game_message`, `update_players`         |
| ●      | Connexion | `connect`, `disconnect`, `connect_error`, request timeout |

The answer to a request that waits for one is logged as `<event> (ack)`, for example
`start_game (ack)` with `{ "ok": false, "error": { "code": "NOT_ENOUGH_PLAYERS", ... } }`. When the
server doesn't answer within 5 seconds, `<event> (timeout)` is logged.

For example, a box sending `jump` shows `↑ send_action` from that box, then
`↓ player_action` from the console. A `broadcast` shows `↑ broadcast_message` from the console,
then `↓ game_message` on every box.

- **Filter** by source, direction, or part of the event name.
- **Pause** freezes the list so you can read or open a line while the game goes on. Recording
  continues behind it: the count of new messages shows, and "Reprendre" shows them.
- **Vider** empties the log, and **Exporter en JSON**
  downloads the messages currently shown, to attach to a bug report.
- **⧉ Ouvrir dans une fenêtre** moves the log to its own window, as for the virtual controllers.
- The log keeps the last 500 messages and shows the 200 most recent of the filtered ones. It
  survives page changes, and empties when the tab is reloaded.

Your game can read the same messages from its own SDK with `onTraffic`: see the
[SDK reference](sdk-reference.md#debugging).
