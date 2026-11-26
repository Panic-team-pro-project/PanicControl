import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import '../css/bonjour_martin_style.css';
import { ConsoleSDK } from 'sdk';
import type { AccessibilityFeature, GameManifest, PlayerListInfo } from 'sdk';
import { PUBLIC_URL, SDK_DEBUG, SERVER_URL } from '../config';
import { useConsoleRoom } from '../devtools/devToolsContext';

const FEATURE_LABELS: Record<AccessibilityFeature, string> = {
    colorBlind: 'Mode daltonien',
    textSize: 'Taille du texte',
    slowDown: 'Ralentissement',
    textToSpeech: 'Lecture à voix haute',
    subtitles: 'Sous-titres',
    noFlashing: 'Sans effets clignotants',
    noVibration: 'Sans vibrations',
};

function playersLabel(game: GameManifest): string {
    const unit = (n: number) => (n > 1 ? 'joueurs' : 'joueur');
    if (game.minPlayers === game.maxPlayers) return `${game.minPlayers} ${unit(game.maxPlayers)}`;
    return `${game.minPlayers} à ${game.maxPlayers} joueurs`;
}

export default function BonjourMartin() {
    const [connected, setConnected] = useState(false);
    const [roomCode, setRoomCode] = useState('');
    const [players, setPlayers] = useState<PlayerListInfo[]>([]);
    const [error, setError] = useState('');
    const [games, setGames] = useState<GameManifest[]>([]);
    const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
    const [runningGame, setRunningGame] = useState<GameManifest | null>(null);
    const [isReconnecting, setIsReconnecting] = useState(false);

    const [announcement, setAnnouncement] = useState('');

    const sdkRef = useRef<ConsoleSDK | null>(null);

    // Developer mode
    useConsoleRoom(roomCode);

    useEffect(() => {
        const sdk = new ConsoleSDK({ serverUrl: SERVER_URL, debug: SDK_DEBUG });
        sdkRef.current = sdk;

        sdk.onConnect(() => {
            setConnected(true);

            const savedRoomCode = localStorage.getItem('console_room_code');
            if (savedRoomCode) {
                handleReconnect(savedRoomCode);
            }
        });

        sdk.onDisconnect((reason) => {
            setConnected(false);
            setError(`Connexion perdue (${reason}). Reconnexion...`);
        });

        sdk.onUpdatePlayers((updatedPlayers) => {
            setPlayers(Array.isArray(updatedPlayers) ? updatedPlayers : []);
        });

        sdk.onCatalogue((catalogue) => {
            setGames(catalogue.games);
            setSelectedGameId(catalogue.selectedGameId);
        });

        sdk.onCatalogueSelection((selectedGame) => {
            setSelectedGameId(selectedGame?.id ?? null);
            if (selectedGame) setAnnouncement(`Jeu sélectionné : ${selectedGame.name}`);
        });

        sdk.onGameStarted((game) => {
            setRunningGame(game);
            setAnnouncement(`Partie lancée : ${game.name}`);
        });

        sdk.onGameStopped(() => {
            setRunningGame(null);
            setAnnouncement('Retour au catalogue');
        });

        sdk.onRoomClosed((message) => {
            setError(message);
            setRoomCode('');
            localStorage.removeItem('console_room_code');
        });

        sdk.onDisconnectedUser((playerId) => {
            setPlayers((prevPlayers) =>
                prevPlayers.filter((player) => player.playerId !== playerId),
            );
        });

        return () => {
            sdk.disconnect();
            sdkRef.current = null;
        };
    }, []);

    async function createRoom() {
        if (!sdkRef.current) {
            setError("Le SDK n'est pas initialisé.");
            return;
        }

        try {
            setError('');
            const roomCode = await sdkRef.current.createRoom();

            setRoomCode(roomCode);
            localStorage.setItem('console_room_code', roomCode);
        } catch (err) {
            setError(
                (err instanceof Error && err.message) || 'Erreur lors de la création du salon.',
            );
        }
    }

    async function handleReconnect(codeToReconnect?: string) {
        if (!sdkRef.current) return;

        const code = codeToReconnect || localStorage.getItem('console_room_code');
        if (!code) return;

        setIsReconnecting(true);
        setError('');

        try {
            const activeRoomCode = await sdkRef.current.reconnectToRoom(code);
            setRoomCode(activeRoomCode);
            localStorage.setItem('console_room_code', activeRoomCode);
        } catch (err) {
            setError(
                (err instanceof Error && err.message) || 'Impossible de se reconnecter au salon.',
            );
            localStorage.removeItem('console_room_code');
        } finally {
            setIsReconnecting(false);
        }
    }

    const savedRoomCode = localStorage.getItem('console_room_code');
    const showMartin = players.length >= 1;

    const controllerUrl = `${PUBLIC_URL}/bonjour-martin-controller?roomCode=${encodeURIComponent(roomCode)}`;

    return (
        <main className="bonjour-martin-page">
            <Link className="back-link" to="/">
                ← Retour aux jeux
            </Link>

            <h1>📺 Écran Console (Hôte) — BonjourMartin</h1>

            <section className="card">
                <h3>État de la connexion</h3>

                <p>
                    Statut :{' '}
                    <span className={connected ? 'status-connected' : 'status-disconnected'}>
                        {connected ? 'Connecté' : 'Déconnecté'}
                    </span>
                </p>
            </section>

            {!roomCode && savedRoomCode && (
                <section className="card" id="reconnect-section">
                    <h3>Salon précédent détecté</h3>
                    <p>Un salon ({savedRoomCode}) était en cours.</p>
                    <button
                        onClick={() => handleReconnect(savedRoomCode)}
                        disabled={isReconnecting}
                    >
                        {isReconnecting ? 'Reconnexion...' : `Reprendre le salon ${savedRoomCode}`}
                    </button>
                    <button
                        onClick={() => localStorage.removeItem('console_room_code')}
                        style={{ marginLeft: '10px' }}
                    >
                        Ignorer
                    </button>
                    {error && <div className="error">{error}</div>}
                </section>
            )}

            {!roomCode && !savedRoomCode && (
                <section className="card" id="create-section">
                    <h3>Lancer une partie</h3>

                    <button id="create-btn" onClick={createRoom}>
                        Créer le salon
                    </button>

                    {error && <div className="error">{error}</div>}
                </section>
            )}

            {roomCode && (
                <section className="card" id="room-info-section">
                    <h3>Code du Salon :</h3>

                    <div id="active-room-code">{roomCode}</div>

                    <p>En attente de joueurs... (Max 8)</p>

                    <div className="bm-join-layout">
                        <div className="bm-qr-panel">
                            <h3>📱 Rejoindre avec un QR code</h3>

                            <p>Scannez ce code avec votre téléphone pour rejoindre le salon.</p>

                            <div className="qr-code">
                                <QRCodeSVG value={controllerUrl} size={200} level="H" />
                            </div>

                            <p>
                                Code du salon: <strong>{roomCode}</strong>
                            </p>
                        </div>

                        <div className="bm-martin-panel" id="wait_room_martin">
                            <p>Il y a t'il des joueurs..?</p>
                            {showMartin && <p>WOUAH Des Joueurs sont présents! Dites bonjour !</p>}
                            {showMartin && (
                                <img
                                    id="controllerImage"
                                    src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTP6pmEf7w2yY2rRwA10Te7leeEus5aiCjXkRm3aObOOA&s=10.png"
                                    alt="Controller"
                                />
                            )}
                        </div>
                    </div>

                    <h4>Joueurs connectés :</h4>

                    <ul id="players-list">
                        {players.length === 0 ? (
                            <li>
                                <em>Aucun joueur pour l'instant</em>
                            </li>
                        ) : (
                            players.map((player, index) => (
                                <li key={player.playerId || index}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <span>
                                            🎮 <strong>{player.name}</strong>
                                        </span>
                                        {player.isHost && (
                                            <span
                                                className="player-host-badge"
                                                style={{
                                                    fontSize: '0.8rem',
                                                    background: '#ffd700',
                                                    color: '#000',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontWeight: 'bold',
                                                }}
                                            >
                                                👑 Hôte
                                            </span>
                                        )}
                                    </div>

                                    {player.isConnected ? (
                                        <span className="player-connected">● En ligne</span>
                                    ) : (
                                        <span className="player-disconnected">
                                            ⏳ Connexion perdue...
                                        </span>
                                    )}
                                </li>
                            ))
                        )}
                    </ul>

                    {error && <div className="error">{error}</div>}

                    <p className="sr-only" aria-live="polite">
                        {announcement}
                    </p>

                    {runningGame ? (
                        <section aria-labelledby="game-running-title" className="bm-catalogue">
                            <h2 id="game-running-title">Partie : {runningGame.name}</h2>
                            <p>
                                Le chargement du jeu arrive bientôt. L'hôte peut quitter la partie
                                depuis sa manette.
                            </p>
                        </section>
                    ) : (
                        <section aria-labelledby="catalogue-title" className="bm-catalogue">
                            <h2 id="catalogue-title">Catalogue des jeux</h2>
                            <p>
                                L'hôte choisit le jeu avec la croix de sa manette, puis appuie sur
                                OK.
                            </p>
                            {games.length === 0 ? (
                                <p>Aucun jeu installé pour le moment.</p>
                            ) : (
                                <ul className="bm-game-list">
                                    {games.map((game) => {
                                        const isSelected = game.id === selectedGameId;
                                        return (
                                            <li
                                                key={game.id}
                                                className={
                                                    isSelected
                                                        ? 'bm-game-card bm-game-card-selected'
                                                        : 'bm-game-card'
                                                }
                                                aria-current={isSelected ? 'true' : undefined}
                                            >
                                                <h3>{game.name}</h3>
                                                {isSelected && (
                                                    <span className="bm-selected-badge">
                                                        Sélectionné
                                                    </span>
                                                )}
                                                <p>
                                                    {playersLabel(game)} · ≈ {game.durationMinutes}{' '}
                                                    min
                                                </p>
                                                {game.description && <p>{game.description}</p>}
                                                {game.accessibilityFeatures.length === 0 ? (
                                                    <p>Aucune option d'accessibilité déclarée</p>
                                                ) : (
                                                    <ul className="bm-feature-list">
                                                        {game.accessibilityFeatures.map(
                                                            (feature) => (
                                                                <li key={feature}>
                                                                    {FEATURE_LABELS[feature]}
                                                                </li>
                                                            ),
                                                        )}
                                                    </ul>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    )}
                </section>
            )}
        </main>
    );
}
