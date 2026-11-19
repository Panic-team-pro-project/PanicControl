import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControllerSDK, PanicControlError } from '../src/index.js';
import type { GameManifest } from '../src/index.js';

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

function create(options: { playerId?: string; debug?: boolean } = {}): ControllerSDK {
    const sdk = new ControllerSDK({ serverUrl: 'x', ...options });
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

describe('ControllerSDK requests', () => {
    it('startGame and stopGame send a request and resolve on an accepted answer', async () => {
        const sdk = create();

        await expect(sdk.startGame()).resolves.toBeUndefined();
        await expect(sdk.stopGame()).resolves.toBeUndefined();

        expect(socket.timeoutMs).toBe(5000);
        expect(socket.requests.map(([event]) => event)).toEqual(['start_game', 'stop_game']);
    });

    it('rejects with the code and message of a refusal', async () => {
        const sdk = create();
        socket.ack = { ok: false, error: { code: 'NOT_HOST', message: 'Only the host' } };

        const error = await sdk.startGame().catch((e: unknown) => e);

        expect(error).toBeInstanceOf(PanicControlError);
        expect(error).toMatchObject({ code: 'NOT_HOST', message: 'Only the host' });
    });

    it('rejects with TIMEOUT when the server does not answer', async () => {
        const sdk = create();
        socket.ackError = new Error('operation has timed out');

        await expect(sdk.stopGame()).rejects.toMatchObject({ code: 'TIMEOUT' });
    });

    it.each([undefined, null, { ok: 1 }, { ok: false, error: 'x' }])(
        'rejects with BAD_RESPONSE on a malformed answer (%j)',
        async (answer) => {
            const sdk = create();
            socket.ack = answer;

            await expect(sdk.startGame()).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
        },
    );

    it('joinRoom emits the name and resolves with the player ID', async () => {
        const sdk = create();

        const pending = sdk.joinRoom('ABCDEF', 'Mario');
        socket.receive('player_joined', { playerId: 'p1', isHost: true });

        await expect(pending).resolves.toBe('p1');
        expect(socket.sent).toEqual([['join_room', 'ABCDEF', 'Mario']]);
        expect(sdk.roomCode).toBe('ABCDEF');
        expect(sdk.playerId).toBe('p1');
        expect(sdk.isHost).toBe(true);
    });

    it('joinRoom rejects with the server message, then after 5 seconds without an answer', async () => {
        const sdk = create();

        const refused = sdk.joinRoom('ABCDEF', 'Mario');
        socket.receive('error', { message: 'Room is full' });
        await expect(refused).rejects.toThrow('Room is full');

        const silent = sdk.joinRoom('ABCDEF', 'Mario');
        const check = expect(silent).rejects.toThrow('Timed out');
        vi.advanceTimersByTime(5000);
        await check;
        expect(socket.listenerCount('error')).toBe(0);
    });

    it('reconnectToRoom sends the saved player ID', async () => {
        const sdk = create({ playerId: 'p1' });
        expect(sdk.playerId).toBe('p1');

        const pending = sdk.reconnectToRoom('ABCDEF', 'Mario', 'p1');
        socket.receive('player_joined', { playerId: 'p1', isHost: false });

        await expect(pending).resolves.toBe('p1');
        expect(socket.sent).toEqual([['join_room', 'ABCDEF', 'Mario', 'p1']]);
        expect(sdk.isHost).toBe(false);
    });
});

describe('ControllerSDK sending', () => {
    it('navigateCatalogue sends the direction', () => {
        const sdk = create();

        sdk.navigateCatalogue('left');

        expect(socket.sent).toEqual([['navigate_catalogue', { direction: 'left' }]]);
    });

    it('sendAction sends the type, and the data when there is some', () => {
        const sdk = create();

        sdk.sendAction('jump');
        sdk.sendAction('move', { x: 1 });
        sdk.sendAction('count', 0);

        expect(socket.sent).toEqual([
            ['send_action', { type: 'jump' }],
            ['send_action', { type: 'move', data: { x: 1 } }],
            ['send_action', { type: 'count', data: 0 }],
        ]);
    });
});

describe('ControllerSDK state', () => {
    it('isHost follows the join answer and a promotion', () => {
        const sdk = create();
        const seen: boolean[] = [];
        sdk.onPromoteToHost(() => seen.push(sdk.isHost));
        expect(sdk.isHost).toBe(false);

        socket.receive('player_joined', { playerId: 'p1', isHost: false });
        expect(sdk.isHost).toBe(false);
        socket.receive('promote_to_host', { message: 'You are now the host' });

        expect(sdk.isHost).toBe(true);
        expect(seen).toEqual([true]);
    });

    it('follows the selected game and the running game', () => {
        const sdk = create();
        const seen: (GameManifest | null)[] = [];
        sdk.onCatalogueSelection(() => seen.push(sdk.selectedGame));
        sdk.onGameStarted(() => seen.push(sdk.game));
        sdk.onGameStopped(() => seen.push(sdk.game));

        socket.receive('catalogue_selection', { selectedGame: GAME });
        socket.receive('game_started', GAME);
        socket.receive('game_stopped');

        expect(sdk.selectedGame).toEqual(GAME);
        expect(sdk.game).toBeNull();
        expect(seen).toEqual([GAME, GAME, null]);
    });

    it('role and status follow the server and reset when a game starts or stops', () => {
        const sdk = create();
        const states: unknown[] = [];
        sdk.onPlayerStateChanged((state) => states.push([state, sdk.role, sdk.status]));

        socket.receive('player_state', { role: 'wolf', status: 'alive' });
        expect([sdk.role, sdk.status]).toEqual(['wolf', 'alive']);
        socket.receive('game_started', GAME);
        expect([sdk.role, sdk.status]).toEqual([null, null]);

        socket.receive('player_state', { role: 'wolf', status: null });
        socket.receive('game_stopped');
        expect([sdk.role, sdk.status]).toEqual([null, null]);

        expect(states).toEqual([
            [{ role: 'wolf', status: 'alive' }, 'wolf', 'alive'],
            [{ role: 'wolf', status: null }, 'wolf', null],
        ]);
    });

    it('the console connection callbacks receive the server message', () => {
        const sdk = create();
        const messages: string[] = [];
        sdk.onConsoleDisconnected((message) => messages.push(message));
        sdk.onConsoleReconnected((message) => messages.push(message));

        socket.receive('console_disconnected', { message: 'away' });
        socket.receive('console_reconnected', { message: 'back' });

        expect(messages).toEqual(['away', 'back']);
    });

    it('onMessage only fires for its type and tells whether it is private', () => {
        const sdk = create();
        const received: unknown[] = [];
        sdk.onMessage('score', (data, meta) => received.push([data, meta]));

        socket.receive('game_message', { type: 'other', data: 1, isPrivate: false });
        socket.receive('game_message', { type: 'score', data: 2, isPrivate: true });
        socket.receive('game_message', { type: 'score', data: 3, isPrivate: false });

        expect(received).toEqual([
            [2, { isPrivate: true }],
            [3, { isPrivate: false }],
        ]);
    });

    it('every onXxx returns a function removing exactly its listener', () => {
        const sdk = create();
        const registrations: [string, () => () => void][] = [
            ['connect', () => sdk.onConnect(() => {})],
            ['disconnect', () => sdk.onDisconnect(() => {})],
            ['promote_to_host', () => sdk.onPromoteToHost(() => {})],
            ['console_disconnected', () => sdk.onConsoleDisconnected(() => {})],
            ['console_reconnected', () => sdk.onConsoleReconnected(() => {})],
            ['catalogue_selection', () => sdk.onCatalogueSelection(() => {})],
            ['game_started', () => sdk.onGameStarted(() => {})],
            ['game_stopped', () => sdk.onGameStopped(() => {})],
            ['player_state', () => sdk.onPlayerStateChanged(() => {})],
            ['game_message', () => sdk.onMessage('a', () => {})],
        ];

        for (const [event, register] of registrations) {
            const before = socket.listenerCount(event);
            const unsubscribe = register();
            expect(socket.listenerCount(event)).toBe(before + 1);
            unsubscribe();
            expect(socket.listenerCount(event)).toBe(before);
        }
    });

    it('a callback is not called once unsubscribed', () => {
        const sdk = create();
        const calls: string[] = [];
        const unsubscribe = sdk.onGameStopped(() => calls.push('removed'));
        sdk.onGameStopped(() => calls.push('kept'));

        unsubscribe();
        socket.receive('game_stopped');

        expect(calls).toEqual(['kept']);
    });

    it('disconnect closes the socket', () => {
        const sdk = create();

        sdk.disconnect();

        expect(socket.disconnected).toBe(true);
    });
});

describe('ControllerSDK logs', () => {
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
        create({ debug: true });

        socket.receive('connect');
        socket.receive('disconnect', 'transport close');

        expect(log).toHaveBeenCalledOnce();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('transport close'));
    });
});

