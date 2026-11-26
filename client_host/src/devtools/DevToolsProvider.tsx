import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import '../css/devtools_style.css';
import DevOverlay from './DevOverlay';
import { DevToolsContext } from './devToolsContext';
import type { DevTools } from './devToolsContext';
import { isDevShortcut, readDevMode, storeDevMode, tabStorage } from './devMode';
import { useVirtualControllers } from './useVirtualControllers';

export default function DevToolsProvider({ children }: { children: ReactNode }) {
    const { search } = useLocation();
    const [enabled, setEnabledState] = useState(() => readDevMode(search, tabStorage()));
    const [open, setOpen] = useState(false);
    const [consoleRoom, setConsoleRoom] = useState<string | null>(null);
    const [seenSearch, setSeenSearch] = useState(search);
    const simulator = useVirtualControllers();

    // Option to turn on developer mode
    if (search !== seenSearch) {
        setSeenSearch(search);
        if (new URLSearchParams(search).has('debug')) setEnabledState(true);
    }

    // Stays on across reloads
    useEffect(() => {
        storeDevMode(tabStorage(), enabled);
    }, [enabled]);

    // Remove all virtual controllers when developer mode is turned off
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
        () => ({ enabled, setEnabled, open, setOpen, consoleRoom, setConsoleRoom, simulator }),
        [enabled, setEnabled, open, consoleRoom, simulator],
    );

    return (
        <DevToolsContext.Provider value={value}>
            {children}
            {enabled && (
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
            )}
        </DevToolsContext.Provider>
    );
}
