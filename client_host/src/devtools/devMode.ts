export const DEV_MODE_KEY = 'panic_control_dev_mode';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem' | 'removeItem'>;

export function readDevMode(search: string, storage: ReadableStorage | null): boolean {
    if (new URLSearchParams(search).has('debug')) return true;

    try {
        return storage?.getItem(DEV_MODE_KEY) === 'on';
    } catch {
        return false;
    }
}

export function storeDevMode(storage: WritableStorage | null, on: boolean): void {
    try {
        if (on) {
            storage?.setItem(DEV_MODE_KEY, 'on');
        } else {
            storage?.removeItem(DEV_MODE_KEY);
        }
    } catch {
        return;
    }
}

export function tabStorage(): Storage | null {
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

interface ShortcutEvent {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
}

export function isDevShortcut(event: ShortcutEvent): boolean {
    return (
        event.key.toLowerCase() === 'd' &&
        event.shiftKey &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey
    );
}
