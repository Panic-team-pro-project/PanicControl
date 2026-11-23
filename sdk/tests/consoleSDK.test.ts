import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleSDK, PanicControlError } from '../src/index.js';
import type { GameManifest, PlayerListInfo } from '../src/index.js';

type Listener = (...args: unknown[]) => void;

// Stand-in for a socket.io-client socket
const { FakeSocket, sockets } = vi.hoisted(() => {
    const sockets: InstanceType<typeof FakeSocket>[] = [];

    class FakeSocket {
        id = 'fake-id';
        disconnected = false;
        // What the SDK emitted without waiting for an answer, and with one
        sent: unknown[][] = [];
        requests: unknown[][] = [];
        // What the next acknowledged request gets: an answer, or an error (timeout)
        ack: unknown = { ok: true };
        ackError: Error | undefined;
        timeoutMs: number | undefined;
        private listeners = new Map<string, Listener[]>();

        constructor() {
            sockets.push(this);
        }

        on(event: string, listener: Listener): this {
            this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
            return this;
        }

        off(event: string, listener: Listener): this {
            this.listeners.set(
                event,
                (this.listeners.get(event) ?? []).filter((l) => l !== listener),
            );
            return this;
        }

        emit(event: string, ...args: unknown[]): this {
            this.sent.push([event, ...args]);
            return this;
        }

        timeout(ms: number) {
            this.timeoutMs = ms;
            return {
                emitWithAck: (event: string, ...args: unknown[]): Promise<unknown> => {
                    this.requests.push([event, ...args]);
                    return this.ackError
                        ? Promise.reject(this.ackError)
                        : Promise.resolve(this.ack);
                },
            };
        }

        disconnect(): this {
            this.disconnected = true;
            return this;
        }

        // Simulates the server sending an event
        receive(event: string, ...args: unknown[]): void {
            for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...args);
        }

        listenerCount(event: string): number {
            return (this.listeners.get(event) ?? []).length;
        }
    }

    return { FakeSocket, sockets };
});

vi.mock('socket.io-client', () => ({ io: () => new FakeSocket() }));

const GAME: GameManifest = {
    id: 'duo',
    name: 'Duo',
    version: '1.0.0',
    minPlayers: 2,
    maxPlayers: 2,
    durationMinutes: 5,
    controllerComponents: ['button'],
    accessibilityFeatures: [],
    entry: { screen: 'screen.html', controller: 'controller.html' },
};

let socket: InstanceType<typeof FakeSocket>;

