# Games

Each game is a package: a folder `games/<id>/` that holds a `manifest.json` and the two pages of the
game (one for the shared screen, one for the phones).

```text
games/color-rush/
├── manifest.json
├── screen.html
└── controller.html
```

- The folder name must be the game `id`.
- The server reads every package at startup. Restart it to reload the catalogue.
- A package with a missing or invalid manifest is skipped, with one warning in the server logs.

Full reference: [docs/game-dev/manifest.md](../docs/game-dev/manifest.md). To build a game, follow
the [tutorial](../docs/game-dev/tutorial.md).
