import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ConsoleSDK } from 'sdk';
import type { PlayerListInfo } from 'sdk';
import { PUBLIC_URL, SERVER_URL } from '../config';
import '../css/client_host.css';

const games = [
    {
        title: 'Dites bonjour à Martin',
        description: "Soyez quelqu'un de cool et dites bonjour à Martin.",
        emoji: '👋',
        path: '/bonjour-martin',
        category: 'Party game',
    },
];

export default function EpiAirConsole() {
    const [connected, setConnected] = useState(false);
    const [roomCode, setRoomCode] = useState('');
    const [players, setPlayers] = useState<PlayerListInfo[]>([]);
    const [error, setError] = useState('');
    const [activity, setActivity] = useState(false);
    const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);

    const sdkRef = useRef<ConsoleSDK | null>(null);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    async function enterFullscreen() {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            }
        } catch {
            setError('Fullscreen is not available in this browser.');
        }
    }

    async function exitFullscreen() {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch {
            setError('Unable to exit fullscreen.');
        }
    }

    useEffect(() => {
        const sdk = new ConsoleSDK(SERVER_URL);
        sdkRef.current = sdk;

        sdk.onConnect(async () => {
            setConnected(true);

            const savedCode = localStorage.getItem('console_room_code');

            if (!savedCode) {
                setError('No active room found. Please create a room first.');
                return;
            }

            try {
                const activeCode = await sdk.reconnectToRoom(savedCode);

                setRoomCode(activeCode);
                localStorage.setItem('console_room_code', activeCode);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unable to reconnect to the room.');
            }
        });

        sdk.onDisconnect((reason) => {
            setConnected(false);
            setError(`Connection lost (${reason}). Reconnecting...`);
        });

        sdk.onUpdatePlayers((updatedPlayers) => {
            setPlayers(Array.isArray(updatedPlayers) ? updatedPlayers : []);
        });

        sdk.onGameInfo(() => {
            setActivity(false);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => setActivity(true));
            });
        });

        sdk.onRoomClosed((message) => {
            setError(message);
            setRoomCode('');
            setPlayers([]);
            localStorage.removeItem('console_room_code');
        });

        sdk.onDisconnectedUser((playerId) => {
            setPlayers((previous) => previous.filter((player) => player.playerId !== playerId));
        });

        return () => {
            sdk.disconnect();
            sdkRef.current = null;
        };
    }, []);

    const connectedPlayers = players.filter((player) => player.isConnected);

    const hasPlayers = connectedPlayers.length > 0;

    const controllerUrl =
        `${PUBLIC_URL}/bonjour-martin-controller?roomCode=` + encodeURIComponent(roomCode);

    return (
        <main className={`console-screen ${activity ? 'activity-pulse' : ''}`}>
            <header className="console-toolbar">
                <Link to="/" className="host-logo">
                    <span className="logo-icon">E</span>
                    EPI<span>AIR</span>CONSOLE
                </Link>

                <div className="toolbar-room">
                    <span className="small-label">ROOM</span>
                    <strong>{roomCode || 'CONNECTING...'}</strong>
                </div>

                <div className="toolbar-players">
                    <span className="small-label">PLAYERS ({connectedPlayers.length})</span>

                    <div className="player-chips">
                        {connectedPlayers.length === 0 ? (
                            <span className="waiting-label">Waiting for players...</span>
                        ) : (
                            connectedPlayers.map((player, index) => (
                                <div className="player-chip" key={player.playerId || index}>
                                    <span className="player-indicator" />
                                    {player.name}
                                    {player.isHost && <span className="host-crown">★</span>}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="toolbar-actions">
                    <div className="host-status">
                        <span className={`status-dot ${connected ? 'online' : ''}`} />
                        {connected ? 'ONLINE' : 'OFFLINE'}
                    </div>

                    <button
                        className="fullscreen-button"
                        onClick={fullscreen ? exitFullscreen : enterFullscreen}
                        title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    >
                        {fullscreen ? '↙ EXIT' : '↗ FULLSCREEN'}
                    </button>
                </div>
            </header>

            {!roomCode ? (
                <section className="console-loading">
                    <div className="waiting-animation" />
                    <h2>Connecting to your room...</h2>
                    <p>{error || 'Please wait while the console reconnects.'}</p>

                    {error && (
                        <Link to="/" className="console-back">
                            BACK TO HOME
                        </Link>
                    )}
                </section>
            ) : !hasPlayers ? (
                <section className="waiting-room">
                    <div className="waiting-content">
                        <div className="hero-tag">
                            <span /> ROOM CREATED
                        </div>

                        <h1>
                            Ready to <span>play?</span>
                        </h1>

                        <p>Scan the QR code with your phone to join the game room.</p>

                        <div className="qr-container">
                            <QRCodeSVG
                                value={controllerUrl}
                                size={220}
                                level="H"
                                bgColor="#ffffff"
                                fgColor="#080b09"
                            />
                        </div>

                        <div className="room-code-display">
                            <span className="small-label">ROOM CODE</span>
                            <strong>{roomCode}</strong>
                        </div>

                        <div className="waiting-indicator">
                            <span className="waiting-animation" />
                            WAITING FOR PLAYERS
                        </div>
                    </div>

                    <div className="waiting-side">
                        <div className="waiting-icon">🎮</div>
                        <h2>Your phones are the controllers.</h2>
                        <p>Open your phone camera, scan the QR code, and join the room.</p>

                        <div className="player-count">
                            <strong>{connectedPlayers.length}</strong>
                            <span>PLAYERS CONNECTED</span>
                        </div>
                    </div>
                </section>
            ) : (
                <section className="game-library">
                    <div className="library-heading">
                        <div>
                            <div className="hero-tag">
                                <span /> MULTIPLAYER SESSION
                            </div>

                            <h1>
                                Choose your <span>game.</span>
                            </h1>

                            <p>Select a game to start playing together.</p>
                        </div>

                        <div className="library-player-count">
                            <strong>{connectedPlayers.length}</strong>
                            PLAYERS READY
                        </div>
                    </div>

                    <div className="game-grid">
                        {games.map((game) => (
                            <Link to={game.path} className="console-game-card" key={game.path}>
                                <div className="game-art">
                                    <span>{game.emoji}</span>
                                    <div className="game-art-glow" />
                                </div>

                                <div className="game-details">
                                    <span className="game-category">{game.category}</span>

                                    <h2>{game.title}</h2>
                                    <p>{game.description}</p>

                                    <div className="game-play">
                                        PLAY GAME <span>→</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    <div className="library-footer">
                        <span>EPIAIRCONSOLE</span>
                        <span>{connectedPlayers.length} PLAYERS ONLINE</span>
                    </div>
                </section>
            )}

            {error && roomCode && <div className="console-error">{error}</div>}
        </main>
    );
}
