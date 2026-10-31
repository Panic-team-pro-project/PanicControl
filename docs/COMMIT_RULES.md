# Commit Rules

Status: In review, Sprint 1 Applies to: every commit, branch and pull request in this repository

This project follows the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
specification. It is **checked automatically**: a commit whose message breaks the rules below is
rejected.

## 1. Commit message format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

- **type**: required, lowercase, one of the types listed below.
- **scope**: optional, the part of the project the change touches.
- **description**: required, short, in the imperative mood (`add`, not `added` or `adds`), no capital letter at the start

The first line (the header) must not exceed **100 characters**.

one commit does one thing; if the description needs an "and", split the commit.

## 2. Types

| Type       | When to use it                                                           |
| ---------- | ------------------------------------------------------------------------ |
| `feat`     | A new user-visible capability                                            |
| `fix`      | A bug fix                                                                |
| `docs`     | Documentation only                                                       |
| `style`    | Formatting with no change in behavior (indentation, Prettier...)         |
| `refactor` | Changing code structure without changing behaviour                       |
| `perf`     | A change made for performance                                            |
| `test`     | Adding or changing tests only                                            |
| `build`    | Build system, dependencies, Dockerfile                                   |
| `ci`       | Pipeline configuration                                                   |
| `chore`    | Maintenance that touches neither source code nor tests (config, tooling) |
| `revert`   | Reverting a previous commit                                              |

Any other type (`update:`, `wip:`, `Fix:`...) is rejected.

## 3. Scopes

The scope is the part of the product touched. Use one of the scopes below; any other scope is
rejected.

### Product domains

| Scope        | What it covers                                                            |
| ------------ | ------------------------------------------------------------------------- |
| `room`       | Room lifecycle: creation, room codes, capacity, inactivity cleanup        |
| `player`     | Joining, reconnection, disconnect grace period, player list               |
| `moderation` | Player name validation, profanity filter                                  |
| `protocol`   | Socket event names and payloads shared by the server and the SDK          |
| `sdk`        | Public API that games use (`ConsoleSDK`, `ControllerSDK`, exported types) |
| `console`    | Host screen: creating a room, QR code, lobby                              |
| `controller` | Phone controller: join form, buttons, feedback                            |
| `game`       | Game rules and content of a specific game                                 |
| `web`        | Frontend shell: routing, home page, layout, global styles                 |
| `api`        | HTTP routes                                                               |

### Project-wide

| Scope     | What it covers                                         |
| --------- | ------------------------------------------------------ |
| `deps`    | Dependency updates across one or several packages      |
| `docs`    | Project documentation (README, `docs/` folder, guides) |
| `adr`     | Architecture Decision Records                          |
| `docker`  | Dockerfiles, Compose files and container setup         |
| `release` | Versioning and release preparation                     |

When a change touches several domains, use the one the change is _about_. For example, adding a
"player left" event touches `protocol`, `server` and `sdk` files, but the change is about players:
`feat(player): notify the console when a player leaves`.

Scope is optional but expected. Omit it only when a change genuinely spans everything, for example chore: normalise line endings.

These scopes describe the domain rather than the framework, so they stay valid whatever the code underneath is built with.

## 4. Body and footer

Use the body to explain **why** the change is made, when that isn't obvious. Separate it from the
header with a blank line, and keep its lines under 100 characters.

Use the footer to reference issues (`Refs: #12`) or to flag a breaking change.

### Breaking changes

If the change breaks compatibility (for example a renamed socket event, or an SDK method whose
signature changes), flag it either with `!` after the type or with a `BREAKING CHANGE:` footer:

```
feat(sdk)!: send errors as Error objects instead of strings

BREAKING CHANGE: ConsoleSDK.createRoom now rejects with the server message
instead of "[object Object]".
```

## Examples

Accepted:

```
feat(sdk): add sendAction to ControllerSDK
fix(player): broadcast playerId instead of socketId in player list
fix(web): load main.tsx from index.html
fix(room): close the room when the host disconnects
refactor(player): merge join and reconnect handlers
feat(moderation): reject names made only of emojis
docs: add commit convention
chore: setup eslint, prettier and husky
docs(adr): record the choice of socket.io for realtime
build(docker): add a production image for the server
build(deps): bump socket.io-client to 4.8.4
```

Rejected:

