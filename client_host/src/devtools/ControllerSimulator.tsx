import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import { useDevTools, useMessageLogView } from './devToolsContext';
import { formatPayload, receivedMessages } from './logEntries';
import {
    PHASE_LABELS,
    controllerSourceId,
    nextBotName,
    normalizeRoomCode,
} from './virtualControllers';
import type { VirtualController } from './virtualControllers';
import VirtualGameControls from './VirtualGameControls';

// `windowButton` opens or closes the separate window showing the controllers
export default function ControllerSimulator({ windowButton }: { windowButton?: ReactNode }) {
    const { consoleRoom, simulator } = useDevTools();
    const { controllers, add, removeAll } = simulator;
    const [roomInput, setRoomInput] = useState(consoleRoom ?? '');
    const [seenConsoleRoom, setSeenConsoleRoom] = useState(consoleRoom);
    if (consoleRoom !== seenConsoleRoom) {
        setSeenConsoleRoom(consoleRoom);
        if (consoleRoom) setRoomInput(consoleRoom);
    }
    const [name, setName] = useState('');

    const targetRoom = normalizeRoomCode(roomInput);
    const placeholderName = nextBotName(controllers.map((c) => c.name));

    function handleAdd(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!targetRoom) return;
        add(name.trim() || placeholderName, targetRoom);
        setName('');
    }

    return (
        <div className="devtools-simulator">
            <form className="devtools-toolbar" onSubmit={handleAdd}>
                <div className="devtools-field">
                    <label htmlFor="devtools-room">Code du salon</label>
                    <input
                        id="devtools-room"
                        type="text"
                        maxLength={8}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="ABC123"
                        value={roomInput}
                        onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                    />
                </div>
                <div className="devtools-field">
                    <label htmlFor="devtools-name">Pseudo</label>
                    <input
                        id="devtools-name"
                        type="text"
                        maxLength={15}
                        autoComplete="off"
                        placeholder={placeholderName}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <button type="submit" disabled={!targetRoom}>
                    Ajouter une manette virtuelle
                </button>
                <button
                    type="button"
                    className="devtools-secondary"
                    disabled={controllers.length === 0}
                    onClick={removeAll}
                >
                    Tout retirer
                </button>
                {windowButton}
            </form>

            <p className="devtools-note" aria-live="polite">
                {targetRoom ? (
                    <>
                        Salon visé : <strong>{targetRoom}</strong>
                        {targetRoom === consoleRoom && ' (celui de cette page)'}
                    </>
                ) : (
                    'Aucun salon : crée-en un sur la page console ou saisis un code.'
                )}
            </p>

            {controllers.length === 0 ? (
                <p className="devtools-empty">
                    Aucune manette virtuelle. Chacune rejoint le salon comme un vrai téléphone et
                    compte dans la limite de joueurs.
                </p>
            ) : (
                <ul className="devtools-grid">
                    {controllers.map((controller) => (
                        <VirtualPhone key={controller.id} controller={controller} />
                    ))}
                </ul>
            )}
        </div>
    );
}

function VirtualPhone({ controller }: { controller: VirtualController }) {
    const { simulator } = useDevTools();
    const { id, name, roomCode, phase, connected, isHost, consoleOnline, error, playerId, sdk } =
        controller;
    const online = phase === 'joined' && connected;

    return (
        <li className={`devtools-phone devtools-phase-${phase}`} aria-label={`Manette ${name}`}>
            <div className="devtools-phone-header">
                <strong>{name}</strong>
                {isHost && <span className="devtools-host">👑 Hôte</span>}
                <span className={`devtools-status ${online ? 'devtools-online' : ''}`}>
                    {PHASE_LABELS[phase]}
                </span>
            </div>

            <p className="devtools-note">
                Salon <strong>{roomCode}</strong>
            </p>

            {online && !consoleOnline && (
                <p className="devtools-note">La console est déconnectée.</p>
            )}

            {error && (
                <p className="devtools-error" role="alert">
                    {error}
                </p>
            )}

            {online && sdk && <VirtualGameControls sdk={sdk} id={id} />}

            <ReceivedMessages id={id} />

            <div className="devtools-phone-actions">
                {phase === 'joined' && (
                    <button
                        type="button"
                        className="devtools-secondary"
                        onClick={() => simulator.dropConnection(id)}
                    >
                        Couper la connexion
                    </button>
                )}
                {phase === 'offline' && playerId && (
                    <button type="button" onClick={() => simulator.reconnect(id)}>
                        Reconnecter
                    </button>
                )}
                <button
                    type="button"
                    className="devtools-secondary"
                    aria-label={`Retirer ${name}`}
                    onClick={() => simulator.remove(id)}
                >
                    Retirer
                </button>
            </div>
        </li>
    );
}

// The last game messages this controller received, taken from the log
function ReceivedMessages({ id }: { id: number }) {
    const { entries } = useMessageLogView();
    const messages = receivedMessages(entries, controllerSourceId(id));
    if (messages.length === 0) return null;

    return (
        <div className="devtools-received">
            <p className="devtools-note">Derniers messages reçus</p>
            <ul>
                {messages.map(({ id: entryId, type, data, isPrivate }) => (
                    <li key={entryId}>
                        <span title={isPrivate ? 'Privé' : 'À tous'}>
                            <span aria-hidden="true">{isPrivate ? '🔒' : '📢'}</span>
                            <span className="devtools-sr-only">
                                {isPrivate ? 'Privé : ' : 'À tous : '}
                            </span>
                        </span>{' '}
                        <code>{type}</code> {formatPayload(data, 40)}
                    </li>
                ))}
            </ul>
        </div>
    );
}
