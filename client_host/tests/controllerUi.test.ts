import { describe, expect, it } from 'vitest';
import { PanicControlError } from 'sdk';
import type { GameManifest } from 'sdk';
import { DPAD, actionErrorMessage } from '../src/controller/controllerUi';

const DUO: GameManifest = {
    id: 'duo',
    name: 'Duo',
    version: '1.0.0',
    minPlayers: 2,
    maxPlayers: 2,
    durationMinutes: 5,
    controllerComponents: ['button'],
    accessibilityFeatures: [],
    entry: { screen: 'screen.html', controller: 'controller.html' },
};

const SOLO: GameManifest = { ...DUO, id: 'solo', name: 'Solo', minPlayers: 1, maxPlayers: 1 };

function refused(code: ConstructorParameters<typeof PanicControlError>[0]) {
    return new PanicControlError(code, 'server message');
}

describe('actionErrorMessage', () => {
    it("explains the selected game's player count", () => {
        expect(actionErrorMessage(refused('NOT_ENOUGH_PLAYERS'), DUO)).toBe(
            'Il faut au moins 2 joueurs pour ce jeu.',
        );
        expect(actionErrorMessage(refused('TOO_MANY_PLAYERS'), DUO)).toBe(
            'Ce jeu accepte 2 joueurs au maximum.',
        );
    });

    it('uses the singular for one player', () => {
        expect(actionErrorMessage(refused('NOT_ENOUGH_PLAYERS'), SOLO)).toBe(
            'Il faut au moins 1 joueur pour ce jeu.',
        );
        expect(actionErrorMessage(refused('TOO_MANY_PLAYERS'), SOLO)).toBe(
            'Ce jeu accepte 1 joueur au maximum.',
        );
    });

    it('stays general when no game is selected', () => {
        expect(actionErrorMessage(refused('NOT_ENOUGH_PLAYERS'), null)).toBe(
            'Il faut plus de joueurs pour ce jeu.',
        );
        expect(actionErrorMessage(refused('TOO_MANY_PLAYERS'), null)).toBe(
            'Il y a trop de joueurs pour ce jeu.',
        );
    });

    it('translates the other refusals', () => {
        expect(actionErrorMessage(refused('NO_GAME_SELECTED'), null)).toBe(
            'Aucun jeu sélectionné.',
        );
        expect(actionErrorMessage(refused('NOT_HOST'), null)).toBe(
            "Seul l'hôte peut lancer ou quitter une partie.",
        );
        expect(actionErrorMessage(refused('GAME_ALREADY_RUNNING'), null)).toBe(
            'Une partie est déjà en cours.',
        );
        expect(actionErrorMessage(refused('NO_GAME_RUNNING'), null)).toBe(
            'Aucune partie en cours.',
        );
        expect(actionErrorMessage(refused('TIMEOUT'), null)).toBe(
            'Le serveur ne répond pas. Réessaie dans un instant.',
        );
    });

    it('falls back to a general message for anything else', () => {
        expect(actionErrorMessage(new Error('boom'), DUO)).toBe(
            'Une erreur est survenue. Réessaie.',
        );
        expect(actionErrorMessage(refused('BAD_RESPONSE'), DUO)).toBe(
            'Une erreur est survenue. Réessaie.',
        );
    });
});

describe('DPAD', () => {
    it('has the 4 directions, each with a French label', () => {
        expect(DPAD.map((button) => button.direction).sort()).toEqual([
            'down',
            'left',
            'right',
            'up',
        ]);
        expect(DPAD.every((button) => button.label.length > 0)).toBe(true);
    });
});
