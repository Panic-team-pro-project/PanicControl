import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import ControllerSimulator from './ControllerSimulator';
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

    function onDialogKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
        if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
        }
    }

    return (
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

            <div className="devtools-content">
                <section aria-labelledby="devtools-simulator-title">
                    <h3 id="devtools-simulator-title">Manettes virtuelles</h3>
                    <ControllerSimulator />
                </section>

                <p className="devtools-hint">Ctrl+Shift+D désactive le mode développeur.</p>
            </div>
        </dialog>
    );
}
