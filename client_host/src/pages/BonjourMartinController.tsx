import '../css/controller_test_style.css';
import '../css/controllerMobileRestrictions.css';

import { useController } from '../hooks/useController';
import { useTouchProtection } from '../hooks/useTouchProtection';

import { ControllerHeader } from '../components/controller/ControllerHeader';
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

    const gameInfo = {
        name: 'EpiAirConsole',
        description: 'Appuie sur le bouton pour dire bonjour.',
    };

    function handleAction() {
        sendAction('Le joueur a appuyé sur ACTION !');
    }

    return (
        <main className="controller-page">
            <ControllerHeader connected={connected} />

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
                <section>
                    <RoomBanner roomCode={roomCode} displayName={displayName} />

                    <div className="controller-panel">
                        <div className="controller-title">
                            <p>{gameInfo.description}</p>
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

                        {error && (
                            <div className="error" role="alert">
                                {error}
                            </div>
                        )}
                    </div>
                </section>
            )}

            <footer>{gameInfo.name}</footer>
        </main>
    );
}
