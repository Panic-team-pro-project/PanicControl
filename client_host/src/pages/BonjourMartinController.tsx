import '../css/controller_test_style.css';
import '../css/controllerMobileRestrictions.css';
import '../css/controller_remote.css';

import { useController } from '../hooks/useController';
import { useTouchProtection } from '../hooks/useTouchProtection';

import { JoinRoomForm } from '../components/controller/JoinRoomForm';
import { RoomBanner } from '../components/controller/RoomBanner';
import { WaitingScreen } from '../components/controller/WaitingScreen';

export default function Controller() {
    useTouchProtection();

    const {
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
    } = useController();

    function handleCommand(command: string) {
        if (!connected) return;
        sendAction(command);
    }

    return (
        <main className="controller-page">
            {!joined ? (
                <JoinRoomForm
                    roomCode={roomCode}
                    playerName={playerName}
                    error={error}
                    joining={joining}
                    connected={connected}
                    onRoomCodeChange={setRoomCode}
                    onPlayerNameChange={setPlayerName}
                    onSubmit={joinRoom}
                />
            ) : !hostStarted ? (
                <WaitingScreen
                    roomCode={roomCode}
                    displayName={displayName}
                    connected={connected}
                />
            ) : (
                <section className="remote-screen">
                    <RoomBanner roomCode={roomCode} displayName={displayName} />

                    <div className="remote-heading">
                        <span className="remote-eyebrow">EPI AIR CONSOLE</span>
                        <h1>Game Remote</h1>
                        <p>Use the buttons to control the big screen.</p>
                    </div>

                    <div className="remote-controller">
                        <div className="dpad">
                            <button
                                className="remote-button direction up"
                                onClick={() => handleCommand('up')}
                                disabled={!connected}
                                aria-label="Move up"
                            >
                                ▲
                            </button>

                            <button
                                className="remote-button direction left"
                                onClick={() => handleCommand('left')}
                                disabled={!connected}
                                aria-label="Move left"
                            >
                                ◀
                            </button>

                            <button
                                className="remote-button confirm"
                                onClick={() => handleCommand('confirm')}
                                disabled={!connected}
                                aria-label="Confirm selection"
                            >
                                OK
                            </button>

                            <button
                                className="remote-button direction right"
                                onClick={() => handleCommand('right')}
                                disabled={!connected}
                                aria-label="Move right"
                            >
                                ▶
                            </button>

                            <button
                                className="remote-button direction down"
                                onClick={() => handleCommand('down')}
                                disabled={!connected}
                                aria-label="Move down"
                            >
                                ▼
                            </button>
                        </div>
                    </div>

                    <div className="remote-feedback" aria-live="polite">
                        <span className={`remote-status ${connected ? 'online' : ''}`} />
                        {connected
                            ? feedback || 'Controller connected'
                            : 'Connection lost. Reconnecting...'}
                    </div>

                    {error && (
                        <div className="error" role="alert">
                            {error}
                        </div>
                    )}

                    <footer className="remote-footer">CONNECTED AS {displayName}</footer>
                </section>
            )}
        </main>
    );
}
