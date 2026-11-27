import { createContext, useContext, useEffect } from 'react';
import type { TrafficEntry } from 'sdk';
import type { MessageLog } from './useMessageLog';
import type { VirtualControllers } from './useVirtualControllers';

export interface TrafficSource {
    onTraffic: (callback: (entry: TrafficEntry) => void) => () => void;
}

export interface DevTools {
    /** Developer mode is on */
    enabled: boolean;
    setEnabled: (on: boolean) => void;
    open: boolean;
    setOpen: (open: boolean) => void;
    consoleRoom: string | null;
    setConsoleRoom: (roomCode: string | null) => void;
    simulator: VirtualControllers;
    /**
     * Logs the messages of the console page's SDK while developer mode is on.
     * Returns the function to call when the page drops this SDK.
     */
    registerConsole: (sdk: TrafficSource) => () => void;
}

export const DevToolsContext = createContext<DevTools | null>(null);

export function useDevTools(): DevTools {
    const devTools = useContext(DevToolsContext);
    if (!devTools) {
        throw new Error('useDevTools must be used inside <DevToolsProvider>');
    }
    return devTools;
}

export const MessageLogContext = createContext<Omit<MessageLog, 'record'> | null>(null);

export function useMessageLogView(): Omit<MessageLog, 'record'> {
    const log = useContext(MessageLogContext);
    if (!log) {
        throw new Error('useMessageLogView must be used inside <DevToolsProvider>');
    }
    return log;
}

export function useConsoleRoom(roomCode: string | null): void {
    const { setConsoleRoom } = useDevTools();

    useEffect(() => {
        setConsoleRoom(roomCode || null);
        return () => setConsoleRoom(null);
    }, [roomCode, setConsoleRoom]);
}
