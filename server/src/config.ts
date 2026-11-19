import path from 'node:path';

// Server settings, read from the environment. See .env.example for each variable.

export const DEFAULT_MAX_PLAYERS_PER_ROOM = 8;

// A whole number of at least 1, or the fallback when the value is missing or invalid
export function readPositiveInteger(
    name: string,
    value: string | undefined,
    fallback: number,
): number {
    if (value === undefined || value.trim() === '') {
        return fallback;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        console.warn(`⚠️ ${name}=${value} is not a whole number of at least 1, using ${fallback}.`);
        return fallback;
    }

    return parsed;
}

export const MAX_PLAYERS_PER_ROOM = readPositiveInteger(
    'MAX_PLAYERS_PER_ROOM',
    process.env.MAX_PLAYERS_PER_ROOM,
    DEFAULT_MAX_PLAYERS_PER_ROOM,
);

export const DEFAULT_MAX_MESSAGE_BYTES = 65536;

// Largest JSON payload (in bytes) accepted for a game action or message
export const MAX_MESSAGE_BYTES = readPositiveInteger(
    'MAX_MESSAGE_BYTES',
    process.env.MAX_MESSAGE_BYTES,
    DEFAULT_MAX_MESSAGE_BYTES,
);

// Folder holding the game packages, resolved from the working directory
export const GAMES_DIR = path.resolve(process.cwd(), process.env.GAMES_DIR || '../games');
