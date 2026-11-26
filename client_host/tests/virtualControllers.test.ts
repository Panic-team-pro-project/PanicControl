import { describe, expect, it } from 'vitest';
import {
    PHASE_LABELS,
    newController,
    nextBotName,
    normalizeRoomCode,
} from '../src/devtools/virtualControllers';

describe('newController', () => {
    it('starts joining its room, not connected and not host', () => {
        expect(newController(3, 'Bot 1', 'ABC123')).toEqual({
            id: 3,
            name: 'Bot 1',
            roomCode: 'ABC123',
            playerId: null,
            phase: 'joining',
            connected: false,
            isHost: false,
            consoleOnline: true,
            error: '',
        });
    });
});

describe('nextBotName', () => {
    it('starts at Bot 1', () => {
        expect(nextBotName([])).toBe('Bot 1');
    });

    it('takes the first free number', () => {
        expect(nextBotName(['Bot 1', 'Bot 2'])).toBe('Bot 3');
        expect(nextBotName(['Bot 1', 'Bot 3'])).toBe('Bot 2');
    });

    it('ignores names that are not bot names', () => {
        expect(nextBotName(['Mario', 'Bot 1'])).toBe('Bot 2');
    });
});

describe('normalizeRoomCode', () => {
    it('removes the spaces around and puts the code in capitals', () => {
        expect(normalizeRoomCode('  abc123 ')).toBe('ABC123');
    });

    it('stays empty when nothing was typed', () => {
        expect(normalizeRoomCode('   ')).toBe('');
    });
});

describe('PHASE_LABELS', () => {
    it('has a French label for every phase', () => {
        expect(Object.keys(PHASE_LABELS).sort()).toEqual([
            'failed',
            'joined',
            'joining',
            'offline',
        ]);
    });
});