| Message                         | Reason                                   |
| ------------------------------- | ---------------------------------------- |
| `add to lint`                   | No type                                  |
| `Fix: room capacity`            | Uppercase type                           |
| `fix: Room capacity`            | Description starts with a capital letter |
| `fix: room capacity.`           | Trailing period                          |
| `update: change the controller` | Unknown type                             |
| `feat:`                         | Empty description                        |
| `fix(server): room capacity`    | Unknown scope (folder, not domain)       |

## What happens when you commit

The checks run as Git hooks ([Husky](https://typicode.github.io/husky/)), installed automatically by
`npm install` at the repository root.

1. **pre-commit**: [lint-staged](https://github.com/lint-staged/lint-staged) runs on staged files
   (`git add`):
   - `eslint --fix` on `.ts`, `.tsx`, `.js` and `.jsx` files. The commit is rejected if any error
     **or warning** remains;
   - `prettier --write` to format code, JSON, Markdown, CSS and HTML.
2. **commit-msg**: [commitlint](https://commitlint.js.org/) checks the message against the rules in
   this document.

If either check fails, the commit is not created. Fix the reported problem, then run the same
`git commit` command again.

### Check a message without committing

```bash
echo "fix(room): handle host disconnect" | npx commitlint
```

### Skipping the hooks

`git commit --no-verify` turns the checks off. **Don't use it** except in a real emergency: the
non-compliant code will have to be fixed afterwards anyway.

## 5. Branch names

### Long-lived branches

| Branch    | Role                                                                                  |
| --------- | ------------------------------------------------------------------------------------- |
| `main`    | Stable code. Only receives merges from `develop` (releases) or hotfixes.              |
| `develop` | Integration branch. Every feature and fix branch starts from here and goes back here. |

Nobody pushes directly to `main` or `develop`: every change goes through a pull request.

### Working branches

```
<type>/<scope>-<short-description>
```

- **type**: the same types as commits (`feat`, `fix`, `refactor`, `docs`, `build`...).
- **scope**: one of the scopes from section 3. Leave it out when the commit would have no scope.
- **short-description**: a few words, lowercase, words separated by hyphens (kebab-case).
- Only lowercase letters, digits, hyphens and one `/`. No spaces, underscores or accents.

Examples:

```
feat/player-reconnection-token
fix/room-host-disconnect
refactor/sdk-merge-join-handlers
docs/adr-realtime-transport
build/docker-server-image
chore/setup-eslint
```

Rejected:

| Branch                   | Reason                              |
| ------------------------ | ----------------------------------- |
| `feature/sdk_foundation` | `feature` is not a type, underscore |
| `fix-room`               | No `/` between type and description |
| `Fix/Room-Capacity`      | Uppercase letters                   |
| `sofiane/test`           | Person name instead of a type       |

### Hotfixes

An urgent fix for `main` starts from `main` and is named `hotfix/<scope>-<short-description>`. Once
merged into `main`, merge `main` back into `develop` so the fix isn't lost.

### Lifetime

Keep branches short-lived: a branch should be merged within a few days. Delete it once its pull
request is merged.

## 6. Pull requests

### Target branch

| From                | Into      |
| ------------------- | --------- |
| Any working branch  | `develop` |
| `develop` (release) | `main`    |
| `hotfix/...`        | `main`    |

### Title

The pull request title follows the **same format as a commit message**, because it becomes the
commit message when the pull request is squashed into the target branch:

```
feat(player): add a reconnection token
```

### Description

The description follows the template in
[.github/pull_request_template.md](../.github/pull_request_template.md), which GitHub fills in
automatically:

- **What**: what the pull request changes.
- **Why**: the problem it solves, with a link to the issue (`Closes #12`).
- **How to test**: the steps a reviewer follows to check it works.
- **Checklist**: lint passes, documentation updated, breaking changes flagged.

### Size

One pull request = one feature or one fix. Aim for less than about 400 changed lines; past that,
split it. Formatting-only changes (`style:`) go in their own pull request so they don't hide the real
diff.

### Review and merge

- At least **one approval** from another team member is required.
- The author doesn't approve their own pull request.
- All review comments are resolved before merging.
- The branch is up to date with its target branch.
- Pull requests into `develop` are merged with **Squash and merge**, so each pull request becomes one
  commit on `develop`. Pull requests into `main` use **Create a merge commit**, so the history of
  `develop` is kept.
- The author merges, then deletes the branch.

### Draft pull requests

Open a pull request as a **draft** to share work in progress or ask for early feedback. Mark it
"Ready for review" only when it meets the rules above.
