import { useState } from 'react';
import type { ReactNode } from 'react';
import type { TrafficDirection } from 'sdk';
import { useMessageLogView } from './devToolsContext';
import {
    DIRECTION_LABELS,
    DIRECTION_SYMBOLS,
    MAX_LOG_ENTRIES,
    NO_FILTER,
    countNewSince,
    filterEntries,
    formatPayload,
    formatPayloadFull,
    formatTime,
    sourcesOf,
} from './logEntries';
import type { LogEntry, LogFilter } from './logEntries';

const MAX_SHOWN = 200;

const DIRECTIONS = Object.keys(DIRECTION_LABELS) as TrafficDirection[];

// `windowButton` opens or closes the separate window showing the log
export default function MessageLog({ windowButton }: { windowButton?: ReactNode }) {
    const { entries: live, pause, setPaused, clear } = useMessageLogView();
    const [filter, setFilter] = useState<LogFilter>(NO_FILTER);

    const paused = pause !== null;
    const entries = pause ? pause.entries : live;
    const newCount = pause ? countNewSince(live, pause.lastId) : 0;

    const sources = sourcesOf(entries);
    const shown = filterEntries(entries, filter);
    const newestFirst = shown.slice(-MAX_SHOWN).reverse();

    function change(patch: Partial<LogFilter>) {
        setFilter((current) => ({ ...current, ...patch }));
    }

    return (
        <div className="devtools-log">
            <div className="devtools-toolbar" role="group" aria-label="Filtres du journal">
                <div className="devtools-field">
                    <label htmlFor="devtools-log-source">Source</label>
                    <select
                        id="devtools-log-source"
                        value={filter.sourceId}
                        onChange={(e) => change({ sourceId: e.target.value })}
                    >
                        <option value="">Toutes</option>
                        {sources.map(({ sourceId, source }) => (
                            <option key={sourceId} value={sourceId}>
                                {source}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="devtools-field">
                    <label htmlFor="devtools-log-direction">Sens</label>
                    <select
                        id="devtools-log-direction"
                        value={filter.direction}
                        onChange={(e) =>
                            change({ direction: e.target.value as TrafficDirection | '' })
                        }
                    >
                        <option value="">Tous</option>
                        {DIRECTIONS.map((direction) => (
                            <option key={direction} value={direction}>
                                {DIRECTION_SYMBOLS[direction]} {DIRECTION_LABELS[direction]}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="devtools-field">
                    <label htmlFor="devtools-log-event">Événement</label>
                    <input
                        id="devtools-log-event"
                        type="search"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="game_message"
                        value={filter.event}
                        onChange={(e) => change({ event: e.target.value })}
                    />
                </div>
            </div>

            <div className="devtools-toolbar">
                <button
                    type="button"
                    className="devtools-secondary"
                    onClick={() => setPaused(!paused)}
                >
                    {paused ? `▶ Reprendre${newCount ? ` (+${newCount})` : ''}` : '⏸ Pause'}
                </button>
                <button
                    type="button"
                    className="devtools-secondary"
                    disabled={live.length === 0 && entries.length === 0}
                    onClick={clear}
                >
                    Vider
                </button>
                <button
                    type="button"
                    className="devtools-secondary"
                    disabled={shown.length === 0}
                    onClick={(e) => exportEntries(shown, e.currentTarget.ownerDocument)}
                >
                    Exporter en JSON
                </button>
                {windowButton}
            </div>

            <p className="devtools-note">
                {paused &&
                    `En pause : ${newCount} nouveau${newCount > 1 ? 'x' : ''} message${newCount > 1 ? 's' : ''} depuis, affiché${newCount > 1 ? 's' : ''} à la reprise. `}
                {shown.length} message{shown.length > 1 ? 's' : ''}
                {shown.length !== entries.length && ` sur ${entries.length}`}
                {shown.length > MAX_SHOWN && `, les ${MAX_SHOWN} plus récents affichés`}. Le journal
                garde les {MAX_LOG_ENTRIES} derniers.
            </p>

            {entries.length === 0 ? (
                <p className="devtools-empty">
                    Aucun message. Le journal montre ce que la page console et les manettes
                    virtuelles envoient et reçoivent. Les vrais téléphones n'y figurent que du côté
                    de la console.
                </p>
            ) : (
                <ol className="devtools-log-list">
                    {newestFirst.map((entry) => (
                        <LogLine key={entry.id} entry={entry} />
                    ))}
                </ol>
            )}
        </div>
    );
}

function LogLine({ entry }: { entry: LogEntry }) {
    const { direction, event, data, time, source } = entry;
    const summary = formatPayload(data);

    return (
        <li className={`devtools-log-line devtools-log-${direction}`}>
            <details>
                <summary>
                    <time className="devtools-log-time">{formatTime(time)}</time>
                    <span className="devtools-log-direction" title={DIRECTION_LABELS[direction]}>
                        <span aria-hidden="true">{DIRECTION_SYMBOLS[direction]}</span>
                        <span className="devtools-sr-only">{DIRECTION_LABELS[direction]}</span>
                    </span>
                    <span className="devtools-log-source">{source}</span>
                    <code className="devtools-log-event">{event}</code>
                    {summary && <code className="devtools-log-payload">{summary}</code>}
                </summary>
                <pre>{formatPayloadFull(data)}</pre>
            </details>
        </li>
    );
}

// Runs in the document of the clicked button: the overlay's, or the separate window's
function exportEntries(entries: LogEntry[], doc: Document) {
    const json = JSON.stringify(
        entries.map(({ time, source, direction, event, data }) => ({
            time: new Date(time).toISOString(),
            source,
            direction,
            event,
            data,
        })),
        null,
        2,
    );
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = doc.createElement('a');
    link.href = url;
    link.download = `panic-control-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
