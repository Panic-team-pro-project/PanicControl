import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPositiveInteger } from '../src/config.js';

afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
});

describe('readPositiveInteger', () => {
    it('reads a whole number', () => {
        expect(readPositiveInteger('LIMIT', '2', 8)).toBe(2);
    });

    it('uses the fallback when the value is missing or empty', () => {
        expect(readPositiveInteger('LIMIT', undefined, 8)).toBe(8);
        expect(readPositiveInteger('LIMIT', '  ', 8)).toBe(8);
    });

    it('uses the fallback and warns when the value is not a whole number of at least 1', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        for (const value of ['0', '-3', '2.5', 'eight']) {
            expect(readPositiveInteger('LIMIT', value, 8)).toBe(8);
        }
        expect(warn).toHaveBeenCalledTimes(4);
    });
});

describe('MAX_PLAYERS_PER_ROOM', () => {
    it('is 8 when the variable is not set', async () => {
        vi.stubEnv('MAX_PLAYERS_PER_ROOM', '');

        const { MAX_PLAYERS_PER_ROOM } = await import('../src/config.js');

        expect(MAX_PLAYERS_PER_ROOM).toBe(8);
    });

    it('comes from the environment, and becomes the limit of new rooms', async () => {
        vi.stubEnv('MAX_PLAYERS_PER_ROOM', '2');

        const { MAX_PLAYERS_PER_ROOM } = await import('../src/config.js');
        const { Room } = await import('../src/realtime/room.js');

        expect(MAX_PLAYERS_PER_ROOM).toBe(2);
        expect(new Room('ABC123', 'console-socket').maxPlayers).toBe(2);
    });
});
