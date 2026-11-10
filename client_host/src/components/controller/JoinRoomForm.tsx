import type { FormEvent } from 'react';

interface JoinRoomFormProps {
    roomCode: string;
    playerName: string;
    error: string;
    joining: boolean;
    connected: boolean;
    onRoomCodeChange: (value: string) => void;
    onPlayerNameChange: (value: string) => void;
    onSubmit: () => void;
}

export function JoinRoomForm({
    roomCode,
    playerName,
    error,
    joining,
    connected,
    onRoomCodeChange,
    onPlayerNameChange,
    onSubmit,
}: JoinRoomFormProps) {
    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        onSubmit();
    }

    return (
        <section className="card">
            <p className="eyebrow">Bienvenue joueur</p>

            <h2>Rejoins la partie</h2>

            <p className="description">
                Entre le code affiché sur l'écran de la console pour connecter ta manette.
            </p>

            <form onSubmit={handleSubmit}>
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
                    onChange={(e) => onRoomCodeChange(e.target.value.toUpperCase())}
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
                    onChange={(e) => onPlayerNameChange(e.target.value)}
                />

                <button className="primary-button" type="submit" disabled={joining || !connected}>
                    {joining ? 'Connexion...' : 'Rejoindre la partie →'}
                </button>

                {error && (
                    <div className="error" role="alert">
                        {error}
                    </div>
                )}
            </form>
        </section>
    );
}
