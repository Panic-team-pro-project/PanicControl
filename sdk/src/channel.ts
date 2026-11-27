import type { Socket } from 'socket.io-client';
import eventsCodes from 'common';
import type { ErrorCode } from 'common';
import { PanicControlError } from './errors.js';
import type { TrafficDirection, TrafficEntry } from './Types/sharedTypes.js';

const { ClientEvents, ErrorCodes } = eventsCodes;

const REQUEST_TIMEOUT_MS = 5000;

type TrafficListener = (entry: TrafficEntry) => void;

// The channel carries every message the SDK exchanges with the platform, so the socket
// can later be replaced by postMessage (game isolated in an iframe, a future PostMessageChannel
// behind a shared Channel interface) without changing the public API of ConsoleSDK and
// ControllerSDK.
export class SocketChannel {
    private readonly socket: Socket;
    private readonly trafficListeners = new Set<TrafficListener>();
    private stopWatching: (() => void) | null = null;

    constructor(socket: Socket) {
        this.socket = socket;
    }

    get id(): string | undefined {
        return this.socket.id;
    }

    disconnect(): void {
        this.socket.disconnect();
    }

    emit(event: string, ...args: unknown[]): void {
        this.record('out', event, args);
        this.socket.emit(event, ...args);
    }

    // Listen to a server event. Returns a function removing this listener.
    on<T extends unknown[]>(event: string, handler: (...args: T) => void): () => void {
        this.socket.on(event, handler);

        return () => {
            this.socket.off(event, handler);
        };
    }

    // Emits an event and waits for an acknowledgement.
    async request(event: string, payload: unknown = {}): Promise<void> {
        let response: unknown;

        this.record('out', event, [payload]);
        try {
            response = await this.socket.timeout(REQUEST_TIMEOUT_MS).emitWithAck(event, payload);
        } catch {
            this.record('system', `${event} (timeout)`, []);
            throw new PanicControlError('TIMEOUT', `No answer from the server for "${event}"`);
        }

        this.record('in', `${event} (ack)`, [response]);
        if (!isRecord(response)) {
            throw new PanicControlError('BAD_RESPONSE', `Malformed answer for "${event}"`);
        }

        if (response.ok === true) return;

        const error = response.error;
        if (response.ok === false && isRecord(error) && isErrorCode(error.code)) {
            const message = typeof error.message === 'string' ? error.message : error.code;
            throw new PanicControlError(error.code, message);
        }
        throw new PanicControlError('BAD_RESPONSE', `Malformed answer for "${event}"`);
    }

    // Emits an event, then waits for a success event or for the server ERROR event.
    waitFor<T>(successEvent: string, send: () => void, timeoutMessage: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const stop = (): void => {
                clearTimeout(timer);
                offSuccess();
                offError();
            };
            const timer = setTimeout(() => {
                stop();
                reject(new Error(timeoutMessage));
            }, REQUEST_TIMEOUT_MS);
            const offSuccess = this.once<[T]>(successEvent, (data) => {
                stop();
                resolve(data);
            });
            const offError = this.once<[{ message: string }]>(ClientEvents.ERROR, (error) => {
                stop();
                reject(new Error(error.message));
            });

            send();
        });
    }

    /**
     * Calls the listener with every message sent and received, and with connection changes.
     * The socket is only watched while at least one listener exists. Returns the unsubscribe
     * function.
     */
    onTraffic(listener: TrafficListener): () => void {
        this.trafficListeners.add(listener);
        this.stopWatching ??= this.watchSocket();

        return () => {
            this.trafficListeners.delete(listener);
            if (this.trafficListeners.size === 0) {
                this.stopWatching?.();
                this.stopWatching = null;
            }
        };
    }

    // What this channel sends is recorded by emit and request; this adds what the server sends.
    private watchSocket(): () => void {
        const incoming = (event: string, ...args: unknown[]): void =>
            this.record('in', event, args);
        const connected = (): void => this.record('system', 'connect', []);
        const disconnected = (reason: string): void =>
            this.record('system', 'disconnect', [reason]);
        const failed = (error: Error): void =>
            this.record('system', 'connect_error', [error.message]);

        this.socket.onAny(incoming);
        this.socket.on('connect', connected);
        this.socket.on('disconnect', disconnected);
        this.socket.on('connect_error', failed);

        return () => {
            this.socket.offAny(incoming);
            this.socket.off('connect', connected);
            this.socket.off('disconnect', disconnected);
            this.socket.off('connect_error', failed);
        };
    }

    private record(direction: TrafficDirection, event: string, args: unknown[]): void {
        if (this.trafficListeners.size === 0) return;

        const entry: TrafficEntry = {
            direction,
            event,
            data: args.length > 1 ? args : args[0],
            time: Date.now(),
        };
        for (const listener of [...this.trafficListeners]) listener(entry);
    }

    private once<T extends unknown[]>(event: string, handler: (...args: T) => void): () => void {
        const off = this.on<T>(event, (...args) => {
            off();
            handler(...args);
        });

        return off;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isErrorCode(value: unknown): value is ErrorCode {
    return Object.values<unknown>(ErrorCodes).includes(value);
}
