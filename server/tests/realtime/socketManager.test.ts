// Socket connections and messages between the backend, the console and the controllers:
// Socket.IO server runs the SocketManager, and the ConsoleSDK and ControllerSDK talk to it
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleSDK, ControllerSDK } from '../../../sdk/src/index.js';
import type { PlayerListInfo } from '../../../sdk/src/index.js';
import { MAX_PLAYERS_PER_ROOM } from '../../src/config.js';
import { SocketManager } from '../../src/realtime/socketManager.js';

vi.mock('../../src/config.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../src/config.js')>()),
    MAX_PLAYERS_PER_ROOM: 8,
}));

// How long the server waits for a disconnected player to come back
const PLAYER_GRACE_TIME = 30_000;

let io: Server;
let url: string;
const clients: { disconnect(): void }[] = [];

beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const httpServer = createServer();
    io = new Server(httpServer);
    new SocketManager(io);

    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
    vi.useRealTimers();
    for (const client of clients.splice(0)) {
        client.disconnect();
    }
    await new Promise<void>((resolve) => io.close(() => resolve()));
    vi.restoreAllMocks();
});

function newConsole(): ConsoleSDK {
    const sdk = new ConsoleSDK(url);
    clients.push(sdk);
    return sdk;
}

function newController(): ControllerSDK {
    const sdk = new ControllerSDK(url);
    clients.push(sdk);
    return sdk;
}

// Every player list the console receives, the latest last
function watchPlayers(consoleSdk: ConsoleSDK): PlayerListInfo[][] {
    const updates: PlayerListInfo[][] = [];
    consoleSdk.onUpdatePlayers((players) => updates.push(players));
    return updates;
}

// Number of sockets connected to the server
function connectedSockets(): number {
    return io.sockets.sockets.size;
}

