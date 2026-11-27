import { useCallback, useMemo, useRef, useState } from 'react';
import type { TrafficEntry } from 'sdk';
import { appendEntry } from './logEntries';
import type { LogEntry } from './logEntries';

export type RecordTraffic = (sourceId: string, source: string, entry: TrafficEntry) => void;

export interface LogPause {
    entries: LogEntry[];
    lastId: number;
}

export interface MessageLog {
    entries: LogEntry[];
    pause: LogPause | null;
    setPaused: (paused: boolean) => void;
    clear: () => void;
    record: RecordTraffic;
}

export function useMessageLog(): MessageLog {
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [pause, setPause] = useState<LogPause | null>(null);
    const nextId = useRef(1);

    const setPaused = useCallback(
        (on: boolean) => setPause(on ? { entries, lastId: nextId.current - 1 } : null),
        [entries],
    );

    const clear = useCallback(() => {
        setEntries([]);
        setPause((current) => (current ? { entries: [], lastId: nextId.current - 1 } : null));
    }, []);

    const record = useCallback<RecordTraffic>((sourceId, source, entry) => {
        const logged: LogEntry = { ...entry, id: nextId.current++, sourceId, source };
        setEntries((list) => appendEntry(list, logged));
    }, []);

    return useMemo(
        () => ({ entries, pause, setPaused, clear, record }),
        [entries, pause, setPaused, clear, record],
    );
}
