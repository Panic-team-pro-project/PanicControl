import { describe, expect, it } from 'vitest';
import {
    checkLabel,
    checkMessageData,
    checkMessageType,
    isPlainObject,
} from '../../src/core/messagePayload.js';

describe('isPlainObject', () => {
    it('accepts objects only', () => {
        expect(isPlainObject({})).toBe(true);
        for (const value of [null, undefined, [], 'a', 1]) {
            expect(isPlainObject(value)).toBe(false);
        }
    });
});

describe('checkMessageType', () => {
    it('accepts a valid type', () => {
        expect(checkMessageType('move.left:1_a-b')).toEqual({ ok: true, value: 'move.left:1_a-b' });
        expect(checkMessageType('a'.repeat(64)).ok).toBe(true);
    });

    it('refuses empty, too long, forbidden characters and non-strings', () => {
        for (const type of ['', 'a'.repeat(65), 'bad type', 'é', '<b>', 3, null, undefined]) {
            expect(checkMessageType(type).ok).toBe(false);
        }
    });
});

describe('checkMessageData', () => {
    it('accepts missing data and small data', () => {
        expect(checkMessageData(undefined)).toEqual({ ok: true, value: undefined });
        expect(checkMessageData({ x: 1 }, 100).ok).toBe(true);
        expect(checkMessageData(null, 100).ok).toBe(true);
    });

    it('accepts data exactly at the limit and refuses one byte over', () => {
        const data = 'a'.repeat(8); // serialised: 10 bytes with the quotes

        expect(checkMessageData(data, 10).ok).toBe(true);
        expect(checkMessageData(data, 9).ok).toBe(false);
    });

    it('counts bytes, not characters', () => {
        expect(checkMessageData('é', 4).ok).toBe(true);
        expect(checkMessageData('é', 3).ok).toBe(false);
    });

    it('refuses data that cannot be serialised', () => {
        const cyclic: Record<string, unknown> = {};
        cyclic.self = cyclic;

        expect(checkMessageData(10n).ok).toBe(false);
        expect(checkMessageData(cyclic).ok).toBe(false);
        expect(checkMessageData(() => 1).ok).toBe(false);
    });

    it('uses the configured limit by default', () => {
        expect(checkMessageData('a'.repeat(70_000)).ok).toBe(false);
    });
});

describe('checkLabel', () => {
    it('accepts null and a trimmed text', () => {
        expect(checkLabel(null)).toEqual({ ok: true, value: null });
        expect(checkLabel('  Wolf ')).toEqual({ ok: true, value: 'Wolf' });
        expect(checkLabel('a'.repeat(50)).ok).toBe(true);
    });

    it('refuses empty, blank, too long and non-strings', () => {
        for (const label of ['', '   ', 'a'.repeat(51), 4, undefined, {}]) {
            expect(checkLabel(label).ok).toBe(false);
        }
    });
});
