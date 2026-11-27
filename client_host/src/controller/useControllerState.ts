import { useCallback, useSyncExternalStore } from 'react';
import type { ControllerSDK, GameManifest } from 'sdk';

export interface ControllerState {
    isHost: boolean;
    selectedGame: GameManifest | null;
    game: GameManifest | null;
    role: string | null;
    status: string | null;
}

export function useControllerState(sdk: ControllerSDK): ControllerState {
    const subscribe = useCallback(
        (notify: () => void) => {
            const offs = [
                sdk.onPromoteToHost(notify),
                sdk.onCatalogueSelection(notify),
                sdk.onGameStarted(notify),
                sdk.onGameStopped(notify),
                sdk.onPlayerStateChanged(notify),
            ];
            return () => offs.forEach((off) => off());
        },
        [sdk],
    );

    return {
        isHost: useSyncExternalStore(subscribe, () => sdk.isHost),
        selectedGame: useSyncExternalStore(subscribe, () => sdk.selectedGame),
        game: useSyncExternalStore(subscribe, () => sdk.game),
        role: useSyncExternalStore(subscribe, () => sdk.role),
        status: useSyncExternalStore(subscribe, () => sdk.status),
    };
}
