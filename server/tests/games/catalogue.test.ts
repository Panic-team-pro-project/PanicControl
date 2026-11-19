import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Catalogue, loadCatalogue } from '../../src/games/catalogue.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/games');

afterEach(() => {
    vi.restoreAllMocks();
});

describe('loadCatalogue', () => {
    it('loads only the valid packages, sorted by name, and warns about the others', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const catalogue = await loadCatalogue(fixtures);

        expect(catalogue.list().map((game) => game.id)).toEqual(['zeta-game', 'alpha-game']);
        const warnings = warn.mock.calls.map((call) => String(call[0]));
        expect(warnings).toHaveLength(5);
        for (const folder of [
            'bad-json',
            'bad-manifest',
            'wrong-id',
            'no-manifest',
            'missing-entry',
        ]) {
            expect(warnings.some((w) => w.includes(`"${folder}"`))).toBe(true);
        }
    });

    it('skips a package whose entry file is missing and names it', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const catalogue = await loadCatalogue(fixtures);

        expect(catalogue.get('missing-entry')).toBeUndefined();
        expect(
            warn.mock.calls.some(
                (call) =>
                    String(call[0]).includes('"missing-entry"') &&
                    String(call[0]).includes('controller.html'),
            ),
        ).toBe(true);
    });

    it('returns an empty catalogue and warns when the folder does not exist', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const catalogue = await loadCatalogue(path.join(fixtures, 'missing'));

        expect(catalogue.list()).toEqual([]);
        expect(warn).toHaveBeenCalledTimes(1);
    });
});

describe('Catalogue', () => {
    it('finds a game by id and returns undefined for an unknown id', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const catalogue = await loadCatalogue(fixtures);

        expect(catalogue.get('alpha-game')?.name).toBe('Zeta Name');
        expect(catalogue.get('unknown')).toBeUndefined();
    });

    it('does not let callers change its list', () => {
        const catalogue = new Catalogue([]);
        catalogue.list().push({} as never);

        expect(catalogue.list()).toEqual([]);
    });
});