describe('backend ↔ console', () => {
    it('the console connects to the server, then disconnects', async () => {
        const consoleSdk = newConsole();
        const events: string[] = [];
        consoleSdk.onConnect(() => events.push('connect'));
        consoleSdk.onDisconnect((reason) => events.push(reason));

        await vi.waitFor(() => {
            expect(events).toEqual(['connect']);
            expect(connectedSockets()).toBe(1);
        });

        consoleSdk.disconnect();

        await vi.waitFor(() => {
            expect(events).toEqual(['connect', 'io client disconnect']);
            expect(connectedSockets()).toBe(0);
        });
    });

    it('creates a room and receives its code', async () => {
        const consoleSdk = newConsole();

        const roomCode = await consoleSdk.createRoom();

        // Room code is 6 characters, excluding I, O, 0 and 1 to avoid confusion
        expect(roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
        expect(consoleSdk.roomCode).toBe(roomCode);
    });
});

describe('backend ↔ controller', () => {
    it('the controller connects to the server, then disconnects', async () => {
        const controller = newController();
        const events: string[] = [];
        controller.onConnect(() => events.push('connect'));
        controller.onDisconnect((reason) => events.push(reason));

        await vi.waitFor(() => {
            expect(events).toEqual(['connect']);
            expect(connectedSockets()).toBe(1);
        });

        controller.disconnect();

        await vi.waitFor(() => {
            expect(events).toEqual(['connect', 'io client disconnect']);
            expect(connectedSockets()).toBe(0);
        });
    });

    it('joins a room with its code and receives a player ID', async () => {
        const roomCode = await newConsole().createRoom();
        const controller = newController();

        const playerId = await controller.joinRoom(roomCode, 'Mario');

        expect(playerId).toMatch(/^[a-z0-9]+$/);
        expect(controller.roomCode).toBe(roomCode);
        expect(controller.playerId).toBe(playerId);
    });

    it('joining an unknown room is refused with the server message', async () => {
        await expect(newController().joinRoom('NOPE00', 'Mario')).rejects.toThrow('Room not found');
    });

    it('an invalid player name is refused', async () => {
        const roomCode = await newConsole().createRoom();

        await expect(newController().joinRoom(roomCode, '   ')).rejects.toThrow();
    });

    it('a full room refuses the next player', async () => {
        const roomCode = await newConsole().createRoom();

        // Fill the room up to the limit, all players joining at the same time
        await Promise.all(
            Array.from({ length: MAX_PLAYERS_PER_ROOM }, (_, i) =>
                newController().joinRoom(roomCode, `Player${i + 1}`),
            ),
        );

        await expect(newController().joinRoom(roomCode, 'OneTooMany')).rejects.toThrow(
            'Room is full',
        );
    });
});

describe('console ↔ controller', () => {
    it('the console receives the player list, with the first player as host', async () => {
        const consoleSdk = newConsole();
        const updates = watchPlayers(consoleSdk);
        const roomCode = await consoleSdk.createRoom();

        const marioId = await newController().joinRoom(roomCode, 'Mario');
        const luigiId = await newController().joinRoom(roomCode, 'Luigi');

        await vi.waitFor(() => {
            expect(updates.at(-1)).toMatchObject([
                { name: 'Mario', playerId: marioId, isHost: true, isConnected: true },
                { name: 'Luigi', playerId: luigiId, isHost: false, isConnected: true },
            ]);
        });
    });

    it('the console receives the ID of a player who disconnects', async () => {
        const consoleSdk = newConsole();
        const disconnectedIds: string[] = [];
        consoleSdk.onDisconnectedUser((playerId) => disconnectedIds.push(playerId));
        const roomCode = await consoleSdk.createRoom();
        const controller = newController();
        const playerId = await controller.joinRoom(roomCode, 'Mario');

        controller.disconnect();

        await vi.waitFor(() => {
            expect(disconnectedIds).toEqual([playerId]);
        });
    });

    it('a player who comes back with their player ID keeps their place', async () => {
        const consoleSdk = newConsole();
        const updates = watchPlayers(consoleSdk);
        const roomCode = await consoleSdk.createRoom();
        const firstController = newController();
        const playerId = await firstController.joinRoom(roomCode, 'Mario');

        firstController.disconnect();
        await vi.waitFor(() => {
            expect(updates.at(-1)).toMatchObject([{ name: 'Mario', isConnected: false }]);
        });

        const rejoinedId = await newController().reconnectToRoom(roomCode, 'Mario', playerId);

        expect(rejoinedId).toBe(playerId);
        await vi.waitFor(() => {
            expect(updates.at(-1)).toMatchObject([{ name: 'Mario', isConnected: true }]);
        });
    });

    it('controllers are told when the console leaves and comes back', async () => {
        const firstConsole = newConsole();
        const roomCode = await firstConsole.createRoom();
        const controller = newController();
        const messages: string[] = [];
        controller.onConsoleDisconnected((message) => messages.push(message));
        controller.onConsoleReconnected((message) => messages.push(message));
        await controller.joinRoom(roomCode, 'Mario');

        firstConsole.disconnect();
        await vi.waitFor(() => {
            expect(messages).toEqual(['Console disconnected']);
        });

        const newConsoleSdk = newConsole();
        const updates = watchPlayers(newConsoleSdk);

        await expect(newConsoleSdk.reconnectToRoom(roomCode)).resolves.toBe(roomCode);
        await vi.waitFor(() => {
            expect(messages).toEqual(['Console disconnected', 'Console is back online']);
            expect(updates.at(-1)).toMatchObject([{ name: 'Mario' }]);
        });
    });

    it('when the host leaves for good, the next player becomes host', async () => {
        const consoleSdk = newConsole();
        const updates = watchPlayers(consoleSdk);
        const roomCode = await consoleSdk.createRoom();
        const mario = newController();
        await mario.joinRoom(roomCode, 'Mario');
        const luigi = newController();
        let promoted = false;
        luigi.onPromoteToHost(() => (promoted = true));
        await luigi.joinRoom(roomCode, 'Luigi');

        // Fake clock, which still moves with real time so the sockets keep working,
        // and jumps over the server's 30-second wait for Mario to come back
        vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
        mario.disconnect();
        await vi.waitFor(() => {
            expect(updates.at(-1)).toMatchObject([{ name: 'Mario', isConnected: false }, {}]);
        });
        vi.advanceTimersByTime(PLAYER_GRACE_TIME);
        vi.useRealTimers();

        await vi.waitFor(() => {
            expect(promoted).toBe(true);
            expect(updates.at(-1)).toMatchObject([{ name: 'Luigi', isHost: true }]);
        });
    });
});
