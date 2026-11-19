import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { GameManifest } from 'common/gameManifest';
import { validateGameManifest } from '../core/gameManifest.js';

export class Catalogue {
    private readonly games: GameManifest[];

    constructor(games: GameManifest[]) {
        this.games = [...games].sort((a, b) => a.name.localeCompare(b.name));
    }

    list(): GameManifest[] {
        return [...this.games];
    }

    get(id: string): GameManifest | undefined {
        return this.games.find((game) => game.id === id);
    }
}

async function isFile(filePath: string): Promise<boolean> {
    try {
        return (await stat(filePath)).isFile();
    } catch {
        return false;
    }
}

async function readManifest(dir: string, folder: string): Promise<GameManifest | undefined> {
    let raw: string;
    try {
        raw = await readFile(path.join(dir, folder, 'manifest.json'), 'utf-8');
    } catch {
        console.warn(`⚠️ Game "${folder}" skipped: manifest.json not found`);
        return undefined;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        console.warn(`⚠️ Game "${folder}" skipped: manifest.json is not valid JSON`);
        return undefined;
    }

    const result = validateGameManifest(parsed);
    if (!result.ok) {
        console.warn(`⚠️ Game "${folder}" skipped: ${result.reason}`);
        return undefined;
    }
    if (result.manifest.id !== folder) {
        console.warn(
            `⚠️ Game "${folder}" skipped: id "${result.manifest.id}" must match the folder name`,
        );
        return undefined;
    }
    for (const file of [result.manifest.entry.screen, result.manifest.entry.controller]) {
        if (!(await isFile(path.join(dir, folder, file)))) {
            console.warn(`⚠️ Game "${folder}" skipped: entry file "${file}" not found`);
            return undefined;
        }
    }
    return result.manifest;
}

export async function loadCatalogue(dir: string): Promise<Catalogue> {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        console.warn(`⚠️ Games folder not found: ${dir}`);
        return new Catalogue([]);
    }

    const games: GameManifest[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        const manifest = await readManifest(dir, entry.name);
        if (manifest) {
            games.push(manifest);
        }
    }
    return new Catalogue(games);
}
