interface ControllerHeaderProps {
    connected: boolean;
}

export function ControllerHeader({ connected }: ControllerHeaderProps) {
    return (
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
    );
}
