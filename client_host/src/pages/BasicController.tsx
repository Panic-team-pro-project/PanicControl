import '../css/controller_test_style.css';
import '../css/controllerMobileRestrictions.css';

import { useController } from '../hooks/useController';
import { useTouchProtection } from '../hooks/useTouchProtection';

import { ControllerHeader } from '../components/controller/ControllerHeader';
import { JoinRoomForm } from '../components/controller/JoinRoomForm';
import { RoomBanner } from '../components/controller/RoomBanner';
import { GameControls } from '../components/controller/JoystickButtons';

export default function Controller() {
    useTouchProtection();
    const {
        connected,
        joined,
        roomCode,
        setRoomCode,
        playerName,
        setPlayerName,
        displayName,
        error,
        joining,
        joinRoom,
        sendAction,
    } = useController();

    const gameInfo = {
        name: 'EpiAirConsole',
        description: 'Appuie sur le bouton pour dire bonjour.',
    };

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
            ) : (
                <section className="controller-game">
                    <RoomBanner roomCode={roomCode} displayName={displayName} />

                    <GameControls
                        disabled={!connected}
                        onMove={(data) => {
                            sendAction(
                                JSON.stringify({
                                    type: 'MOVE',
                                    ...data,
                                }),
                            );
                        }}
                        onRelease={() => {
                            sendAction(
                                JSON.stringify({
                                    type: 'STOP',
                                }),
                            );
                        }}
                        onAction={() => {
                            sendAction(
                                JSON.stringify({
                                    type: 'ACTION',
                                }),
                            );
                        }}
                    />
                </section>
            )}

            <footer>{gameInfo.name}</footer>
        </main>
    );
}
