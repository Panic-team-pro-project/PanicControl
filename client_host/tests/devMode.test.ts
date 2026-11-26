import { describe, expect, it } from 'vitest';
import { DEV_MODE_KEY, isDevShortcut, readDevMode, storeDevMode } from '../src/devtools/devMode';

// A tab storage holding the given values
function storage(values: Record<string, string> = {}) {
    const data = new Map(Object.entries(values));
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => void data.set(key, value),
        removeItem: (key: string) => void data.delete(key),
        data,
    };
}

// A storage the browser refuses to use
const blocked = {
    getItem: () => {
        throw new Error('SecurityError');
    },
    setItem: () => {
        throw new Error('SecurityError');
    },
    removeItem: () => {
        throw new Error('SecurityError');
    },
};

describe('readDevMode', () => {
    it('is on when the address has ?debug, with or without a value', () => {
        expect(readDevMode('?debug', storage())).toBe(true);
        expect(readDevMode('?roomCode=ABC123&debug=1', storage())).toBe(true);
    });

    it('is on when the tab remembers it', () => {
        expect(readDevMode('', storage({ [DEV_MODE_KEY]: 'on' }))).toBe(true);
    });

    it('is off otherwise', () => {
        expect(readDevMode('?roomCode=ABC123', storage())).toBe(false);
        expect(readDevMode('', null)).toBe(false);
    });

    it('still reads ?debug when the storage is blocked', () => {
        expect(readDevMode('?debug', blocked)).toBe(true);
        expect(readDevMode('', blocked)).toBe(false);
    });
});

describe('storeDevMode', () => {
    it('remembers developer mode, then forgets it', () => {
        const tab = storage();

        storeDevMode(tab, true);
        expect(tab.data.get(DEV_MODE_KEY)).toBe('on');

        storeDevMode(tab, false);
        expect(tab.data.has(DEV_MODE_KEY)).toBe(false);
    });

    it('does not fail when the storage is blocked or missing', () => {
        expect(() => storeDevMode(blocked, true)).not.toThrow();
        expect(() => storeDevMode(null, true)).not.toThrow();
    });
});

describe('isDevShortcut', () => {
    const keys = { key: 'D', ctrlKey: false, metaKey: false, shiftKey: true, altKey: false };

    it('matches Ctrl+Shift+D and Cmd+Shift+D', () => {
        expect(isDevShortcut({ ...keys, ctrlKey: true })).toBe(true);
        expect(isDevShortcut({ ...keys, metaKey: true })).toBe(true);
        expect(isDevShortcut({ ...keys, key: 'd', ctrlKey: true })).toBe(true);
    });

    it('ignores other combinations', () => {
        expect(isDevShortcut({ ...keys })).toBe(false); // Shift+D: typing a capital D
        expect(isDevShortcut({ ...keys, ctrlKey: true, shiftKey: false })).toBe(false);
        expect(isDevShortcut({ ...keys, ctrlKey: true, altKey: true })).toBe(false);
        expect(isDevShortcut({ ...keys, key: 'F', ctrlKey: true })).toBe(false);
    });
});