describe('typed actions and messages', () => {
    type Actions = { jump: void; move: { x: number } };
    type Messages = { score: { value: number } };

    it('checks event names and data at compile time', () => {
        const pad = new ControllerSDK<Actions, Messages>({ serverUrl: 'x' });
        const received: number[] = [];

        pad.sendAction('jump');
        pad.sendAction('move', { x: 1 });
        // @ts-expect-error missing data
        pad.sendAction('move');
        // @ts-expect-error unexpected data
        pad.sendAction('jump', 1);
        // @ts-expect-error unknown action
        pad.sendAction('fly');
        // @ts-expect-error wrong data
        pad.sendAction('move', { y: 1 });
        pad.onMessage('score', (data) => received.push(data.value));
        // @ts-expect-error unknown message
        pad.onMessage('nope', () => {});

        sockets.at(-1)?.receive('game_message', {
            type: 'score',
            data: { value: 7 },
            isPrivate: false,
        });
        expect(received).toEqual([7]);
    });

    it('accepts interfaces as maps, and any data when no map is given', () => {
        interface Moves {
            move: { x: number };
        }
        const typed = new ControllerSDK<Moves>({ serverUrl: 'x' });
        typed.sendAction('move', { x: 1 });
        const loose = new ControllerSDK({ serverUrl: 'x' });
        loose.sendAction('anything');
        loose.sendAction('anything', { whatever: true });

        expect(sockets.at(-1)?.sent).toHaveLength(2);
    });
});
