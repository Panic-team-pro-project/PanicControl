// Where the developer overlay sits on screen: pure helpers, testable without a browser.

export interface Point {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

/** Space kept between the overlay and the edges of the window. */
export const SCREEN_MARGIN = 8;

/** Key of the tab's storage remembering where the overlay was left. */
export const POSITION_KEY = 'panic_control_dev_overlay_position';

/**
 * Keeps the whole overlay inside the window, so its title bar can always be grabbed again.
 * When the overlay is bigger than the window, it sticks to the top-left corner.
 */
export function clampPosition(position: Point, overlay: Size, screen: Size): Point {
    const maxX = Math.max(SCREEN_MARGIN, screen.width - overlay.width - SCREEN_MARGIN);
    const maxY = Math.max(SCREEN_MARGIN, screen.height - overlay.height - SCREEN_MARGIN);

    return {
        x: Math.round(Math.min(Math.max(position.x, SCREEN_MARGIN), maxX)),
        y: Math.round(Math.min(Math.max(position.y, SCREEN_MARGIN), maxY)),
    };
}

/** Moves the overlay with the keyboard, from its title bar. `null` for other keys. */
export function keyboardMove(key: string, position: Point, step = 20): Point | null {
    switch (key) {
        case 'ArrowLeft':
            return { x: position.x - step, y: position.y };
        case 'ArrowRight':
            return { x: position.x + step, y: position.y };
        case 'ArrowUp':
            return { x: position.x, y: position.y - step };
        case 'ArrowDown':
            return { x: position.x, y: position.y + step };
        default:
            return null;
    }
}

export function readPosition(storage: Pick<Storage, 'getItem'> | null): Point | null {
    try {
        const value: unknown = JSON.parse(storage?.getItem(POSITION_KEY) ?? 'null');
        if (
            typeof value === 'object' &&
            value !== null &&
            Number.isFinite((value as Point).x) &&
            Number.isFinite((value as Point).y)
        ) {
            return { x: (value as Point).x, y: (value as Point).y };
        }
    } catch {
        // Blocked storage or a damaged value: start from the default place
    }
    return null;
}

export function storePosition(storage: Pick<Storage, 'setItem'> | null, position: Point): void {
    try {
        storage?.setItem(POSITION_KEY, JSON.stringify(position));
    } catch {
        // Not remembered, the overlay still moves
    }
}
