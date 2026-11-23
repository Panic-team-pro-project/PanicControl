import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConsoleSDK } from 'sdk';
import { SERVER_URL } from '../config';
import '../css/client_host.css';

export default function Home() {
    const navigate = useNavigate();
    const sdkRef = useRef<ConsoleSDK | null>(null);

    const [connected, setConnected] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [savedRoomCode, setSavedRoomCode] = useState(
        () => localStorage.getItem('console_room_code') || '',
    );

    useEffect(() => {
        const sdk = new ConsoleSDK(SERVER_URL);
        sdkRef.current = sdk;

        sdk.onConnect(() => setConnected(true));
        sdk.onDisconnect(() => setConnected(false));

        return () => {
            sdk.disconnect();
            sdkRef.current = null;
        };
    }, []);

    async function createRoom() {
        if (!sdkRef.current || loading) return;

        setLoading(true);
        setError('');

        // Fullscreen must be requested directly from the click.
        const fullscreenPromise = document.documentElement.requestFullscreen?.().catch(() => null);

        try {
            const code = await sdkRef.current.createRoom();

            localStorage.setItem('console_room_code', code);
            setSavedRoomCode(code);

            await fullscreenPromise;

            navigate('/airconsole');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to create the room.');

            if (document.fullscreenElement) {
                await document.exitFullscreen().catch(() => {});
            }
        } finally {
            setLoading(false);
        }
    }

    async function reconnect() {
        if (!sdkRef.current || !savedRoomCode || loading) return;

        setLoading(true);
        setError('');

        const fullscreenPromise = document.documentElement.requestFullscreen?.().catch(() => null);

        try {
            // The console page handles the actual SDK reconnection.
            await fullscreenPromise;
            navigate('/airconsole');
        } finally {
            setLoading(false);
        }
    }

    function forgetRoom() {
        localStorage.removeItem('console_room_code');
        setSavedRoomCode('');
    }

    return (
        <main className="host-page">
            <nav className="host-nav">
                <Link to="/" className="host-logo">
                    <span className="logo-icon">E</span>
                    EPI<span>AIR</span>CONSOLE
                </Link>

                <div className="host-status">
                    <span className={`status-dot ${connected ? 'online' : ''}`} />
                    {connected ? 'SYSTEM ONLINE' : 'CONNECTING'}
                </div>
            </nav>

            <section className="host-hero">
                <div className="hero-tag">
                    <span /> YOUR GAMING HUB
                </div>

                <h1>
                    Your screen.
                    <br />
                    <span>Your games.</span>
                    <br />
                    Everyone plays.
                </h1>

                <p className="hero-description">
                    Turn your screen into a multiplayer gaming console. Connect your phones and play
                    together. No controllers needed.
                </p>

                <div className="hero-actions">
                    <button
                        className="neon-button"
                        onClick={createRoom}
                        disabled={!connected || loading}
                    >
                        {loading ? 'STARTING...' : 'CREATE A ROOM'}
                        <span>→</span>
                    </button>
                </div>

                {savedRoomCode && (
                    <div className="reconnect-card">
                        <div>
                            <span className="small-label">PREVIOUS SESSION</span>
                            <strong>{savedRoomCode}</strong>
                        </div>

                        <button onClick={reconnect} disabled={!connected || loading}>
                            RECONNECT →
                        </button>

                        <button className="forget-button" onClick={forgetRoom}>
                            Forget
                        </button>
                    </div>
                )}

                {error && <div className="host-error">{error}</div>}

                <div className="hero-features">
                    <div>
                        <span>01</span>
                        <strong>Create a room</strong>
                        <p>Start your multiplayer session.</p>
                    </div>

                    <div>
                        <span>02</span>
                        <strong>Connect your phones</strong>
                        <p>Scan the QR code to join.</p>
                    </div>

                    <div>
                        <span>03</span>
                        <strong>Choose a game</strong>
                        <p>Play together on one screen.</p>
                    </div>
                </div>
            </section>

            <footer className="host-footer">
                EPIAIRCONSOLE <span>•</span> MULTIPLAYER GAMING
            </footer>
        </main>
    );
}
