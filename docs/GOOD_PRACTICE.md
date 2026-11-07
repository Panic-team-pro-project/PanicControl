# Good Practice

Status: In review, Sprint 1 Applies to: all code, documentation and project work in this repository
(`server/`, `sdk/`, `common/`, `client_host/`).

These rules come from real problems found in the codebase. ESLint, Prettier and commitlint enforce
some of them automatically; the rest rely on review.

## 1. Principles

- **English everywhere** in the repository: code, comments, logs, documentation, commits, pull
  requests. Text shown to players can be in any language.
- **Small, finished steps.** A change is small enough to review in one sitting and is either done or
  not merged. No half-finished feature on `develop`.
- **The server is the source of truth.** Clients display and request; the server decides identities,
  room state and game rules.
- **One place for each thing.** Shared types and event names live in `common/`, configuration in
  environment variables, decisions in ADRs. Nothing is copied between packages.
- **No dead code.** Don't commit commented-out code, unused imports or debug logs. Git keeps the
  history.
- **No magic values.** Durations, limits and URLs go in named constants or configuration:

  ```ts
  // Bad
  if (this.players.length >= 2) {

  // Good
  const MAX_PLAYERS_PER_ROOM = 8;
  if (this.players.length >= MAX_PLAYERS_PER_ROOM) {
  ```

- **Comments explain why, not what.** If a comment and the code disagree (`>= 2 // 8 players limit`),
  one of them is wrong: fix it.

## 2. Naming

| Element                         | Convention         | Example                     |
| ------------------------------- | ------------------ | --------------------------- |
| Variables, functions, methods   | `camelCase`        | `generateRoomCode`          |
| Classes, types, interfaces      | `PascalCase`       | `RoomManager`, `PlayerInfo` |
| React components and their file | `PascalCase`       | `BonjourMartin.tsx`         |
| Other TypeScript files          | `camelCase`        | `roomManager.ts`            |
| Constants                       | `UPPER_SNAKE_CASE` | `ROOM_INACTIVITY_THRESHOLD` |
| Socket event values             | `snake_case`       | `'player_joined'`           |
| Booleans                        | `is`/`has`/`can`   | `isConnected`, `hasJoined`  |
| Documentation files             | `UPPER_SNAKE_CASE` | `COMMIT_RULES.md`           |
| ADR files                       | `NNNN-kebab-case`  | `0001-use-socket-io.md`     |

Names describe what something is, not how it's implemented: `players`, not `playerArray`.

Branch, commit and scope names follow [COMMIT_RULES.md](COMMIT_RULES.md).

## 3. Branching and pull requests

The full rules are in [COMMIT_RULES.md](COMMIT_RULES.md) (sections 5 and 6). In short:

- Work on a branch named `<type>/<scope>-<short-description>`, created from `develop`.
- Nobody pushes directly to `main` or `develop`.
- Open a pull request into `develop`, titled like a commit message, using the template.
- At least one approval from someone other than the author; all comments resolved before merging.
- Squash and merge, then delete the branch.

When reviewing, check at least:

- the change does what the description says, and nothing more;
- the rules of this document are followed;
- the protocol, the server and the SDK stay consistent with each other;
- the code can be understood without the author explaining it.

## 4. Definition of Done

A story is **done** only when every point below is true.

- [ ] reviewed through a pull request with at least one approval
- [ ] unit tests covering the business logic introduced
- [ ] each suite's coverage floor met
- [ ] code-quality gate passes
- [ ] full CI pipeline passes
- [ ] required build artifact or Docker image produced
- [ ] associated documentation updated
- [ ] demonstrated at the Sprint Review

## 5. Code quality and testing

**The gate is automated and blocking.** Linter, formatter, tests and coverage run in CI on
every pull request. A red pipeline blocks merge. Nobody merges past a failing gate.

**Format automatically, never by hand or in review.** Formatting arguments in a review are
wasted time.

