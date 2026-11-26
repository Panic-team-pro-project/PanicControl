import { createContext, useContext, useEffect } from 'react';
import type { VirtualControllers } from './useVirtualControllers';

export interface DevTools {
    /** Developer mode is on */
    enabled: boolean;
    setEnabled: (on: boolean) => void;
    /** The overlay is open. */
    open: boolean;
    setOpen: (open: boolean) => void;
    consoleRoom: string | null;
    setConsoleRoom: (roomCode: string | null) => void;
    simulator: VirtualControllers;
}

export const DevToolsContext = createContext<DevTools | null>(null);

export function useDevTools(): DevTools {
    const devTools = useContext(DevToolsContext);
    if (!devTools) {
        throw new Error('useDevTools must be used inside <DevToolsProvider>');
    }
    return devTools;
}

export function useConsoleRoom(roomCode: string | null): void {
    const { setConsoleRoom } = useDevTools();

    useEffect(() => {
        setConsoleRoom(roomCode || null);
        return () => setConsoleRoom(null);
    }, [roomCode, setConsoleRoom]);
}