function create(debug?: boolean): ConsoleSDK {
    const sdk = new ConsoleSDK(
        debug === undefined ? { serverUrl: 'x' } : { serverUrl: 'x', debug },
    );
    socket = sockets.at(-1) as InstanceType<typeof FakeSocket>;
    return sdk;
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('ConsoleSDK requests', () => {
    it('sendToPlayer sends the payload and resolves on an accepted answer', async () => {
        const sdk = create();
        socket.ack = { ok: true };

        await expect(sdk.sendToPlayer('p1', 'secret', { a: 1 })).resolves.toBeUndefined();

        expect(socket.timeoutMs).toBe(5000);
        expect(socket.requests).toEqual([
            ['send_private_message', { playerId: 'p1', type: 'secret', data: { a: 1 } }],
        ]);
    });

    it('leaves data out of the payload when there is none', async () => {
        const sdk = create();

        await sdk.sendToPlayer('p1', 'ping');
        sdk.broadcast('ping');
        sdk.broadcast('score', 3);

        expect(socket.requests).toEqual([
            ['send_private_message', { playerId: 'p1', type: 'ping' }],
        ]);
        expect(socket.sent).toEqual([
            ['broadcast_message', { type: 'ping' }],
            ['broadcast_message', { type: 'score', data: 3 }],
        ]);
    });

    it('sends role and status payloads, null included', async () => {
        const sdk = create();

        await sdk.setPlayerRole('p1', 'wolf');
        await sdk.setPlayerStatus('p1', null);

        expect(socket.requests).toEqual([
            ['set_player_role', { playerId: 'p1', role: 'wolf' }],
            ['set_player_status', { playerId: 'p1', status: null }],
        ]);
    });

    it('rejects with the code and message of a refusal', async () => {
        const sdk = create();
        socket.ack = {
            ok: false,
            error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found' },
        };

        const error = await sdk.setPlayerRole('p1', 'x').catch((e: unknown) => e);

        expect(error).toBeInstanceOf(PanicControlError);
        expect(error).toMatchObject({
            name: 'PanicControlError',
            code: 'PLAYER_NOT_FOUND',
            message: 'Player not found',
        });
    });

    it('rejects with TIMEOUT when the server does not answer', async () => {
        const sdk = create();
        socket.ackError = new Error('operation has timed out');

        await expect(sdk.setPlayerRole('p1', 'x')).rejects.toMatchObject({ code: 'TIMEOUT' });
    });

    it.each([
        undefined,
        'ok',
        { ok: 'yes' },
        { ok: false },
        { ok: false, error: { code: 'NOPE', message: 'x' } },
    ])('rejects with BAD_RESPONSE on a malformed answer (%j)', async (answer) => {
        const sdk = create();
        socket.ack = answer;

        await expect(sdk.setPlayerRole('p1', 'x')).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
    });

    it('createRoom emits the request and resolves with the room code', async () => {
        const sdk = create();

        const pending = sdk.createRoom();
        socket.receive('room_created', { roomCode: 'ABCDEF' });

        await expect(pending).resolves.toBe('ABCDEF');
        expect(socket.sent).toEqual([['create_room']]);
        expect(sdk.roomCode).toBe('ABCDEF');
        expect(socket.listenerCount('error')).toBe(0);
    });

    it('createRoom rejects with the server message', async () => {
        const sdk = create();

        const pending = sdk.createRoom();
        socket.receive('error', { message: 'nope' });

        await expect(pending).rejects.toThrow('nope');
        expect(socket.listenerCount('room_created')).toBe(0);
    });

    it('createRoom rejects after 5 seconds without an answer', async () => {
        const sdk = create();

        const pending = sdk.createRoom();
        const check = expect(pending).rejects.toThrow('Timed out');
        vi.advanceTimersByTime(5000);

        await check;
        expect(socket.listenerCount('room_created')).toBe(0);
        expect(socket.listenerCount('error')).toBe(0);
    });

    it('reconnectToRoom emits the code and resolves', async () => {
        const sdk = create();

        const pending = sdk.reconnectToRoom('ABCDEF');
        socket.receive('reconnected_to_room', { roomCode: 'ABCDEF' });

        await expect(pending).resolves.toBe('ABCDEF');
        expect(socket.sent).toEqual([['reconnect_to_room', 'ABCDEF']]);
        expect(sdk.roomCode).toBe('ABCDEF');
    });
});

describe('ConsoleSDK state and listeners', () => {
    it('keeps the catalogue and follows the selection', () => {
        const sdk = create();
        const seen: (string | null | undefined)[] = [];
        sdk.onCatalogueSelection(() => seen.push(sdk.catalogue?.selectedGameId));
        expect(sdk.catalogue).toBeNull();

        socket.receive('catalogue', { games: [GAME], selectedGameId: 'duo' });
        expect(sdk.catalogue).toEqual({ games: [GAME], selectedGameId: 'duo' });
        socket.receive('catalogue_selection', { selectedGame: null });

        expect(sdk.catalogue).toEqual({ games: [GAME], selectedGameId: null });
        // The callback already sees the updated state
        expect(seen).toEqual([null]);
    });

    it('knows the running game', () => {
        const sdk = create();
        const seen: (GameManifest | null)[] = [];
        sdk.onGameStarted(() => seen.push(sdk.game));
        sdk.onGameStopped(() => seen.push(sdk.game));

        socket.receive('game_started', GAME);
        expect(sdk.game).toEqual(GAME);
        socket.receive('game_stopped');

        expect(sdk.game).toBeNull();
        expect(seen).toEqual([GAME, null]);
    });

    it('passes the player list, disconnections and room closing to callbacks', () => {
        const sdk = create();
        const players: PlayerListInfo[][] = [];
        const events: string[] = [];
        sdk.onUpdatePlayers((list) => players.push(list));
        sdk.onDisconnectedUser((id) => events.push(`gone ${id}`));
        sdk.onRoomClosed((message) => events.push(message));
        sdk.onReconnectedToRoom((roomCode) => events.push(`back ${roomCode}`));

        socket.receive('update_players', []);
        socket.receive('disconnected_user', { playerId: 'p1' });
        socket.receive('room_closed', { message: 'closed' });
        socket.receive('reconnected_to_room', { roomCode: 'ABC234' });

        expect(players).toEqual([[]]);
        expect(events).toEqual(['gone p1', 'closed', 'back ABC234']);
    });

    it('onAction only fires for its type', () => {
        const sdk = create();
        const moves: unknown[] = [];
        sdk.onAction('move', (playerId, data) => moves.push([playerId, data]));

        socket.receive('player_action', { playerId: 'p1', type: 'jump', data: undefined });
        socket.receive('player_action', { playerId: 'p2', type: 'move', data: { x: 1 } });

        expect(moves).toEqual([['p2', { x: 1 }]]);
    });

    it('every onXxx returns a function removing exactly its listener', () => {
        const sdk = create();
        const calls: string[] = [];
        const registrations: [string, () => () => void][] = [
            ['connect', () => sdk.onConnect(() => calls.push('connect'))],
            ['disconnect', () => sdk.onDisconnect(() => calls.push('disconnect'))],
            ['reconnected_to_room', () => sdk.onReconnectedToRoom(() => calls.push('r'))],
            ['update_players', () => sdk.onUpdatePlayers(() => calls.push('u'))],
            ['disconnected_user', () => sdk.onDisconnectedUser(() => calls.push('d'))],
            ['room_closed', () => sdk.onRoomClosed(() => calls.push('c'))],
            ['catalogue', () => sdk.onCatalogue(() => calls.push('cat'))],
            ['catalogue_selection', () => sdk.onCatalogueSelection(() => calls.push('s'))],
            ['game_started', () => sdk.onGameStarted(() => calls.push('gs'))],
            ['game_stopped', () => sdk.onGameStopped(() => calls.push('gx'))],
            ['player_action', () => sdk.onAction('a', () => calls.push('a'))],
        ];

        for (const [event, register] of registrations) {
            const before = socket.listenerCount(event);
            const unsubscribe = register();
            expect(socket.listenerCount(event)).toBe(before + 1);
            unsubscribe();
            expect(socket.listenerCount(event)).toBe(before);
        }
        expect(calls).toEqual([]);
    });

    it('disconnect closes the socket', () => {
        const sdk = create();

        sdk.disconnect();

        expect(socket.disconnected).toBe(true);
    });
});

describe('ConsoleSDK logs', () => {
    it('writes nothing to the console by default', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        create();

        socket.receive('connect');
        socket.receive('disconnect', 'transport close');

        expect(log).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
    });

    it('writes connection events with debug on', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        create(true);

        socket.receive('connect');
        socket.receive('disconnect', 'transport close');

        expect(log).toHaveBeenCalledOnce();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('transport close'));
    });
});
