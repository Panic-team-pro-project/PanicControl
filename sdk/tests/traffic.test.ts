import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleSDK, ControllerSDK } from '../src/index.js';
import type { TrafficEntry } from '../src/index.js';

type Listener = (...args: unknown[]) => void;

// Stand-in for a socket.io-client socket, with the catch-all listeners used by onTraffic
const { FakeSocket, sockets } = vi.hoisted(() => {
    const sockets: InstanceType<typeof FakeSocket>[] = [];

    class FakeSocket {
        id = 'fake-id';
        ack: unknown = { ok: true };
        ackError: Error | undefined;
        private listeners = new Map<string, Listener[]>();
        anyListeners: Listener[] = [];

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

        onAny(listener: Listener): this {
            this.anyListeners.push(listener);
            return this;
        }

        offAny(listener: Listener): this {
            this.anyListeners = this.anyListeners.filter((l) => l !== listener);
            return this;
        }

        emit(): this {
            return this;
        }

        timeout() {
            return {
                emitWithAck: (): Promise<unknown> =>
                    this.ackError ? Promise.reject(this.ackError) : Promise.resolve(this.ack),
            };
        }

        disconnect(): this {
            return this;
        }

        // Simulates the server sending an event. Like socket.io, the catch-all listeners do not
        // see connect and disconnect.
        receive(event: string, ...args: unknown[]): void {
            if (!['connect', 'disconnect', 'connect_error'].includes(event)) {
                for (const listener of [...this.anyListeners]) listener(event, ...args);
            }
            for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...args);
        }

        listenerCount(event: string): number {
            return (this.listeners.get(event) ?? []).length;
        }
    }

    return { FakeSocket, sockets };
});

vi.mock('socket.io-client', () => ({ io: () => new FakeSocket() }));

function lastSocket() {
    const socket = sockets[sockets.length - 1];
    if (!socket) throw new Error('No socket created');
    return socket;
}

function watch(sdk: { onTraffic: (cb: (entry: TrafficEntry) => void) => () => void }) {
    const entries: TrafficEntry[] = [];
    const off = sdk.onTraffic((entry) => entries.push(entry));
    const seen = () => entries.map(({ direction, event, data }) => ({ direction, event, data }));
    return { entries, off, seen };
}

beforeEach(() => {
    sockets.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('onTraffic', () => {
    it('records what a controller sends, with its data', () => {
        const sdk = new ControllerSDK({ serverUrl: 'http://test' });
        const { entries, seen } = watch(sdk);

        sdk.sendAction('jump', { x: 1 });
        sdk.navigateCatalogue('down');

        expect(seen()).toEqual([
            { direction: 'out', event: 'send_action', data: { type: 'jump', data: { x: 1 } } },
            { direction: 'out', event: 'navigate_catalogue', data: { direction: 'down' } },
        ]);
        expect(entries[0]?.time).toBe(Date.parse('2026-01-01T10:00:00Z'));
    });

    it('records every event received, even without a listener for it', () => {
        const sdk = new ControllerSDK({ serverUrl: 'http://test' });
        const { seen } = watch(sdk);

        lastSocket().receive('game_message', { type: 'score', data: 3, isPrivate: true });
        lastSocket().receive('something_new');

        expect(seen()).toEqual([
            {
                direction: 'in',
                event: 'game_message',
                data: { type: 'score', data: 3, isPrivate: true },
            },
            { direction: 'in', event: 'something_new', data: undefined },
        ]);
    });

    it('keeps several arguments as an array', () => {
        const sdk = new ControllerSDK({ serverUrl: 'http://test' });
        const { seen } = watch(sdk);

        void sdk.joinRoom('ABC123', 'Bot 1').catch(() => {});

        expect(seen()).toEqual([
            { direction: 'out', event: 'join_room', data: ['ABC123', 'Bot 1'] },
        ]);
    });

    it('records connection changes as system entries', () => {
        const sdk = new ConsoleSDK({ serverUrl: 'http://test' });
        const { seen } = watch(sdk);

        lastSocket().receive('connect');
        lastSocket().receive('disconnect', 'transport close');
        lastSocket().receive('connect_error', new Error('xhr poll error'));

        expect(seen()).toEqual([
            { direction: 'system', event: 'connect', data: undefined },
            { direction: 'system', event: 'disconnect', data: 'transport close' },
            { direction: 'system', event: 'connect_error', data: 'xhr poll error' },
        ]);
    });

    it("records a request's answer", async () => {
        const sdk = new ControllerSDK({ serverUrl: 'http://test' });
        const { seen } = watch(sdk);
        lastSocket().ack = { ok: false, error: { code: 'NOT_HOST', message: 'Host only' } };

        await expect(sdk.startGame()).rejects.toThrow('Host only');

        expect(seen()).toEqual([
            { direction: 'out', event: 'start_game', data: {} },
            {
                direction: 'in',
                event: 'start_game (ack)',
                data: { ok: false, error: { code: 'NOT_HOST', message: 'Host only' } },
            },
        ]);
    });

    it('records a request without answer as a timeout', async () => {
        const sdk = new ConsoleSDK({ serverUrl: 'http://test' });
        const { seen } = watch(sdk);
        lastSocket().ackError = new Error('operation has timed out');

        await expect(sdk.setPlayerRole('p1', 'spy')).rejects.toMatchObject({ code: 'TIMEOUT' });

        expect(seen().map((entry) => entry.event)).toEqual([
            'set_player_role',
            'set_player_role (timeout)',
        ]);
        expect(seen()[1]?.direction).toBe('system');
    });

    it('watches the socket only while someone listens', () => {
        const sdk = new ControllerSDK({ serverUrl: 'http://test' });
        const socket = lastSocket();
        const connectListeners = socket.listenerCount('connect');

        const first = watch(sdk);
        const second = watch(sdk);
        expect(socket.anyListeners).toHaveLength(1);
        expect(socket.listenerCount('connect')).toBe(connectListeners + 1);

        first.off();
        socket.receive('game_stopped');
        expect(first.entries).toHaveLength(0);
        expect(second.entries).toHaveLength(1);

        second.off();
        expect(socket.anyListeners).toHaveLength(0);
        expect(socket.listenerCount('connect')).toBe(connectListeners);

        sdk.sendAction('jump');
        expect(second.entries).toHaveLength(1);
    });

    it("does not change the SDK's own listeners", () => {
        const sdk = new ControllerSDK({ serverUrl: 'http://test' });
        const { off } = watch(sdk);
        const stopped = vi.fn();
        sdk.onGameStopped(stopped);

        lastSocket().receive('game_started', { id: 'duo', name: 'Duo' });
        expect(sdk.game).toMatchObject({ id: 'duo' });
        off();
        lastSocket().receive('game_stopped');

        expect(sdk.game).toBeNull();
        expect(stopped).toHaveBeenCalledOnce();
    });
});
