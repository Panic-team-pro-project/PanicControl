import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import '../css/devtools_style.css';
import DevOverlay from './DevOverlay';
import { DevToolsContext, MessageLogContext } from './devToolsContext';
import type { DevTools, TrafficSource } from './devToolsContext';
import { isDevShortcut, readDevMode, storeDevMode, tabStorage } from './devMode';
import { useMessageLog } from './useMessageLog';
import { useVirtualControllers } from './useVirtualControllers';

export default function DevToolsProvider({ children }: { children: ReactNode }) {
    const { search } = useLocation();
    const [enabled, setEnabledState] = useState(() => readDevMode(search, tabStorage()));
    const [open, setOpen] = useState(false);
    const [consoleRoom, setConsoleRoom] = useState<string | null>(null);
    const [seenSearch, setSeenSearch] = useState(search);
    const [consoleSdk, setConsoleSdk] = useState<TrafficSource | null>(null);
    const { record, ...log } = useMessageLog();
    const simulator = useVirtualControllers(record);

    // Option to turn on developer mode
    if (search !== seenSearch) {
        setSeenSearch(search);
        if (new URLSearchParams(search).has('debug')) setEnabledState(true);
    }

    useEffect(() => {
        storeDevMode(tabStorage(), enabled);
    }, [enabled]);

    const { removeAll } = simulator;
    const setEnabled = useCallback(
        (on: boolean) => {
            setEnabledState(on);
            if (!on) {
                setOpen(false);
                removeAll();
            }
        },
        [removeAll],
    );

    const registerConsole = useCallback((sdk: TrafficSource) => {
        setConsoleSdk(sdk);
        return () => setConsoleSdk((current) => (current === sdk ? null : current));
    }, []);

    // Log the console page's messages while developer mode is on
    useEffect(() => {
        if (!enabled || !consoleSdk) return;
        return consoleSdk.onTraffic((entry) => record('console', 'Console', entry));
    }, [enabled, consoleSdk, record]);

    const { entries, pause, setPaused, clear } = log;
    const logView = useMemo(
        () => ({ entries, pause, setPaused, clear }),
        [entries, pause, setPaused, clear],
    );

    // Command shortcut to toggle developer mode (Ctrl+Shift+D on Windows/Linux, Cmd+Shift+D on Mac)
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (!isDevShortcut(event)) return;
            event.preventDefault();
            setEnabled(!enabled);
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [enabled, setEnabled]);

    const value = useMemo<DevTools>(
        () => ({
            enabled,
            setEnabled,
            open,
            setOpen,
            consoleRoom,
            setConsoleRoom,
            simulator,
            registerConsole,
        }),
        [enabled, setEnabled, open, consoleRoom, simulator, registerConsole],
    );

    return (
        <DevToolsContext.Provider value={value}>
            {children}
            {enabled && (
                <MessageLogContext.Provider value={logView}>
                    <div className="devtools">
                        <button
                            type="button"
                            className="devtools-launcher"
                            aria-haspopup="dialog"
                            aria-expanded={open}
                            onClick={() => setOpen(true)}
                        >
                            🛠 Dev
                            {simulator.controllers.length > 0 && (
                                <span className="devtools-count">
                                    {simulator.controllers.length}
                                    <span className="devtools-sr-only"> manettes virtuelles</span>
                                </span>
                            )}
                        </button>
                        <DevOverlay />
                    </div>
                </MessageLogContext.Provider>
            )}
        </DevToolsContext.Provider>
    );
}
