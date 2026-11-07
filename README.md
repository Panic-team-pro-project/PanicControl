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

## Getting Started

### Prerequisites

| To...                      | You need                                                                  |
| -------------------------- | ------------------------------------------------------------------------- |
| Run the platform           | [Docker](https://docs.docker.com/get-docker/) with Docker Compose         |
| Develop or run it natively | [Node.js](https://nodejs.org/) 22.9 or later and npm 10 or later          |
| Contribute                 | Node.js and npm, even if you run the platform with Docker (for Git hooks) |

### Clone and set up

```bash
git clone https://github.com/Panic-team-pro-project/PanicControl.git
cd PanicControl
npm install    # lint tools and Git hooks
```

The root `npm install` enables the hooks that check your code and commit messages. Run it even if you
only use Docker.

Then pick how to run the platform: [with Docker](#run-with-docker) to try it, or
[without Docker](#run-without-docker) to develop with hot reload.

## Run with Docker

The whole platform runs with Docker Compose, without installing Node.js:

```bash
docker compose up --build
```

| Service  | URL                   | Image                                          |
| -------- | --------------------- | ---------------------------------------------- |
| `web`    | http://localhost:8080 | Web app built with Vite, served by nginx       |
| `server` | http://localhost:3000 | Node.js server, bundled with its `common` code |

Open http://localhost:8080, pick a game and create a room. Stop everything with `docker compose down`.

To change the ports or the URLs used by phones, copy `.env.example` to `.env` at the repository root
and edit it. Server settings go in `server/.env`. The web app's `VITE_` variables are written into the
JavaScript when the image is built, so run `docker compose up --build` after changing them.

To play with real phones, open the console page with your computer's network address (for example
`http://192.168.1.20:8080`) instead of `localhost`.

## Run without Docker

### Install

Each package has its own dependencies. From the repository root:

```bash
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

Open http://localhost:5173, pick a game and create a room. Both restart or reload automatically when
you change the code.

### Play with real phones

Phones must reach your computer over the local network:

1. Start the web app with `npm run dev -- --host` so Vite listens on the network, not only on
   `localhost`.
2. Open the console page using your computer's network address (for example
   `http://192.168.1.20:5173`), not `localhost`. The QR code uses that address, and the controllers
   find the server on the same host, port 3000.
3. Phones and computer must be on the same Wi-Fi network, and the firewall must allow ports 3000 and 5173.

## Before you push

The Git hooks check each commit, but only the files in it. Before pushing a branch or opening a pull
request, check the whole project:

1. **Update your branch** with the latest `develop`:

   ```bash
   git fetch origin
   git rebase origin/develop
   ```

2. **Lint and format** from the repository root:

   ```bash
   npm run lint
   npm run format:check
   ```

3. **Build every package you changed**, which also type-checks it:

   ```bash
   cd server && npm run build
   cd sdk && npm run build
   cd client_host && npm run build
   ```

4. **Try it for real**: create a room on the console page and join it from at least one controller.
   If you changed a Dockerfile or a dependency, also run `docker compose up --build`.
5. **Check your commits and branch name** follow the [commit rules](docs/COMMIT_RULES.md), and that
   `CHANGELOG.md` and the documentation are updated if needed.

Then push and open a pull request into `develop`.

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
