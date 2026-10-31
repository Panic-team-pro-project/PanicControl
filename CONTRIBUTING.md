# Contributing to PanicControl

Thanks for helping build PanicControl. This guide is the entry point: it explains how a change goes
from an idea to `develop`, and links to the detailed rules.

By contributing, you agree to follow the [code of conduct](CODE_OF_CONDUCT.md).

## Before you start

1. Follow the [Getting started](README.md#getting-started) steps of the README.
2. Run `npm install` at the **root** of the repository. This installs the Git hooks that check your
   code and commit messages. Without it, nothing is checked on your machine.
3. Read the team rules:
   - [docs/COMMIT_RULES.md](docs/COMMIT_RULES.md): commit messages, branch names, pull requests;
   - [docs/GOOD_PRACTICE.md](docs/GOOD_PRACTICE.md): code, Definition of Done, documentation,
     backlog, security.

## Workflow

### 1. Start from an issue

Every change starts from a GitHub issue. Open one with the right template if it doesn't exist:

- **Bug report**: something doesn't work as expected;
- **Feature request**: a new capability, written as a user story with acceptance criteria;
- **Task**: technical work with no direct user-visible change (tooling, refactoring, documentation).

Assign the issue to yourself before you start, so nobody works on the same thing.

### 2. Create a branch

Branch from an up-to-date `develop`:

```bash
git checkout develop
git pull
git checkout -b feat/player-reconnection-token
```

The name follows `<type>/<scope>-<short-description>` (see
[branch names](docs/COMMIT_RULES.md#5-branch-names)).

### 3. Commit

Make small commits, each doing one thing. Messages follow
[Conventional Commits](docs/COMMIT_RULES.md):

```
feat(player): add a reconnection token
```

On every commit, the hooks run ESLint and Prettier on the staged files and check the message. If a
check fails, the commit is not created: fix the reported problem and commit again.

### 4. Open a pull request

Push your branch and open a pull request into `develop`. The template asks for:

- **Why**: the problem it solves, with a link to the issue (`Closes #12`);
- **What changed**;
- **How it was tested**, with before and after screenshots for a visible change;
- a checklist that matches the Definition of Done.

Open it as a **draft** if it isn't ready for review yet.

### 5. Review and merge

- At least one other team member approves the pull request.
- All comments are resolved and the branch is up to date with `develop`.
- The author merges with **Squash and merge** and deletes the branch.

The issue is closed only when the change meets the
[Definition of Done](docs/GOOD_PRACTICE.md#4-definition-of-done).

## Reporting a security problem

Don't open a public issue for a vulnerability. Contact the project maintainers privately on GitHub.

## Updating the changelog

When a pull request changes something users or game developers can notice, add a line under
**Unreleased** in [CHANGELOG.md](CHANGELOG.md), in the matching section (Added, Changed, Fixed...).
