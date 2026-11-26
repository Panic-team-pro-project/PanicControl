import { useEffect, useRef, useState } from 'react';
import type { SubmitEvent } from 'react';
import '../css/controller_test_style.css';
import { ControllerSDK, PanicControlError } from 'sdk';
import type { GameManifest } from 'sdk';
import { SDK_DEBUG, SERVER_URL } from '../config';

type Direction = 'up' | 'down' | 'left' | 'right';

/** Server refusal when reconnecting with the id of a player whose previous socket is still alive. */
const PLAYER_ALREADY_CONNECTED = 'This player is already connected.';

const DPAD: { direction: Direction; label: string; glyph: string }[] = [
    { direction: 'up', label: 'Haut', glyph: '▲' },
    { direction: 'left', label: 'Gauche', glyph: '◀' },
    { direction: 'right', label: 'Droite', glyph: '▶' },
    { direction: 'down', label: 'Bas', glyph: '▼' },
];

function playerNoun(n: number): string {
    return n > 1 ? 'joueurs' : 'joueur';
}

function actionErrorMessage(err: unknown, selectedGame: GameManifest | null): string {
    if (err instanceof PanicControlError) {
        switch (err.code) {
            case 'NOT_ENOUGH_PLAYERS':
                if (!selectedGame) return 'Il faut plus de joueurs pour ce jeu.';
                return `Il faut au moins ${selectedGame.minPlayers} ${playerNoun(selectedGame.minPlayers)} pour ce jeu.`;
            case 'TOO_MANY_PLAYERS':
                if (!selectedGame) return 'Il y a trop de joueurs pour ce jeu.';
                return `Ce jeu accepte ${selectedGame.maxPlayers} ${playerNoun(selectedGame.maxPlayers)} au maximum.`;
            case 'NO_GAME_SELECTED':
                return 'Aucun jeu sélectionné.';
            case 'NOT_HOST':
                return "Seul l'hôte peut lancer ou quitter une partie.";
            case 'GAME_ALREADY_RUNNING':
                return 'Une partie est déjà en cours.';
            case 'NO_GAME_RUNNING':
                return 'Aucune partie en cours.';
            case 'TIMEOUT':
                return 'Le serveur ne répond pas. Réessaie dans un instant.';
        }
    }
    return 'Une erreur est survenue. Réessaie.';
}

export default function Controller() {
    const sdkRef = useRef<ControllerSDK | null>(null);

    const [connected, setConnected] = useState(false);
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
    const [isHost, setIsHost] = useState(false);
    const [selectedGame, setSelectedGame] = useState<GameManifest | null>(null);
    const [game, setGame] = useState<GameManifest | null>(null);
    const [actionError, setActionError] = useState('');
    const [pending, setPending] = useState(false);

    useEffect(() => {
        const sdk = new ControllerSDK({ serverUrl: SERVER_URL, debug: SDK_DEBUG });
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
            setIsHost(true);
            setFeedback("Tu es maintenant l'hôte du salon !");
        });

        sdk.onCatalogueSelection((selection) => {
            setSelectedGame(selection);
            setActionError('');
        });

        sdk.onGameStarted((started) => {
            setGame(started);
        });

        sdk.onGameStopped(() => {
            setGame(null);
        });

        sdk.onConsoleDisconnected((message) => {
            setFeedback(`La console s'est déconnecté. Reconnexion... (${message})`);
        });

        sdk.onConsoleReconnected((message) => {
            setFeedback(`La console est de retour ! (${message})`);
        });

        return () => {
            sdk.disconnect();
            sdkRef.current = null;
        };
    }, []);

    async function handleJoin(event: SubmitEvent<HTMLFormElement>) {
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
            setIsHost(sdkRef.current.isHost);
            setJoining(false);
            setRoomCode(code);
            setDisplayName(name);
            setFeedback('Manette prête !');
        } catch (err) {
            setJoining(false);

            // The server still sees our previous connection (e.g. after a network switch):
            // keep the saved id so the player can get their seat back once it is released.
            if (err instanceof Error && err.message === PLAYER_ALREADY_CONNECTED) {
                setError('Ta place est encore active. Réessaie dans quelques secondes.');
                return;
            }

            if (savedPlayerId) {
                localStorage.removeItem('player_id');
            }

            setError((err instanceof Error && err.message) || 'Impossible de rejoindre le salon.');
        }
    }

    function handleNavigate(direction: Direction) {
        sdkRef.current?.navigateCatalogue(direction);
    }

    async function runAction(action: 'start' | 'stop') {
        const sdk = sdkRef.current;
        if (!sdk || pending) return;

        setPending(true);
        try {
            if (action === 'start') {
                await sdk.startGame();
            } else {
                await sdk.stopGame();
            }
            setActionError('');
        } catch (err) {
            setActionError(actionErrorMessage(err, selectedGame));
        } finally {
            setPending(false);
        }
    }

    return (
        <main className="app">
            <header>
                <div className="brand">
                    <div className="logo">🎮</div>
                    <div>
                        <h1>PanicControl</h1>
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
                        <p className="sr-only" aria-live="polite">
                            {game
                                ? `Partie lancée : ${game.name}`
                                : selectedGame
                                  ? `Jeu sélectionné : ${selectedGame.name}`
                                  : ''}
                        </p>
                        {game ? (
                            <>
                                <h2 className="controller-heading">
                                    Partie en cours : {game.name}
                                </h2>
                                {isHost && (
                                    <button
                                        className="primary-button action-wide"
                                        type="button"
                                        disabled={pending}
                                        onClick={() => runAction('stop')}
                                    >
                                        {pending ? 'Un instant…' : 'Quitter la partie'}
                                    </button>
                                )}
                            </>
                        ) : isHost ? (
                            <>
                                <p className="selected-game">
                                    {selectedGame
                                        ? `Jeu sélectionné : ${selectedGame.name}`
                                        : 'Aucun jeu disponible'}
                                </p>
                                <div className="dpad" role="group" aria-label="Choix du jeu">
                                    {DPAD.map(({ direction, label, glyph }) => (
                                        <button
                                            key={direction}
                                            type="button"
                                            className={`dpad-button dpad-${direction}`}
                                            aria-label={label}
                                            onClick={() => handleNavigate(direction)}
                                        >
                                            <span aria-hidden="true">{glyph}</span>
                                        </button>
                                    ))}
                                </div>
                                <button
                                    className="primary-button action-wide"
                                    type="button"
                                    disabled={pending || !selectedGame}
                                    onClick={() => runAction('start')}
                                >
                                    {pending ? 'Lancement…' : 'OK — Lancer le jeu'}
                                </button>
                            </>
                        ) : (
                            <p className="selected-game">
                                L'hôte choisit un jeu…
                                {selectedGame ? ` Jeu sélectionné : ${selectedGame.name}` : ''}
                            </p>
                        )}

                        <p role="alert" className="error">
                            {actionError}
                        </p>

                        <p aria-live="polite">
                            {!connected ? 'Connexion perdue. Reconnexion...' : feedback}
                        </p>
                    </div>
                </section>
            )}

            <footer>PanicControl</footer>
        </main>
    );
}
