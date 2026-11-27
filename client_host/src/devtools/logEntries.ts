import type { TrafficDirection, TrafficEntry } from 'sdk';

export interface LogEntry extends TrafficEntry {
    id: number;
    /** Stable key of the SDK that saw it: `console`, or `controller-<id>` for a virtual one. */
    sourceId: string;
    /** Name shown in the log: "Console" or the controller's name. */
    source: string;
}

export interface LogFilter {
    sourceId: string;
    direction: TrafficDirection | '';
    event: string;
}

export const MAX_LOG_ENTRIES = 500;

export const NO_FILTER: LogFilter = { sourceId: '', direction: '', event: '' };

export const DIRECTION_SYMBOLS: Record<TrafficDirection, string> = {
    in: '↓',
    out: '↑',
    system: '●',
};

export const DIRECTION_LABELS: Record<TrafficDirection, string> = {
    in: 'Reçu',
    out: 'Envoyé',
    system: 'Connexion',
};

export function appendEntry(
    entries: LogEntry[],
    entry: LogEntry,
    max = MAX_LOG_ENTRIES,
): LogEntry[] {
    const next = [...entries, entry];
    return next.length > max ? next.slice(next.length - max) : next;
}

export function countNewSince(entries: LogEntry[], lastId: number): number {
    const newest = entries.at(-1)?.id ?? lastId;
    return Math.max(0, newest - lastId);
}

export function filterEntries(entries: LogEntry[], filter: LogFilter): LogEntry[] {
    const event = filter.event.trim().toLowerCase();
    return entries.filter(
        (entry) =>
            (!filter.sourceId || entry.sourceId === filter.sourceId) &&
            (!filter.direction || entry.direction === filter.direction) &&
            (!event || entry.event.toLowerCase().includes(event)),
    );
}

export function sourcesOf(entries: LogEntry[]): { sourceId: string; source: string }[] {
    const names = new Map<string, string>();
    for (const entry of entries) names.set(entry.sourceId, entry.source);
    return [...names].map(([sourceId, source]) => ({ sourceId, source }));
}

export function formatPayload(data: unknown, max = 80): string {
    if (data === undefined) return '';
    const text = stringify(data, 0);
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function formatPayloadFull(data: unknown): string {
    if (data === undefined) return '(aucune donnée)';
    return stringify(data, 2);
}

export function formatTime(time: number): string {
    const date = new Date(time);
    const pad = (value: number, size = 2) => String(value).padStart(size, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export interface ReceivedMessage {
    id: number;
    type: string;
    data: unknown;
    isPrivate: boolean;
}

export function receivedMessages(
    entries: LogEntry[],
    sourceId: string,
    max = 5,
): ReceivedMessage[] {
    const messages: ReceivedMessage[] = [];
    for (let i = entries.length - 1; i >= 0 && messages.length < max; i--) {
        const entry = entries[i];
        if (
            !entry ||
            entry.sourceId !== sourceId ||
            entry.direction !== 'in' ||
            entry.event !== 'game_message' ||
            !isGameMessage(entry.data)
        ) {
            continue;
        }
        messages.push({
            id: entry.id,
            type: entry.data.type,
            data: entry.data.data,
            isPrivate: entry.data.isPrivate === true,
        });
    }
    return messages;
}

function isGameMessage(
    data: unknown,
): data is { type: string; data?: unknown; isPrivate?: unknown } {
    return (
        typeof data === 'object' &&
        data !== null &&
        typeof (data as { type?: unknown }).type === 'string'
    );
}

function stringify(data: unknown, indent: number): string {
    try {
        return JSON.stringify(data, null, indent) ?? String(data);
    } catch {
        return String(data);
    }
}
