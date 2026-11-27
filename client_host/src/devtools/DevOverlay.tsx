import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import ControllerSimulator from './ControllerSimulator';
import MessageLog from './MessageLog';
import { InPage, InWindow } from './PopOutPanel';
import { usePopOutWindow } from './usePopOutWindow';
import { tabStorage } from './devMode';
import { useDevTools } from './devToolsContext';
import {
    SCREEN_MARGIN,
    clampPosition,
    keyboardMove,
    readPosition,
    storePosition,
} from './overlayPosition';
import type { Point, Size } from './overlayPosition';

const TABS = [
    { id: 'simulator', label: 'Manettes virtuelles' },
    { id: 'log', label: 'Journal' },
] as const;

const SIMULATOR_TITLE = 'Manettes virtuelles — Mode développeur';
const LOG_TITLE = 'Journal — Mode développeur';

type TabId = (typeof TABS)[number]['id'];

interface Drag {
    pointerId: number;
    offsetX: number;
    offsetY: number;
    size: Size;
}

function screenSize(): Size {
    return { width: window.innerWidth, height: window.innerHeight };
}

export default function DevOverlay() {
    const { open, setOpen } = useDevTools();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const drag = useRef<Drag | null>(null);
    const [position, setPosition] = useState<Point | null>(() => readPosition(tabStorage()));
    const [tab, setTab] = useState<TabId>('simulator');
    const simulatorWindow = usePopOutWindow('panic-control-controllers', SIMULATOR_TITLE);
    const logWindow = usePopOutWindow('panic-control-log', LOG_TITLE);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (open && !dialog.open) dialog.show();
        if (!open && dialog.open) dialog.close();
    }, [open]);
    useEffect(() => {
        if (position) storePosition(tabStorage(), position);
    }, [position]);

    useEffect(() => {
        if (!open) return;

        function keepInside() {
            const dialog = dialogRef.current;
            if (!dialog) return;
            const { width, height } = dialog.getBoundingClientRect();
            setPosition((current) =>
                current ? clampPosition(current, { width, height }, screenSize()) : current,
            );
        }

        const frame = requestAnimationFrame(keepInside);
        window.addEventListener('resize', keepInside);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', keepInside);
        };
    }, [open]);

    function currentPlace(): { point: Point; size: Size } | null {
        const dialog = dialogRef.current;
        if (!dialog) return null;
        const rect = dialog.getBoundingClientRect();
        return {
            point: { x: rect.left, y: rect.top },
            size: { width: rect.width, height: rect.height },
        };
    }

    function onPointerDown(event: PointerEvent<HTMLElement>) {
        if (event.button !== 0 || (event.target as HTMLElement).closest('.devtools-close')) return;
        const place = currentPlace();
        if (!place) return;

        drag.current = {
            pointerId: event.pointerId,
            offsetX: event.clientX - place.point.x,
            offsetY: event.clientY - place.point.y,
            size: place.size,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
    }

    function onPointerMove(event: PointerEvent<HTMLElement>) {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;

        setPosition(
            clampPosition(
                { x: event.clientX - current.offsetX, y: event.clientY - current.offsetY },
                current.size,
                screenSize(),
            ),
        );
    }

    function onPointerEnd(event: PointerEvent<HTMLElement>) {
        if (drag.current?.pointerId !== event.pointerId) return;
        drag.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
    }

    function onHandleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        const place = currentPlace();
        const next = place && keyboardMove(event.key, place.point, event.shiftKey ? 60 : 20);
        if (!place || !next) return;

        event.preventDefault();
        setPosition(clampPosition(next, place.size, screenSize()));
    }

    // Arrow keys move between tabs, as in the ARIA tabs pattern
    function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        const index = TABS.findIndex((t) => t.id === tab);
        let next: number;
        if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = TABS.length - 1;
        else return;

        event.preventDefault();
        const target = TABS[next];
        if (!target) return;
        setTab(target.id);
        document.getElementById(`devtools-tab-${target.id}`)?.focus();
    }

    function onDialogKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
        if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
        }
    }

    return (
        <>
            <dialog
                ref={dialogRef}
                className={`devtools-dialog ${position ? 'devtools-placed' : ''}`}
                aria-labelledby="devtools-title"
                style={
                    position
                        ? {
                              left: position.x,
                              top: position.y,
                              maxHeight: `calc(100vh - ${position.y + SCREEN_MARGIN}px)`,
                          }
                        : undefined
                }
                onKeyDown={onDialogKeyDown}
            >
                <header
                    className="devtools-header"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerEnd}
                    onPointerCancel={onPointerEnd}
                >
                    <button
                        type="button"
                        className="devtools-handle"
                        aria-label="Déplacer le mode développeur avec les flèches"
                        title="Glisser la barre de titre pour déplacer"
                        onKeyDown={onHandleKeyDown}
                    >
                        ⠿
                    </button>
                    <h2 id="devtools-title">🛠 Mode développeur</h2>
                    <button
                        type="button"
                        className="devtools-close"
                        aria-label="Fermer le mode développeur"
                        onClick={() => setOpen(false)}
                    >
                        ✕
                    </button>
                </header>

                <div className="devtools-tabs" role="tablist" aria-label="Outils">
                    {TABS.map(({ id, label }) => (
                        <button
                            key={id}
                            id={`devtools-tab-${id}`}
                            type="button"
                            role="tab"
                            aria-selected={tab === id}
                            aria-controls={`devtools-panel-${id}`}
                            tabIndex={tab === id ? 0 : -1}
                            onClick={() => setTab(id)}
                            onKeyDown={onTabKeyDown}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="devtools-content">
                    {/* Both panels stay mounted, so the forms keep what was typed */}
                    <section
                        id="devtools-panel-simulator"
                        role="tabpanel"
                        aria-labelledby="devtools-tab-simulator"
                        hidden={tab !== 'simulator'}
                    >
                        <InPage
                            popOutWindow={simulatorWindow}
                            notice="Les manettes virtuelles sont ouvertes dans une fenêtre séparée."
                        >
                            {(openButton) => <ControllerSimulator windowButton={openButton} />}
                        </InPage>
                    </section>
                    <section
                        id="devtools-panel-log"
                        role="tabpanel"
                        aria-labelledby="devtools-tab-log"
                        hidden={tab !== 'log'}
                    >
                        <InPage
                            popOutWindow={logWindow}
                            notice="Le journal est ouvert dans une fenêtre séparée."
                        >
                            {(openButton) => <MessageLog windowButton={openButton} />}
                        </InPage>
                    </section>

                    <p className="devtools-hint">Ctrl+Shift+D désactive le mode développeur.</p>
                </div>
            </dialog>

            {/* Outside the dialog, see InWindow */}
            <InWindow popOutWindow={simulatorWindow} title={SIMULATOR_TITLE}>
                {(backButton) => <ControllerSimulator windowButton={backButton} />}
            </InWindow>
            <InWindow popOutWindow={logWindow} title={LOG_TITLE}>
                {(backButton) => <MessageLog windowButton={backButton} />}
            </InWindow>
        </>
    );
}
