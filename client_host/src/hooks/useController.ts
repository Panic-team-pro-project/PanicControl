import { useCallback, useEffect, useRef, useState } from 'react';
import { ControllerSDK } from 'sdk';
import { SERVER_URL } from '../config';

export function useController() {
    const sdkRef = useRef<ControllerSDK | null>(null);

    const [connected, setConnected] = useState(false);
    const [joined, setJoined] = useState(false);
    const [hostStarted, setHostStarted] = useState(false);

    const [roomCode, setRoomCode] = useState(
        () => new URLSearchParams(window.location.search).get('roomCode')?.toUpperCase() ?? '',
    );

    const [playerName, setPlayerName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('En attente de connexion...');
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        const sdk = new ControllerSDK(SERVER_URL);
        sdkRef.current = sdk;

        sdk.onConnect(() => {
            setConnected(true);
            setFeedback('Connecté au serveur !');
        });

        sdk.onDisconnect((reason) => {
            setConnected(false);
            setFeedback(`Connexion perdue (${reason}). Reconnexion...`);
        });

        sdk.onPromoteToHost(() => {
            setFeedback("Tu es maintenant l'hôte du salon !");
        });

        sdk.onConsoleDisconnected((message) => {
            setFeedback(`La console s'est déconnectée. Reconnexion... (${message})`);
        });

        sdk.onConsoleReconnected((message) => {
            setFeedback(`La console est de retour ! (${message})`);
        });

        return () => {
            sdk.disconnect();
            sdkRef.current = null;
        };
    }, []);

    const joinRoom = useCallback(async () => {
        const code = roomCode.trim().toUpperCase();
        const name = playerName.trim();

        setError('');

        if (!code || !name) {
            setError('Remplis le code du salon et ton pseudo.');
            return;
        }

        if (!sdkRef.current) {
            setError("Le SDK n'est pas initialisé.");
            return;
        }

        setJoining(true);

        const savedPlayerId = localStorage.getItem('player_id');

        try {
            const assignedPlayerId = savedPlayerId
                ? await sdkRef.current.reconnectToRoom(code, name, savedPlayerId)
                : await sdkRef.current.joinRoom(code, name);

            localStorage.setItem('player_id', assignedPlayerId);

            setJoined(true);
            setHostStarted(false);
            setRoomCode(code);
            setDisplayName(name);

            setFeedback("En attente du lancement par l'hôte...");
        } catch (err) {
            if (savedPlayerId) {
                localStorage.removeItem('player_id');
            }

            setError(err instanceof Error ? err.message : 'Impossible de rejoindre le salon.');
        } finally {
            setJoining(false);
        }
    }, [roomCode, playerName]);

    const sendAction = useCallback(
        (message: string) => {
            if (!sdkRef.current || !connected || !joined || !hostStarted) {
                return;
            }

            const playerId = localStorage.getItem('player_id');

            if (!playerId) {
                setError('Identifiant joueur introuvable.');
                return;
            }

            sdkRef.current.sendAction(playerId, message);
        },
        [connected, joined, hostStarted],
    );

    return {
        connected,
        joined,
        hostStarted,
        roomCode,
        setRoomCode,
        playerName,
        setPlayerName,
        displayName,
        error,
        feedback,
        joining,
        joinRoom,
        sendAction,
    };
}
