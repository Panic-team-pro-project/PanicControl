# Tutorial: build a small multiplayer game (preview)

We build **Quick Vote**: the screen asks a question, phones vote, one random player is secretly the
**spy** and sees a different question, then the screen shows the results.

> **Preview.** Game pages (`entry.screen` and `entry.controller`) are validated but **not loaded
> yet**: the platform shows a waiting panel instead of your pages. What works today: manifest
> validation, the catalogue, launching a game from the host's phone, and the SDK messaging API
> (covered end to end by `server/tests/realtime/socketManager.test.ts`). In the code below, `sdk`
> and `pad` are "the instance provided to your page by the platform". A game never creates a room
> or opens its own connection. How the instance is handed over comes with iframe isolation
> ([ADR 0001](../adr/0001-game-packages-and-launch.md)).

Read the [SDK reference](sdk-reference.md) for any member used here.

## 1. Create the package

```text
games/quick-vote/
├── manifest.json
├── screen.html
└── controller.html
```

`games/quick-vote/manifest.json`:

```json
{
  "id": "quick-vote",
  "name": "Quick Vote",
  "version": "1.0.0",
  "minPlayers": 3,
  "maxPlayers": 8,
  "durationMinutes": 5,
  "controllerComponents": ["choice"],
  "accessibilityFeatures": ["textSize"],
  "entry": { "screen": "screen.html", "controller": "controller.html" },
  "description": "Vote on a question. One of you has a different one."
}
```

See [manifest.md](manifest.md) for every rule.

## 2. Share the types

A small file imported by both pages:

```ts
// types.ts
export type Actions = { vote: { choice: number } };

export type Messages = {
  question: { text: string; choices: string[] };
  secretQuestion: { text: string; choices: string[] };
  results: { counts: number[] };
};
```

`vote` is an action (phone to screen). The three others are messages (screen to phones).

## 3. The screen

```ts
import { ConsoleSDK, PanicControlError } from 'sdk';
import type { Actions, Messages } from './types';

// Provided to your page by the platform.
declare const sdk: ConsoleSDK<Actions, Messages>;

const choices = ['Pizza', 'Burger', 'Salad'];
const question = { text: 'Best meal?', choices };
const secret = { text: 'Which meal would you hide?', choices };

let players: { playerId: string; isConnected: boolean }[] = [];
let votes = new Map<string, number>();

sdk.onUpdatePlayers((list) => {
  players = list;
});

sdk.onGameStarted(async () => {
  votes = new Map();
  const connected = players.filter((p) => p.isConnected);
  const spy = connected[Math.floor(Math.random() * connected.length)];
  if (!spy) return;

  try {
    await sdk.setPlayerRole(spy.playerId, 'spy');
    sdk.broadcast('question', question);
    await sdk.sendToPlayer(spy.playerId, 'secretQuestion', secret);
  } catch (e) {
    if (e instanceof PanicControlError) {
      console.warn(`Could not brief the spy: ${e.code}`);
    }
  }
});

sdk.onAction('vote', (playerId, data) => {
  if (!Number.isInteger(data.choice) || data.choice < 0 || data.choice >= choices.length) return;
  votes.set(playerId, data.choice);

  const connected = players.filter((p) => p.isConnected).length;
  if (votes.size >= connected) {
    const counts = choices.map(() => 0);
    for (const choice of votes.values()) counts[choice] = (counts[choice] ?? 0) + 1;
    sdk.broadcast('results', { counts });
  }
});
```

Points to note:

- The server sets `playerId` on actions, but the `data` comes from the phone: validate it again
  (the check on `data.choice`).
- `broadcast` also reaches the spy. The spy page ignores the normal question (next step).
- The spy role is private: the other phones never see it. Do not print it on the shared screen.
- Draw the question and the results with the library you like, in large readable text.

## 4. The controller

```ts
import type { ControllerSDK } from 'sdk';
import type { Actions, Messages } from './types';

// Provided to your page by the platform.
declare const pad: ControllerSDK<Actions, Messages>;

const roleLabel = document.querySelector('#role') as HTMLElement;
const questionLabel = document.querySelector('#question') as HTMLElement;
const answers = document.querySelector('#answers') as HTMLElement;

function showQuestion(text: string, choices: string[]): void {
  questionLabel.textContent = text;
  answers.replaceChildren(
    ...choices.map((label, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.style.minWidth = '44px';
      button.style.minHeight = '44px';
      button.addEventListener('click', () => {
        pad.sendAction('vote', { choice: index });
        answers.querySelectorAll('button').forEach((b) => (b.disabled = true));
      });
      return button;
    }),
  );
}

pad.onPlayerStateChanged(({ role }) => {
  roleLabel.textContent = role === 'spy' ? 'You are the spy' : '';
});

pad.onMessage('question', (data) => {
  if (pad.role === 'spy') return;
  showQuestion(data.text, data.choices);
});

pad.onMessage('secretQuestion', (data, meta) => {
  if (meta.isPrivate) showQuestion(data.text, data.choices);
});

pad.onMessage('results', (data) => {
  questionLabel.textContent = `Results: ${data.counts.join(' / ')}`;
  answers.replaceChildren();
});
```

The matching HTML needs the three elements, for example:

```html
<p id="role" aria-live="polite"></p>
<h1 id="question" aria-live="polite"></h1>
<div id="answers" role="group" aria-labelledby="question"></div>
```

Accessibility: buttons are at least 44 by 44 px, the role and the question are in `aria-live`
regions so a screen reader announces them, and the vote does not depend on colour.

## 5. Test it today

1. Put the folder in `games/` and restart the server. A warning in the logs names the problem if the
   manifest or an entry file is invalid.
2. Open the console, join with three phones, and check that Quick Vote appears in the catalogue
   with its player range, duration and accessibility features.
3. From the host's phone, select it and start it. With fewer than 3 players you get
   `NOT_ENOUGH_PLAYERS`.
4. Your pages are not shown yet. To exercise the code above, see how
   `server/tests/realtime/socketManager.test.ts` drives a console and controllers with the real SDK.

## What changes when game pages are loaded

- The platform will load `entry.screen` and `entry.controller` in isolated frames and hand each page
  its SDK instance. The `declare const` lines will be replaced by that mechanism.
- Controller layouts will be rendered from `controllerComponents`.
- Games will be able to read accessibility options and use vibration and sensors with a touch
  fallback.
- The code of steps 3 and 4 should not need changes.

## Not yet available

- Loading and running your pages in the platform.
- Scores, turns, pause, achievements and an end screen provided by the platform.
- Developer mode (controller simulator, message log, latency) to test without real phones.
