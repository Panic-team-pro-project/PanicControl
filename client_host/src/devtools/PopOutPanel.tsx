import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { PopOutWindow } from './usePopOutWindow';

export function InPage({
    popOutWindow,
    notice,
    children,
}: {
    popOutWindow: PopOutWindow;
    notice: string;
    children: (openButton: ReactNode) => ReactNode;
}) {
    const { popOut, blocked, open, close } = popOutWindow;

    if (popOut) {
        return (
            <div className="devtools-empty">
                <p>{notice}</p>
                <div className="devtools-toolbar">
                    <button type="button" onClick={() => popOut.win.focus()}>
                        Afficher la fenêtre
                    </button>
                    <button type="button" className="devtools-secondary" onClick={close}>
                        Ramener ici
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {children(
                <button type="button" className="devtools-secondary" onClick={open}>
                    ⧉ Ouvrir dans une fenêtre
                </button>,
            )}
            {blocked && (
                <p className="devtools-error" role="alert">
                    Le navigateur a bloqué la fenêtre. Autorise les fenêtres pop-up pour ce site,
                    puis réessaie.
                </p>
            )}
        </>
    );
}

export function InWindow({
    popOutWindow,
    title,
    children,
}: {
    popOutWindow: PopOutWindow;
    title: string;
    children: (backButton: ReactNode) => ReactNode;
}) {
    const { popOut, close } = popOutWindow;
    if (!popOut) return null;

    return createPortal(
        <div className="devtools devtools-popout">
            <h1>{title}</h1>
            {children(
                <button type="button" className="devtools-secondary" onClick={close}>
                    Ramener dans la page
                </button>,
            )}
        </div>,
        popOut.container,
    );
}
