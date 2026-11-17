// Message exchange between the SDK and the server: a real Socket.IO server runs the SocketManager,
// and the real ConsoleSDK and ControllerSDK talk to it, as the web app does.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleSDK, ControllerSDK } from '../../../sdk/src/index.js';
import type { PlayerListInfo } from '../../../sdk/src/index.js';
import { SocketManager } from '../../src/realtime/socketManager.js';

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

describe('messages between the SDK and the server', () => {
    it('a console creates a room and receives its code', async () => {
        const consoleSdk = newConsole();

        const roomCode = await consoleSdk.createRoom();

        expect(roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
        expect(consoleSdk.roomCode).toBe(roomCode);
    });

    it('a controller joins a room with its code and receives a player ID', async () => {
        const roomCode = await newConsole().createRoom();
        const controller = newController();

        const playerId = await controller.joinRoom(roomCode, 'Mario');

        expect(playerId).toMatch(/^[a-z0-9]+$/);
        expect(controller.roomCode).toBe(roomCode);
        expect(controller.playerId).toBe(playerId);
    });

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

    it('joining an unknown room is refused', async () => {
        await expect(newController().joinRoom('NOPE00', 'Mario')).rejects.toThrow();
    });

    it('an invalid player name is refused', async () => {
        const roomCode = await newConsole().createRoom();

        await expect(newController().joinRoom(roomCode, '   ')).rejects.toThrow();
    });

    it('a full room refuses the next player', async () => {
        const roomCode = await newConsole().createRoom();

        let accepted = 0;
        let refused = false;
        while (!refused && accepted < 10) {
            try {
                await newController().joinRoom(roomCode, `Player${accepted + 1}`);
                accepted++;
            } catch {
                refused = true;
            }
        }

        expect(refused).toBe(true);
        expect(accepted).toBeGreaterThan(0);
    });

    it('a refusal carries the server message', async () => {
        await expect(newController().joinRoom('NOPE00', 'Mario')).rejects.toThrow('Room not found');
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
});
