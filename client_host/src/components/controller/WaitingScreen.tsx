import { RoomBanner } from './RoomBanner';

interface WaitingScreenProps {
    roomCode: string;
    displayName: string;
    connected: boolean;
}

export function WaitingScreen({ roomCode, displayName, connected }: WaitingScreenProps) {
    return (
        <section className="waiting-screen">
            <div className="waiting-icon">🎮</div>

            <h2>Tu es dans la partie !</h2>

            <RoomBanner roomCode={roomCode} displayName={displayName} />

            <div className="waiting-message">
                <div className="loading-spinner" />

                <h3>En attente du lancement par l'hôte...</h3>

                <p>Ta manette est connectée. La partie commencera dès que l'hôte lancera le jeu.</p>
            </div>

            <p className="connection-info">
                {connected ? '● Connecté au serveur' : '● Connexion perdue. Reconnexion...'}
            </p>
        </section>
    );
}
