import { describe, expect, it } from 'vitest';
import {
    POSITION_KEY,
    SCREEN_MARGIN,
    clampPosition,
    keyboardMove,
    readPosition,
    storePosition,
} from '../src/devtools/overlayPosition';

const screen = { width: 1280, height: 800 };
const overlay = { width: 380, height: 400 };

describe('clampPosition', () => {
    it('keeps a position that is inside the window', () => {
        expect(clampPosition({ x: 100, y: 50 }, overlay, screen)).toEqual({ x: 100, y: 50 });
    });

    it('keeps the whole overlay inside the window', () => {
        expect(clampPosition({ x: -200, y: -50 }, overlay, screen)).toEqual({
            x: SCREEN_MARGIN,
            y: SCREEN_MARGIN,
        });
        expect(clampPosition({ x: 5000, y: 5000 }, overlay, screen)).toEqual({
            x: 1280 - 380 - SCREEN_MARGIN,
            y: 800 - 400 - SCREEN_MARGIN,
        });
    });

    it('sticks to the top-left corner when the overlay is bigger than the window', () => {
        expect(clampPosition({ x: 300, y: 300 }, overlay, { width: 320, height: 300 })).toEqual({
            x: SCREEN_MARGIN,
            y: SCREEN_MARGIN,
        });
    });

    it('gives whole pixels', () => {
        expect(clampPosition({ x: 10.6, y: 20.2 }, overlay, screen)).toEqual({ x: 11, y: 20 });
    });
});

describe('keyboardMove', () => {
    it('moves with the arrow keys', () => {
        const start = { x: 100, y: 100 };

        expect(keyboardMove('ArrowLeft', start)).toEqual({ x: 80, y: 100 });
        expect(keyboardMove('ArrowRight', start)).toEqual({ x: 120, y: 100 });
        expect(keyboardMove('ArrowUp', start)).toEqual({ x: 100, y: 80 });
        expect(keyboardMove('ArrowDown', start, 60)).toEqual({ x: 100, y: 160 });
    });

    it('ignores other keys', () => {
        expect(keyboardMove('Enter', { x: 0, y: 0 })).toBeNull();
    });
});

describe('readPosition and storePosition', () => {
    function storage() {
        const data = new Map<string, string>();
        return {
            getItem: (key: string) => data.get(key) ?? null,
            setItem: (key: string, value: string) => void data.set(key, value),
            data,
        };
    }

    it('gives back the stored position', () => {
        const tab = storage();

        storePosition(tab, { x: 40, y: 60 });

        expect(readPosition(tab)).toEqual({ x: 40, y: 60 });
    });

    it('has no position when nothing or a damaged value is stored', () => {
        const tab = storage();
        expect(readPosition(tab)).toBeNull();

        tab.data.set(POSITION_KEY, '{ not json');
        expect(readPosition(tab)).toBeNull();

        tab.data.set(POSITION_KEY, JSON.stringify({ x: 'left', y: 3 }));
        expect(readPosition(tab)).toBeNull();
    });

    it('does not fail when the storage is blocked or missing', () => {
        const blocked = {
            getItem: () => {
                throw new Error('SecurityError');
            },
            setItem: () => {
                throw new Error('SecurityError');
            },
        };

        expect(readPosition(blocked)).toBeNull();
        expect(readPosition(null)).toBeNull();
        expect(() => storePosition(blocked, { x: 1, y: 1 })).not.toThrow();
    });
});
