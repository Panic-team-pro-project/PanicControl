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
