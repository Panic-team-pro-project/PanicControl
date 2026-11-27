import { useState } from 'react';
import type { SubmitEvent } from 'react';
import type { ControllerSDK } from 'sdk';
import ControllerControls from '../controller/ControllerControls';
import { useControllerState } from '../controller/useControllerState';

export default function VirtualGameControls({ sdk, id }: { sdk: ControllerSDK; id: number }) {
    const { game, role, status } = useControllerState(sdk);

    return (
        <div className="devtools-controls">
            <ControllerControls sdk={sdk} />

            {(role || status) && (
                <p className="devtools-note">
                    {role && (
                        <>
                            Rôle secret : <strong>{role}</strong>
                        </>
                    )}
                    {role && status && ' · '}
                    {status && (
                        <>
                            Statut : <strong>{status}</strong>
                        </>
                    )}
                </p>
            )}

            {game && <ActionForm sdk={sdk} id={id} />}
        </div>
    );
}

const MAX_RECENT_ACTIONS = 5;

// Sends an action of any type, with optional JSON data. The screen receives it as a player action.
function ActionForm({ sdk, id }: { sdk: ControllerSDK; id: number }) {
    const [type, setType] = useState('');
    const [data, setData] = useState('');
    const [recent, setRecent] = useState<string[]>([]);
    const [error, setError] = useState('');

    function send(actionType: string, payload?: unknown) {
        if (payload === undefined) {
            sdk.sendAction(actionType);
        } else {
            sdk.sendAction(actionType, payload);
        }
        setError('');
        setRecent((list) =>
            [actionType, ...list.filter((t) => t !== actionType)].slice(0, MAX_RECENT_ACTIONS),
        );
    }

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        const actionType = type.trim();
        if (!actionType) return;

        const text = data.trim();
        if (text === '') {
            send(actionType);
            return;
        }
        try {
            send(actionType, JSON.parse(text));
        } catch {
            setError('Les données doivent être du JSON valide, par exemple { "x": 1 }.');
        }
    }

    const typeId = `devtools-action-type-${id}`;
    const dataId = `devtools-action-data-${id}`;

    return (
        <form className="devtools-action-form" onSubmit={handleSubmit}>
            <label htmlFor={typeId}>Action</label>
            <input
                id={typeId}
                type="text"
                autoComplete="off"
                placeholder="jump"
                value={type}
                onChange={(e) => setType(e.target.value)}
            />
            <label htmlFor={dataId}>Données JSON (facultatif)</label>
            <input
                id={dataId}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder='{ "x": 1 }'
                value={data}
                onChange={(e) => setData(e.target.value)}
            />
            <button type="submit" disabled={!type.trim()}>
                Envoyer l'action
            </button>

            {error && (
                <p className="devtools-error" role="alert">
                    {error}
                </p>
            )}

            {recent.length > 0 && (
                <div className="devtools-recent" role="group" aria-label="Renvoyer une action">
                    {recent.map((actionType) => (
                        <button
                            key={actionType}
                            type="button"
                            className="devtools-secondary"
                            title="Renvoyer sans données"
                            onClick={() => send(actionType)}
                        >
                            {actionType}
                        </button>
                    ))}
                </div>
            )}
        </form>
    );
}
