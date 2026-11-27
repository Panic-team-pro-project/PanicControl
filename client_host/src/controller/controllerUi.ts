import { PanicControlError } from 'sdk';
import type { Direction, GameManifest } from 'sdk';

export const PLAYER_ALREADY_CONNECTED = 'This player is already connected.';

export const DPAD: { direction: Direction; label: string; glyph: string }[] = [
    { direction: 'up', label: 'Haut', glyph: '▲' },
    { direction: 'left', label: 'Gauche', glyph: '◀' },
    { direction: 'right', label: 'Droite', glyph: '▶' },
    { direction: 'down', label: 'Bas', glyph: '▼' },
];

function playerNoun(n: number): string {
    return n > 1 ? 'joueurs' : 'joueur';
}

export function actionErrorMessage(err: unknown, selectedGame: GameManifest | null): string {
    if (err instanceof PanicControlError) {
        switch (err.code) {
            case 'NOT_ENOUGH_PLAYERS':
                if (!selectedGame) return 'Il faut plus de joueurs pour ce jeu.';
                return `Il faut au moins ${selectedGame.minPlayers} ${playerNoun(selectedGame.minPlayers)} pour ce jeu.`;
            case 'TOO_MANY_PLAYERS':
                if (!selectedGame) return 'Il y a trop de joueurs pour ce jeu.';
                return `Ce jeu accepte ${selectedGame.maxPlayers} ${playerNoun(selectedGame.maxPlayers)} au maximum.`;
            case 'NO_GAME_SELECTED':
                return 'Aucun jeu sélectionné.';
            case 'NOT_HOST':
                return "Seul l'hôte peut lancer ou quitter une partie.";
            case 'GAME_ALREADY_RUNNING':
                return 'Une partie est déjà en cours.';
            case 'NO_GAME_RUNNING':
                return 'Aucune partie en cours.';
            case 'TIMEOUT':
                return 'Le serveur ne répond pas. Réessaie dans un instant.';
        }
    }
    return 'Une erreur est survenue. Réessaie.';
}
