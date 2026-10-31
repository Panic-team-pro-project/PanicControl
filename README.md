# PanicControl

PanicControl is a party-game platform where a shared screen hosts the game and players use their
phones as controllers. The host screen creates a room and shows a QR code; players scan it, pick a
name and play, with no app to install.

> Status: early development. Rooms, joining and reconnection work; gameplay is not implemented yet.

## How it works

```
 Phone (controller)  ──┐
 Phone (controller)  ──┼── Socket.IO ──  Server  ── Socket.IO ──  Shared screen (console)
 Phone (controller)  ──┘                 rooms, players            room code, QR code, game
```

1. The **console** (shared screen) asks the server to create a room and gets a 6-character code.
2. It shows the code and a QR code pointing to the controller page.
3. Each **controller** (phone) joins with the code and a player name.
4. The server keeps the room state and sends updates (player list, disconnections) to everyone.

A player who loses the connection has 30 seconds to come back and keep their place. A room with no
activity for 15 minutes is closed.

## Repository layout

| Folder         | Package       | Role                                                                     |
| -------------- | ------------- | ------------------------------------------------------------------------ |
| `server/`      | `server`      | Node.js server: rooms, players, name filtering (Express, Socket.IO)      |
| `sdk/`         | `sdk`         | Client library for games: `ConsoleSDK` (screen), `ControllerSDK` (phone) |
| `common/`      | `common`      | Socket event names shared by the server and the SDK                      |
| `client_host/` | `client_host` | React web app: home page, console and controller pages (Vite)            |
| `docs/`        |               | Team rules: commits, branches, pull requests, good practice              |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 22.9 or later
- npm 10 or later

### Install

Each package has its own dependencies. From the repository root:

```bash
npm install                     # lint tools and Git hooks
cd server && npm install && cd ..
cd sdk && npm install && npm run build && cd ..
cd client_host && npm install && cd ..
```

The SDK must be built (`npm run build` in `sdk/`) before the web app can use it. Rebuild it after
changing its code, or keep `npm run dev` running in `sdk/` to rebuild on every change.

### Configure

Both the server and the web app work without configuration on one computer. To change a setting,
copy the example file and edit it:

```bash
cp server/.env.example server/.env
cp client_host/.env.example client_host/.env
```

Each variable is documented in its `.env.example` file.

### Run

In two terminals:

```bash
cd server && npm run dev          # http://localhost:3000
```

```bash
cd client_host && npm run dev     # http://localhost:5173
```

Open http://localhost:5173, pick a game and create a room.

### Play with real phones

Phones must reach your computer over the local network:

1. Start the web app with `npm run dev -- --host` so Vite listens on the network, not only on
   `localhost`.
2. Open the console page using your computer's network address (for example
   `http://192.168.1.20:5173`), not `localhost`. The QR code uses that address, and the controllers
   find the server on the same host, port 3000.
3. Phones and computer must be on the same Wi-Fi network, and the firewall must allow ports 3000 and 5173.

## Scripts

At the repository root:

| Command                | What it does                               |
| ---------------------- | ------------------------------------------ |
| `npm run lint`         | Lint every package with ESLint             |
| `npm run lint:fix`     | Lint and fix what can be fixed             |
| `npm run format`       | Format every file with Prettier            |
| `npm run format:check` | Check formatting without changing anything |

In each package, `npm run dev` starts it in watch mode and `npm run build` builds it.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before your first contribution. In short: every change starts
from an issue, goes on its own branch, uses [Conventional Commits](docs/COMMIT_RULES.md), and is
merged into `develop` through a reviewed pull request.

- [Commit, branch and pull request rules](docs/COMMIT_RULES.md)
- [Good practice](docs/GOOD_PRACTICE.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Changelog](CHANGELOG.md)

## License

Proprietary, all rights reserved. See [LICENSE](LICENSE).
