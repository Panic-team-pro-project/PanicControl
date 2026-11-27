import { describe, expect, it } from 'vitest';
import {
    NO_FILTER,
    appendEntry,
    countNewSince,
    filterEntries,
    formatPayload,
    formatPayloadFull,
    formatTime,
    receivedMessages,
    sourcesOf,
} from '../src/devtools/logEntries';
import type { LogEntry } from '../src/devtools/logEntries';

let nextId = 1;

function entry(patch: Partial<LogEntry> = {}): LogEntry {
    return {
        id: nextId++,
        sourceId: 'console',
        source: 'Console',
        direction: 'in',
        event: 'update_players',
        data: undefined,
        time: 0,
        ...patch,
    };
}

describe('appendEntry', () => {
    it('adds at the end', () => {
        const first = entry();
        const second = entry();
        expect(appendEntry([first], second)).toEqual([first, second]);
    });

    it('drops the oldest entries beyond the maximum', () => {
        const list = [entry(), entry(), entry()];
        const added = entry();
        expect(appendEntry(list, added, 3)).toEqual([list[1], list[2], added]);
    });
});

describe('filterEntries', () => {
    const consoleIn = entry({ event: 'player_action' });
    const botOut = entry({
        sourceId: 'controller-1',
        source: 'Bot 1',
        direction: 'out',
        event: 'send_action',
    });
    const botSystem = entry({
        sourceId: 'controller-1',
        source: 'Bot 1',
        direction: 'system',
        event: 'disconnect',
    });
    const all = [consoleIn, botOut, botSystem];

    it('keeps everything without a filter', () => {
        expect(filterEntries(all, NO_FILTER)).toEqual(all);
    });

    it('filters by source, direction and part of the event name, any case', () => {
        expect(filterEntries(all, { ...NO_FILTER, sourceId: 'controller-1' })).toEqual([
            botOut,
            botSystem,
        ]);
        expect(filterEntries(all, { ...NO_FILTER, direction: 'system' })).toEqual([botSystem]);
        expect(filterEntries(all, { ...NO_FILTER, event: ' ACTION ' })).toEqual([
            consoleIn,
            botOut,
        ]);
        expect(
            filterEntries(all, { sourceId: 'controller-1', direction: 'out', event: 'action' }),
        ).toEqual([botOut]);
    });
});

describe('sourcesOf', () => {
    it('lists each source once, in order of appearance, with its latest name', () => {
        const entries = [
            entry({ sourceId: 'controller-2', source: 'Bot 2' }),
            entry(),
            entry({ sourceId: 'controller-2', source: 'Alice' }),
        ];
        expect(sourcesOf(entries)).toEqual([
            { sourceId: 'controller-2', source: 'Alice' },
            { sourceId: 'console', source: 'Console' },
        ]);
    });
});

describe('formatPayload', () => {
    it('shows the data as compact JSON', () => {
        expect(formatPayload({ type: 'jump', data: { x: 1 } })).toBe(
            '{"type":"jump","data":{"x":1}}',
        );
        expect(formatPayload('transport close')).toBe('"transport close"');
    });

    it('is empty without data', () => {
        expect(formatPayload(undefined)).toBe('');
    });

    it('cuts long data', () => {
        const text = formatPayload({ text: 'a'.repeat(100) }, 20);
        expect(text).toHaveLength(20);
        expect(text.endsWith('…')).toBe(true);
    });

    it('does not throw on data JSON cannot show', () => {
        const loop: Record<string, unknown> = {};
        loop.self = loop;
        expect(formatPayload(loop)).toBe('[object Object]');
    });
});

describe('formatPayloadFull', () => {
    it('indents the data', () => {
        expect(formatPayloadFull({ x: 1 })).toBe('{\n  "x": 1\n}');
    });

    it('says when there is no data', () => {
        expect(formatPayloadFull(undefined)).toBe('(aucune donnée)');
    });
});

describe('formatTime', () => {
    it('shows hours, minutes, seconds and milliseconds', () => {
        const time = new Date(2026, 0, 1, 9, 5, 7, 42).getTime();
        expect(formatTime(time)).toBe('09:05:07.042');
    });
});

describe('receivedMessages', () => {
    function message(sourceId: string, type: string, isPrivate: boolean, data?: unknown) {
        return entry({
            sourceId,
            event: 'game_message',
            data: { type, data, isPrivate },
        });
    }

    it("keeps one controller's game messages received, newest first", () => {
        const entries = [
            message('controller-1', 'score', false, 3),
            message('controller-2', 'other', false),
            entry({ sourceId: 'controller-1', direction: 'out', event: 'send_action' }),
            entry({ sourceId: 'controller-1', event: 'game_started' }),
            message('controller-1', 'secret', true, { word: 'pomme' }),
        ];

        expect(receivedMessages(entries, 'controller-1')).toEqual([
            {
                id: entries[4]?.id,
                type: 'secret',
                data: { word: 'pomme' },
                isPrivate: true,
            },
            { id: entries[0]?.id, type: 'score', data: 3, isPrivate: false },
        ]);
    });

    it('keeps the last ones only', () => {
        const entries = Array.from({ length: 8 }, (_, i) =>
            message('controller-1', `m${i}`, false),
        );
        expect(receivedMessages(entries, 'controller-1', 3).map((m) => m.type)).toEqual([
            'm7',
            'm6',
            'm5',
        ]);
    });

    it('skips malformed game messages', () => {
        const entries = [entry({ sourceId: 'controller-1', event: 'game_message', data: 'x' })];
        expect(receivedMessages(entries, 'controller-1')).toEqual([]);
    });
});

describe('countNewSince', () => {
    it('counts the messages recorded after an id', () => {
        const entries = [entry({ id: 10 }), entry({ id: 11 }), entry({ id: 12 })];
        expect(countNewSince(entries, 10)).toBe(2);
        expect(countNewSince(entries, 12)).toBe(0);
    });

    it('also counts the ones already dropped by the maximum', () => {
        expect(countNewSince([entry({ id: 900 })], 100)).toBe(800);
    });

    it('is zero when the log is empty', () => {
        expect(countNewSince([], 42)).toBe(0);
    });
});
