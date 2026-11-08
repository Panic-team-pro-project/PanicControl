import { describe, expect, it } from 'vitest';
import { validatePlayerName } from './pseudoFilter.js';

describe('validatePlayerName', () => {
    it('accepts a normal name', () => {
        expect(validatePlayerName('Luigi')).toBe(true);
    });

    it('rejects an empty or blank name', () => {
        expect(validatePlayerName('')).toBe(false);
        expect(validatePlayerName('   ')).toBe(false);
    });

    it('rejects a name longer than 20 characters', () => {
        expect(validatePlayerName('a'.repeat(21))).toBe(false);
    });

    it('rejects a word from the custom block list, whatever its case', () => {
        expect(validatePlayerName('HiTLeR')).toBe(false);
    });
});
