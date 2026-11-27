import { useCallback, useEffect, useState } from 'react';

export interface PopOut {
    win: Window;
    /** Where to render*/
    container: HTMLElement;
}

export interface PopOutWindow {
    popOut: PopOut | null;
    blocked: boolean;
    open: () => void;
    close: () => void;
}

export function usePopOutWindow(name: string, title: string): PopOutWindow {
    const [popOut, setPopOut] = useState<PopOut | null>(null);
    const [blocked, setBlocked] = useState(false);

    const open = useCallback(() => {
        if (popOut) {
            popOut.win.focus();
            return;
        }

        const win = window.open('', name, 'popup,width=760,height=640');
        if (!win) {
            setBlocked(true);
            return;
        }

        const doc = win.document;
        doc.title = title;
        doc.documentElement.lang = document.documentElement.lang;
        doc.head.replaceChildren(...copyStyles(doc));
        const container = doc.createElement('div');
        doc.body.replaceChildren(container);

        setBlocked(false);
        setPopOut({ win, container });
    }, [name, popOut, title]);

    const close = useCallback(() => {
        popOut?.win.close();
        setPopOut(null);
    }, [popOut]);

    useEffect(() => {
        if (!popOut) return;
        const { win } = popOut;

        const onPopOutClosed = () => setPopOut(null);
        const onTabLeaves = () => win.close();
        win.addEventListener('pagehide', onPopOutClosed);
        window.addEventListener('pagehide', onTabLeaves);

        return () => {
            win.removeEventListener('pagehide', onPopOutClosed);
            window.removeEventListener('pagehide', onTabLeaves);
            win.close();
        };
    }, [popOut]);

    return { popOut, blocked, open, close };
}

function copyStyles(target: Document): Node[] {
    const nodes: Node[] = [];
    for (const node of document.head.querySelectorAll('style, link[rel="stylesheet"]')) {
        if (node instanceof HTMLLinkElement) {
            const link = target.createElement('link');
            link.rel = 'stylesheet';
            link.href = node.href;
            nodes.push(link);
        } else {
            const style = target.createElement('style');
            style.textContent = node.textContent;
            nodes.push(style);
        }
    }
    const viewport = target.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1';
    nodes.push(viewport);
    return nodes;
}
