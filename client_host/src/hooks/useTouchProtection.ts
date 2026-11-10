import { useEffect } from 'react';

export function useTouchProtection() {
    useEffect(() => {
        const preventContextMenu = (event: Event) => {
            event.preventDefault();
        };

        const preventMultiTouch = (event: TouchEvent) => {
            if (event.touches.length > 1) {
                event.preventDefault();
            }
        };

        const preventGesture = (event: Event) => {
            event.preventDefault();
        };

        document.addEventListener('contextmenu', preventContextMenu);
        document.addEventListener('touchmove', preventMultiTouch, {
            passive: false,
        });

        document.addEventListener('gesturestart', preventGesture);
        document.addEventListener('gesturechange', preventGesture);
        document.addEventListener('gestureend', preventGesture);

        return () => {
            document.removeEventListener('contextmenu', preventContextMenu);
            document.removeEventListener('touchmove', preventMultiTouch);

            document.removeEventListener('gesturestart', preventGesture);
            document.removeEventListener('gesturechange', preventGesture);
            document.removeEventListener('gestureend', preventGesture);
        };
    }, []);
}
