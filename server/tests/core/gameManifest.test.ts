import { describe, expect, it } from 'vitest';
import { validateGameManifest } from '../../src/core/gameManifest.js';

const valid = {
    id: 'color-rush',
    name: 'Color Rush',
    version: '1.2.3',
    minPlayers: 2,
    maxPlayers: 6,
    durationMinutes: 10,
    controllerComponents: ['button', 'dpad'],
    accessibilityFeatures: ['colorBlind'],
    entry: { screen: 'screen.html', controller: 'controller.html' },
};

function reject(override: Record<string, unknown>, maxRoomPlayers = 8): void {
    const result = validateGameManifest({ ...valid, ...override }, maxRoomPlayers);
    expect(result.ok).toBe(false);
}

describe('validateGameManifest', () => {
    it('accepts a valid manifest without description', () => {
        expect(validateGameManifest(valid)).toEqual({ ok: true, manifest: valid });
    });

    it('accepts a valid manifest with description and empty accessibility features', () => {
        const input = { ...valid, description: 'Fast game', accessibilityFeatures: [] };

        expect(validateGameManifest(input)).toEqual({ ok: true, manifest: input });
    });

    it('trims the name and drops unknown keys', () => {
        const result = validateGameManifest({ ...valid, name: '  Color Rush ', extra: 'x' });

        expect(result).toEqual({ ok: true, manifest: valid });
    });

    it('rejects inputs that are not objects', () => {
        for (const input of [null, undefined, 'text', 3, [valid]]) {
            expect(validateGameManifest(input).ok).toBe(false);
        }
    });

    it('rejects a bad id', () => {
        for (const id of ['Color_Rush', 'ab', 'a--b', '-abc', 'abc-', 'a'.repeat(41), 12]) {
            reject({ id });
        }
    });

    it('rejects an empty or too long name', () => {
        reject({ name: '   ' });
        reject({ name: 'x'.repeat(51) });
        reject({ name: 4 });
    });

    it('rejects a bad version', () => {
        for (const version of ['1.0', 'v1.0.0', '1.0.0-beta', 1]) {
            reject({ version });
        }
    });

    it('rejects bad player counts', () => {
        reject({ minPlayers: 5, maxPlayers: 3 });
        reject({ maxPlayers: 9 });
        reject({ maxPlayers: 4 }, 3);
        reject({ minPlayers: 0 });
        reject({ minPlayers: 1.5 });
        reject({ maxPlayers: '4' });
    });

    it('rejects a duration out of 1 to 180', () => {
        for (const durationMinutes of [0, 181, 2.5, '10']) {
            reject({ durationMinutes });
        }
    });

    it('rejects empty, unknown or duplicate controller components', () => {
        reject({ controllerComponents: [] });
        reject({ controllerComponents: ['laser'] });
        reject({ controllerComponents: ['button', 'button'] });
        reject({ controllerComponents: 'button' });
    });

    it('rejects unknown or duplicate accessibility features', () => {
        reject({ accessibilityFeatures: ['magic'] });
        reject({ accessibilityFeatures: ['subtitles', 'subtitles'] });
        reject({ accessibilityFeatures: undefined });
    });

    it('rejects a missing or malformed entry', () => {
        reject({ entry: undefined });
        for (const entry of ['screen.html', null, ['a.html'], 3]) {
            reject({ entry });
        }
        reject({ entry: { controller: 'controller.html' } });
        reject({ entry: { screen: 'screen.html' } });
        reject({ entry: { screen: 3, controller: 'controller.html' } });
        reject({ entry: { screen: 'screen.html', controller: {} } });
    });

    it('rejects entry paths that are not relative .html files inside the game folder', () => {
        const bad = [
            '/screen.html',
            '../x.html',
            'a/../b.html',
            'a\\b.html',
            'http://x/s.html',
            'C:/s.html',
            's.html?x',
            's.html#top',
            'screen.htm',
            'screen.txt',
            'a//b.html',
            './/s.html',
            'a/./b.html',
            '',
            `${'a'.repeat(200)}.html`,
        ];
        for (const path of bad) {
            reject({ entry: { screen: path, controller: 'controller.html' } });
            reject({ entry: { screen: 'screen.html', controller: path } });
        }
    });

    it('accepts nested entry paths and normalises a leading ./', () => {
        const result = validateGameManifest({
            ...valid,
            entry: { screen: './screen.html', controller: 'dist/controller.html' },
        });

        expect(result).toEqual({
            ok: true,
            manifest: {
                ...valid,
                entry: { screen: 'screen.html', controller: 'dist/controller.html' },
            },
        });
    });

    it('drops extra keys in entry', () => {
        const result = validateGameManifest({
            ...valid,
            entry: { screen: 'screen.html', controller: 'controller.html', url: 'x' },
        });

        expect(result).toEqual({ ok: true, manifest: valid });
    });

    it('rejects a too long or non-string description', () => {
        reject({ description: 'x'.repeat(201) });
        reject({ description: 3 });
    });
});
