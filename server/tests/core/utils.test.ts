import { afterEach, describe, expect, it, vi } from 'vitest';
import { generatePlayerId, generateRoomCode } from '../../src/core/utils.js';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('generateRoomCode', () => {
    it('always returns 6 characters, without 0, O, 1 or I', () => {
        for (let i = 0; i < 1000; i++) {
            expect(generateRoomCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
        }
    });

    it('returns a different code each time', () => {
        const codes = new Set(Array.from({ length: 100 }, () => generateRoomCode()));

        expect(codes.size).toBe(100);
    });
});

describe('generatePlayerId', () => {
    it('returns 8 lowercase letters or digits', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

        expect(generatePlayerId()).toMatch(/^[a-z0-9]{8}$/);
    });

    it('returns a different ID for a different random value', () => {
        vi.spyOn(Math, 'random').mockReturnValueOnce(0.123456789).mockReturnValueOnce(0.987654321);

        expect(generatePlayerId()).not.toBe(generatePlayerId());
    });
});
