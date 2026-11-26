// Developer mode on/off: pure helpers, testable without a browser.

/** Key of the tab's storage remembering that developer mode is on. */
export const DEV_MODE_KEY = 'panic_control_dev_mode';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem' | 'removeItem'>;

/** On when the address has `?debug`, or when this tab already turned it on. */
export function readDevMode(search: string, storage: ReadableStorage | null): boolean {
    if (new URLSearchParams(search).has('debug')) return true;

    try {
        return storage?.getItem(DEV_MODE_KEY) === 'on';
    } catch {
        // Storage blocked (private window, disabled site data): only ?debug counts
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
        // Not remembered across reloads, but developer mode still works in this page
    }
}

/** The tab's storage, or `null` when the browser refuses access. */
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

/** Ctrl+Shift+D, or Cmd+Shift+D on a Mac. */
export function isDevShortcut(event: ShortcutEvent): boolean {
    return (
        event.key.toLowerCase() === 'd' &&
        event.shiftKey &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey
    );
}
