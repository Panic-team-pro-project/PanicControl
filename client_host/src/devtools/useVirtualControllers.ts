import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ControllerSDK } from 'sdk';
import { SDK_DEBUG, SERVER_URL } from '../config';
import { newController } from './virtualControllers';
import type { VirtualController } from './virtualControllers';

export interface VirtualControllers {
    controllers: VirtualController[];
    add: (name: string, roomCode: string) => Promise<void>;
    dropConnection: (id: number) => void;
    reconnect: (id: number) => Promise<void>;
    remove: (id: number) => void;
    removeAll: () => void;
}

export function useVirtualControllers(): VirtualControllers {
    const [controllers, setControllers] = useState<VirtualController[]>([]);
    const sdks = useRef(new Map<number, ControllerSDK>());
    const nextId = useRef(1);

    const update = useCallback((id: number, patch: Partial<VirtualController>) => {
        setControllers((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    }, []);

    const close = useCallback(
        (id: number) => {
            sdks.current.get(id)?.disconnect();
            sdks.current.delete(id);
            update(id, { sdk: null });
        },
        [update],
    );

    const connect = useCallback(
        (id: number): ControllerSDK => {
            close(id);

            const sdk = new ControllerSDK({ serverUrl: SERVER_URL, debug: SDK_DEBUG });
            sdks.current.set(id, sdk);

            sdk.onConnect(() => update(id, { connected: true }));
            sdk.onDisconnect(() => update(id, { connected: false }));
            sdk.onPromoteToHost(() => update(id, { isHost: true }));
            sdk.onConsoleDisconnected(() => update(id, { consoleOnline: false }));
            sdk.onConsoleReconnected(() => update(id, { consoleOnline: true }));

            return sdk;
        },
        [close, update],
    );

    const add = useCallback(
        async (name: string, roomCode: string) => {
            const id = nextId.current++;
            setControllers((list) => [...list, newController(id, name, roomCode)]);

            const sdk = connect(id);
            try {
                const playerId = await sdk.joinRoom(roomCode, name);
                update(id, { phase: 'joined', playerId, isHost: sdk.isHost, error: '', sdk });
            } catch (err) {
                close(id);
                update(id, { phase: 'failed', connected: false, error: errorText(err) });
            }
        },
        [close, connect, update],
    );

    const dropConnection = useCallback(
        (id: number) => {
            close(id);
            update(id, { phase: 'offline', connected: false, error: '' });
        },
        [close, update],
    );

    const reconnect = useCallback(
        async (id: number) => {
            const controller = controllers.find((c) => c.id === id);
            if (!controller?.playerId) return;

            update(id, { phase: 'joining', error: '' });
            const sdk = connect(id);
            try {
                const playerId = await sdk.reconnectToRoom(
                    controller.roomCode,
                    controller.name,
                    controller.playerId,
                );
                update(id, { phase: 'joined', playerId, isHost: sdk.isHost, sdk });
            } catch (err) {
                close(id);
                update(id, { phase: 'offline', connected: false, error: errorText(err) });
            }
        },
        [close, connect, controllers, update],
    );

    const remove = useCallback(
        (id: number) => {
            close(id);
            setControllers((list) => list.filter((c) => c.id !== id));
        },
        [close],
    );

    const removeAll = useCallback(() => {
        for (const sdk of sdks.current.values()) sdk.disconnect();
        sdks.current.clear();
        setControllers([]);
    }, []);

    useEffect(() => {
        const open = sdks.current;
        return () => {
            for (const sdk of open.values()) sdk.disconnect();
            open.clear();
        };
    }, []);

    return useMemo(
        () => ({ controllers, add, dropConnection, reconnect, remove, removeAll }),
        [controllers, add, dropConnection, reconnect, remove, removeAll],
    );
}

function errorText(err: unknown): string {
    return (err instanceof Error && err.message) || 'Impossible de rejoindre le salon.';
}
