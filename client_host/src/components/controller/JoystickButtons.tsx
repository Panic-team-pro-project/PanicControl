import { useEffect, useRef } from 'react';
import nipplejs from 'nipplejs';
import { useGesture } from '@use-gesture/react';

import '../../css/JoystickButtons.css';

interface JoystickData {
    x: number;
    y: number;
    force: number;
    direction?: string;
}

interface DragData {
    x: number;
    y: number;
    deltaX: number;
    deltaY: number;
    active: boolean;
}

interface PinchData {
    scale: number;
    angle: number;
    active: boolean;
}

interface GameControlsProps {
    onMove?: (data: JoystickData) => void;
    onRelease?: () => void;
    onAction: () => void;
    onDrag?: (data: DragData) => void;
    onPinch?: (data: PinchData) => void;
    onGestureEnd?: () => void;
    disabled?: boolean;
}

// NippleJS event types
interface JoystickEventData {
    vector: {
        x: number;
        y: number;
    };
    force: number;
    direction?: {
        angle?: string;
    };
}

interface JoystickManagerEvents {
    on(event: 'move', callback: (event: unknown, data: JoystickEventData) => void): this;

    on(event: 'end', callback: () => void): this;

    destroy(): void;
}

export function GameControls({
    onMove,
    onRelease,
    onAction,
    onDrag,
    onPinch,
    onGestureEnd,
    disabled = false,
}: GameControlsProps) {
    const joystickZone = useRef<HTMLDivElement>(null);

    // Keep callbacks up to date
    const callbacks = useRef({
        onMove,
        onRelease,
        onDrag,
        onPinch,
        onGestureEnd,
    });

    useEffect(() => {
        callbacks.current = {
            onMove,
            onRelease,
            onDrag,
            onPinch,
            onGestureEnd,
        };
    }, [onMove, onRelease, onDrag, onPinch, onGestureEnd]);

    // Virtual joystick initialization
    useEffect(() => {
        const zone = joystickZone.current;

        if (!zone || disabled) return;

        const manager = nipplejs.create({
            zone,
            mode: 'static',
            position: {
                left: '50%',
                top: '50%',
            },
            color: '#ffffff',
            size: 150,
            threshold: 0.1,
            fadeTime: 150,
            multitouch: false,
            maxNumberOfJoysticks: 1,
            restJoystick: true,
        }) as unknown as JoystickManagerEvents;

        manager.on('move', (_event, data) => {
            callbacks.current.onMove?.({
                x: data.vector.x,
                y: data.vector.y,
                force: data.force,
                direction: data.direction?.angle,
            });
        });

        manager.on('end', () => {
            callbacks.current.onRelease?.();
        });

        return () => {
            manager.destroy();
        };
    }, [disabled]);

    // General multitouch gesture handling
    useGesture(
        {
            onDrag: ({ movement: [x, y], delta: [deltaX, deltaY], active }) => {
                callbacks.current.onDrag?.({
                    x,
                    y,
                    deltaX,
                    deltaY,
                    active,
                });
            },

            onPinch: ({ offset: [scale, angle], active }) => {
                callbacks.current.onPinch?.({
                    scale,
                    angle,
                    active,
                });
            },

            onDragEnd: () => {
                callbacks.current.onGestureEnd?.();
            },

            onPinchEnd: () => {
                callbacks.current.onGestureEnd?.();
            },
        },
        {
            enabled: !disabled,
            drag: {
                filterTaps: true,
            },
            pinch: {
                scaleBounds: {
                    min: 0.5,
                    max: 3,
                },
            },
            eventOptions: {
                passive: false,
            },
        },
    );

    return (
        <section className="game-controls">
            {/* Instructions */}
            <header className="game-controls-instructions">
                <h2>À toi de jouer !</h2>
                <p>Utilise les commandes pour jouer.</p>
            </header>

            {/* Main controls */}
            <div className="game-controls-layout">
                {/* Analog joystick */}
                <div className="joystick-container">
                    <div ref={joystickZone} className="joystick-zone" />

                    <p>JOYSTICK</p>

                    <span>Déplace-toi dans toutes les directions</span>
                </div>

                {/* Action button */}
                <div className="action-container">
                    <button
                        type="button"
                        className="game-action-button"
                        onClick={onAction}
                        disabled={disabled}
                    >
                        ACTION
                    </button>

                    <p>BOUTON ACTION</p>

                    <span>Appuie pour effectuer une action</span>
                </div>
            </div>

            {/* Multitouch gesture surface
            <div
                {...gestureBind()}
                className={`gesture-zone ${
                    disabled ? 'gesture-disabled' : ''
                }`}
                style={{
                    touchAction: 'none',
                }}
            >
                <span className="gesture-icon">✋</span>

                <h3>Zone tactile</h3>

                <p>
                    Glisse avec un doigt ou pince avec deux doigts
                </p>
            </div> */}
        </section>
    );
}