**Test shape.** Many fast unit tests on business logic, fewer integration tests across the
API and database, a small number of end-to-end tests on the critical path. The audit shows
what happens without integration tests: four route tests that mock everything and cannot
catch three real defects in the code they cover.

**Test behaviour, not implementation.** A test that breaks when you rename a private
function is a maintenance cost with no benefit.

**A bug fix starts with a failing test.** Write the test that reproduces it, then fix it.
That test is the guarantee it does not come back.

## 6. Documentation and decisions

### Architecture Decision Records (ADR)

Write an ADR when a decision is hard to reverse or affects several packages: choosing a library or
transport, changing the protocol, changing how players are identified, choosing a hosting setup.

- One file per decision: `docs/adr/NNNN-short-title.md`, numbered in order (`0001`, `0002`...).
- Commit it with the `adr` scope: `docs(adr): record the choice of socket.io`.
- An accepted ADR is never edited to change its meaning. A new decision gets a new ADR that marks the
  old one as **Superseded by NNNN**.

Template:

```markdown
# NNNN. Title

Status: Proposed | Accepted | Superseded by NNNN Date: YYYY-MM-DD

## Context

What problem we face and what constrains the choice.

## Options

The options considered, with their pros and cons.

## Decision

What we chose.

## Consequences

What becomes easier, what becomes harder, what we must do next.
```

## 7. Backlog and Scrum practice

Stories follow INVEST: independent, negotiable, valuable, estimable, small, testable. A story that cannot be demonstrated is not a story; it is a task.

Format: As a <role>, I want <capability>, so that <benefit>. Acceptance criteria listed underneath, written before work starts.

MoSCoW is a commitment, not a wish list. Must have items are the contract. Do not start a Should have while a Must have is unfinished. Anything outside the agreed scope goes to Would have and is documented as future work rather than improvised in.

Ceremonies: daily stand-up, sprint planning, sprint review, retrospective. The Scrum Master rotates between team members across the project, so each rotation hands over the board state and any open impediments in writing.

The board reflects reality. Move your card when you start, not at the end of the day. Work in progress stays low; finishing beats starting.

The retrospective produces actions, not feelings. One or two concrete changes, with an owner, checked at the next retrospective.

## 8. Security and data protection baseline

### Secrets and configuration

- **Configuration comes from environment variables**, never from values written in the code. Each
  package documents its variables in a `.env.example` file; real `.env` files are never committed.
- **Never commit or log secrets** (tokens, passwords, keys). A secret pushed by mistake is considered
  leaked: rotate it, removing it from the code is not enough.

### Input and identity

- **Never trust the client.** Validate every value received from a socket or HTTP request (type,
  length, format) before using it. A missing or wrong value is answered with an error, not a crash.
- **The server decides identities.** Player IDs, room codes and roles are generated and checked on
  the server. A client-supplied ID is only accepted if it proves something (for example a secret
  reconnection token), never just because it exists.
- **Don't send other players' secrets.** Reconnection tokens are sent only to their owner, never in
  the player list.
- **Player names are filtered** for offensive content before being shown to anyone.

### Network

- **Restrict CORS** to the known frontend origins instead of `'*'` outside local development.
- **Use HTTPS and WSS** in any deployed environment.
- **Limit abuse**: cap the number of rooms per connection and the rate of messages per socket.

### Personal data

Players are often minors, so the project collects as little as possible.

- **Collect only what the game needs**: a display name and a technical player ID. No email, no
  account, no location.
- **Keep data only as long as the room exists.** Room and player data is deleted when the room closes;
  it is never written to disk or a database without a documented decision (ADR).
- **Browser storage holds only technical data** (the reconnection ID), never personal information.
- **Logs contain identifiers, not personal data**: room codes and player IDs, not names typed by
  players.

### Dependencies

- **Keep dependencies up to date** and check `npm audit` before each release. High and critical
  vulnerabilities are fixed before merging into `main`.
- **Add a dependency only when it's needed**, and prefer maintained, widely used packages.
