import {
    ACCESSIBILITY_FEATURES,
    CONTROLLER_COMPONENTS,
    type GameEntry,
    type GameManifest,
} from 'common/gameManifest';
import { MAX_PLAYERS_PER_ROOM } from '../config.js';

export type ManifestResult = { ok: true; manifest: GameManifest } | { ok: false; reason: string };

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function readList<T extends string>(
    value: unknown,
    allowed: readonly T[],
    allowEmpty: boolean,
): T[] | undefined {
    if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
        return undefined;
    }
    const items: T[] = [];
    for (const item of value) {
        const known = allowed.find((candidate) => candidate === item);
        if (known === undefined || items.includes(known)) {
            return undefined;
        }
        items.push(known);
    }
    return items;
}

const MAX_ENTRY_LENGTH = 200;

function readEntryPath(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const path = value.startsWith('./') ? value.slice(2) : value;
    if (
        path.length < 1 ||
        path.length > MAX_ENTRY_LENGTH ||
        path.startsWith('/') ||
        /[\\:?#]/.test(path) ||
        !path.endsWith('.html')
    ) {
        return undefined;
    }
    const segments = path.split('/');
    if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
        return undefined;
    }
    return path;
}

function readEntry(value: unknown): GameEntry | { error: string } {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { error: 'entry must be an object with screen and controller' };
    }
    const raw = value as Record<string, unknown>;
    const screen = readEntryPath(raw.screen);
    if (screen === undefined) {
        return {
            error: 'entry.screen must be a relative path to an .html file inside the game folder',
        };
    }
    const controller = readEntryPath(raw.controller);
    if (controller === undefined) {
        return {
            error: 'entry.controller must be a relative path to an .html file inside the game folder',
        };
    }
    return { screen, controller };
}

function validateBaseInfos(
    id: unknown,
    version: unknown,
    name: string,
): ManifestResult | { ok: true } {
    if (typeof id !== 'string' || id.length < 3 || id.length > 40 || !ID_PATTERN.test(id)) {
        return { ok: false, reason: 'id must be kebab-case, 3 to 40 characters' };
    }

    if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
        return { ok: false, reason: 'version must look like 1.0.0' };
    }

    if (name.length < 1 || name.length > 50) {
        return { ok: false, reason: 'name must be 1 to 50 characters' };
    }

    return { ok: true };
}

function validatePlayers(
    minPlayers: unknown,
    maxPlayers: unknown,
    maxRoomPlayers: number,
): ManifestResult | { ok: true } {
    if (!isIntegerInRange(minPlayers, 1, maxRoomPlayers)) {
        return {
            ok: false,
            reason: `minPlayers must be a whole number from 1 to ${maxRoomPlayers}`,
        };
    }
    if (!isIntegerInRange(maxPlayers, 1, maxRoomPlayers)) {
        return {
            ok: false,
            reason: `maxPlayers must be a whole number from 1 to ${maxRoomPlayers}`,
        };
    }
    if (minPlayers > maxPlayers) {
        return { ok: false, reason: 'minPlayers must not be greater than maxPlayers' };
    }

    return { ok: true };
}

export function validateGameManifest(
    input: unknown,
    maxRoomPlayers: number = MAX_PLAYERS_PER_ROOM,
): ManifestResult {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return { ok: false, reason: 'manifest must be an object' };
    }
    const raw = input as Record<string, unknown>;

    const { id, version, description } = raw;
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const baseInfosValidation = validateBaseInfos(id, version, name);
    if (baseInfosValidation.ok === false) {
        return baseInfosValidation;
    }

    const { minPlayers, maxPlayers, durationMinutes } = raw;
    const playersValidation = validatePlayers(minPlayers, maxPlayers, maxRoomPlayers);
    if (playersValidation.ok === false) {
        return playersValidation;
    }

    if (!isIntegerInRange(durationMinutes, 1, 180)) {
        return { ok: false, reason: 'durationMinutes must be a whole number from 1 to 180' };
    }

    const controllerComponents = readList(raw.controllerComponents, CONTROLLER_COMPONENTS, false);
    if (!controllerComponents) {
        return {
            ok: false,
            reason: `controllerComponents must be a non-empty list of unique values among ${CONTROLLER_COMPONENTS.join(', ')}`,
        };
    }

    const accessibilityFeatures = readList(raw.accessibilityFeatures, ACCESSIBILITY_FEATURES, true);
    if (!accessibilityFeatures) {
        return {
            ok: false,
            reason: `accessibilityFeatures must be a list of unique values among ${ACCESSIBILITY_FEATURES.join(', ')}`,
        };
    }

    const entry = readEntry(raw.entry);
    if ('error' in entry) {
        return { ok: false, reason: entry.error };
    }

    const manifest: GameManifest = {
        id: id as string,
        name,
        version: version as string,
        minPlayers: minPlayers as number,
        maxPlayers: maxPlayers as number,
        durationMinutes: durationMinutes as number,
        controllerComponents: controllerComponents,
        accessibilityFeatures: accessibilityFeatures,
        entry,
    };

    if (description !== undefined) {
        if (typeof description !== 'string' || description.length > 200) {
            return { ok: false, reason: 'description must be a string of at most 200 characters' };
        }
        manifest.description = description;
    }

    return { ok: true, manifest };
}
