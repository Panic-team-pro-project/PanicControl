import { useEffect, useState } from 'react';
import type { ControllerSDK, Direction } from 'sdk';
import { DPAD, actionErrorMessage } from './controllerUi';
import { useControllerState } from './useControllerState';

export default function ControllerControls({ sdk }: { sdk: ControllerSDK }) {
    const { isHost, selectedGame, game } = useControllerState(sdk);
    const [actionError, setActionError] = useState('');
    const [pending, setPending] = useState(false);

    useEffect(() => sdk.onCatalogueSelection(() => setActionError('')), [sdk]);

    function handleNavigate(direction: Direction) {
        sdk.navigateCatalogue(direction);
    }

    async function runAction(action: 'start' | 'stop') {
        if (pending) return;

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
        <>
            <p className="sr-only" aria-live="polite">
                {game
                    ? `Partie lancée : ${game.name}`
                    : selectedGame
                      ? `Jeu sélectionné : ${selectedGame.name}`
                      : ''}
            </p>
            {game ? (
                <>
                    <h2 className="controller-heading">Partie en cours : {game.name}</h2>
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
        </>
    );
}
