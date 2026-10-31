import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import '../css/controller_test_style.css';
import { ControllerSDK } from 'sdk';
import { SERVER_URL } from '../config';

export default function Controller() {
    const sdkRef = useRef<ControllerSDK | null>(null);

    const [connected] = useState(true);
    const [joined, setJoined] = useState(false);
    // Prefill room code from QR code URL
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

        return () => {
            sdk.disconnect();
            sdkRef.current = null;
        };
    }, []);

    async function handleJoin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

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
            setJoining(false);
            setRoomCode(code);
            setDisplayName(name);
            setFeedback('Manette prête !');
        } catch (err) {
            if (savedPlayerId) {
                localStorage.removeItem('player_id');
            }

            setJoining(false);
            setError((err instanceof Error && err.message) || 'Impossible de rejoindre le salon.');
        }
    }

    function handleAction() {
        if (!sdkRef.current || !joined) return;

        // if (sdkRef.current.sendAction) {
        //   sdkRef.current.sendAction({
        //     playerId: playerId,
        //     message: "Le joueur a appuyé sur ACTION !",
        //   });
        // }
    }

    return (
        <main className="app">
            <header>
                <div className="brand">
                    <div className="logo">🎮</div>
                    <div>
                        <h1>EpiAirConsole</h1>
                        <p className="subtitle">Mobile Controller</p>
                    </div>
                </div>

                <div className="status">
                    <span className={`dot ${connected ? 'online' : ''}`} />
                    <span>{connected ? 'Connecté' : 'Déconnecté'}</span>
                </div>
            </header>

            {!joined ? (
                <section className="card">
                    <p className="eyebrow">Bienvenue joueur</p>
                    <h2>Rejoins la partie</h2>

                    <p className="description">
                        Entre le code affiché sur l'écran de la console pour connecter ta manette.
                    </p>

                    <form onSubmit={handleJoin}>
                        <label htmlFor="room-code">Code du salon</label>
                        <input
                            id="room-code"
                            type="text"
                            placeholder="ABCD"
                            maxLength={8}
                            autoComplete="off"
                            autoCapitalize="characters"
                            spellCheck={false}
                            required
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        />

                        <label htmlFor="player-name">Ton pseudo</label>
                        <input
                            id="player-name"
                            type="text"
                            placeholder="Ex. Luigi"
                            maxLength={15}
                            autoComplete="nickname"
                            required
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                        />

                        <button className="primary-button" type="submit" disabled={joining}>
                            {joining ? 'Connexion...' : 'Rejoindre la partie →'}
                        </button>

                        <div className="error" role="alert">
                            {error}
                        </div>
                    </form>
                </section>
            ) : (
                <section>
                    <div className="room-banner">
                        <div>
                            <div className="room-label">Salon connecté</div>
                            <div>{roomCode}</div>
                        </div>
                        <div>{displayName}</div>
                    </div>

                    <div className="controller-panel">
                        <div className="controller-title">
                            <p>Appuie sur le bouton pour dire bonjour.</p>
                        </div>

                        <button
                            id="action-button"
                            type="button"
                            disabled={!connected}
                            onClick={handleAction}
                        >
                            <span>Bonjour :D</span>
                        </button>

                        <p aria-live="polite">
                            {!connected ? 'Connexion perdue. Reconnexion...' : feedback}
                        </p>
                    </div>
                </section>
            )}

            <footer>EpiAirConsole</footer>
        </main>
    );
}
