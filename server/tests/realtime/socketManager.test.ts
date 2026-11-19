// Socket connections and messages between the backend, the console and the controllers:
// Socket.IO server runs the SocketManager, and the ConsoleSDK and ControllerSDK talk to it
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import eventsCodes from 'common';
import type { GameManifest } from 'common/gameManifest';
import { ConsoleSDK, ControllerSDK, PanicControlError } from '../../../sdk/src/index.js';
import type {
    CatalogueState,
    MessageMeta,
    PlayerListInfo,
    PlayerState,
} from '../../../sdk/src/index.js';
// The SDK hides its socket, and some cases need a client that sends what the SDK never would
import { io as rawIo } from '../../../sdk/node_modules/socket.io-client/build/esm/index.js';
import type { Socket as RawSocket } from '../../../sdk/node_modules/socket.io-client/build/esm/index.js';
import { MAX_PLAYERS_PER_ROOM } from '../../src/config.js';
import { Catalogue } from '../../src/games/catalogue.js';
import { SocketManager } from '../../src/realtime/socketManager.js';

vi.mock('../../src/config.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../src/config.js')>()),
    MAX_PLAYERS_PER_ROOM: 8,
}));

// How long the server waits for a disconnected player to come back
const PLAYER_GRACE_TIME = 30_000;
// Same for a disconnected console
const CONSOLE_GRACE_TIME = 30_000;

const { ClientEvents, ServerEvents } = eventsCodes;

function manifest(id: string, name: string, minPlayers: number, maxPlayers: number): GameManifest {
    return {
        id,
        name,
        version: '1.0.0',
        minPlayers,
        maxPlayers,
        durationMinutes: 5,
        controllerComponents: ['button'],
        accessibilityFeatures: [],
        entry: { screen: 'screen.html', controller: 'controller.html' },
    };
}

// Sorted by name by the catalogue: Duo, Party, Zeta. Duo is selected when a room is created.
const DUO = manifest('duo', 'Duo', 2, 2);
const PARTY = manifest('party', 'Party', 1, 8);
const ZETA = manifest('zeta', 'Zeta', 1, 8);

let io: Server;
let url: string;
const clients: { disconnect(): void }[] = [];

async function startServer(catalogue: Catalogue): Promise<void> {
    const httpServer = createServer();
    io = new Server(httpServer);
    new SocketManager(io, catalogue);

    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
}

async function stopServer(): Promise<void> {
    for (const client of clients.splice(0)) {
        client.disconnect();
    }
    await new Promise<void>((resolve) => io.close(() => resolve()));
}

beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await startServer(new Catalogue([ZETA, DUO, PARTY]));
});

afterEach(async () => {
    vi.useRealTimers();
    await stopServer();
    vi.restoreAllMocks();
});

function newConsole(): ConsoleSDK {
    const sdk = new ConsoleSDK({ serverUrl: url });
    clients.push(sdk);
    return sdk;
}

function newController(): ControllerSDK {
    const sdk = new ControllerSDK({ serverUrl: url });
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

    it('a join with arguments of the wrong type is refused without breaking the server', async () => {
        const roomCode = await newConsole().createRoom();
        const socket = rawIo(url);
        clients.push(socket);
        const errors: unknown[] = [];
        socket.on(ClientEvents.ERROR, (error: unknown) => errors.push(error));

        socket.emit(ServerEvents.JOIN_ROOM, roomCode, 42);
        socket.emit(ServerEvents.JOIN_ROOM, { code: roomCode }, 'Mario');
        socket.emit(ServerEvents.JOIN_ROOM, roomCode, 'Mario', 7);
        socket.emit(ServerEvents.RECONNECT_TO_ROOM, 123);

        await vi.waitFor(() => {
            expect(errors).toEqual(Array(4).fill({ message: 'Invalid payload' }));
        });
        await expect(newController().joinRoom(roomCode, 'Mario')).resolves.toBeTypeOf('string');
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

    it('a player who comes back under another name is shown with the new name', async () => {
        const consoleSdk = newConsole();
        const updates = watchPlayers(consoleSdk);
        const roomCode = await consoleSdk.createRoom();
        const firstController = newController();
        const playerId = await firstController.joinRoom(roomCode, 'Mario');

        firstController.disconnect();
        await vi.waitFor(() => {
            expect(updates.at(-1)).toMatchObject([{ name: 'Mario', isConnected: false }]);
        });

        await newController().reconnectToRoom(roomCode, 'Luigi', playerId);

        await vi.waitFor(() => {
            expect(updates.at(-1)).toEqual([
                expect.objectContaining({ playerId, name: 'Luigi', isConnected: true }),
            ]);
        });
    });

    it('a reconnection with a refused name is rejected and keeps the previous name', async () => {
        const consoleSdk = newConsole();
        const updates = watchPlayers(consoleSdk);
        const roomCode = await consoleSdk.createRoom();
        const firstController = newController();
        const playerId = await firstController.joinRoom(roomCode, 'Mario');

        firstController.disconnect();
        await vi.waitFor(() => {
            expect(updates.at(-1)).toMatchObject([{ name: 'Mario', isConnected: false }]);
        });

        await expect(newController().reconnectToRoom(roomCode, '   ', playerId)).rejects.toThrow(
            'Invalid player name',
        );
        await newController().reconnectToRoom(roomCode, 'Mario', playerId);

        await vi.waitFor(() => {
            expect(updates.at(-1)).toEqual([
                expect.objectContaining({ playerId, name: 'Mario', isConnected: true }),
            ]);
        });
        expect(updates.flat().some((player) => player.name !== 'Mario')).toBe(false);
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

    it('a console that leaves twice gets the full wait time the second time', async () => {
        const firstConsole = newConsole();
        const roomCode = await firstConsole.createRoom();
        const controller = newController();
        const messages: string[] = [];
        controller.onConsoleDisconnected((message) => messages.push(message));
        await controller.joinRoom(roomCode, 'Mario');

        vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
        firstConsole.disconnect();
        await vi.waitFor(() => expect(messages).toHaveLength(1));
        vi.advanceTimersByTime(CONSOLE_GRACE_TIME - 10_000);

        const secondConsole = newConsole();
        const recovered = collect(secondConsole.onReconnectedToRoom.bind(secondConsole));
        await expect(secondConsole.reconnectToRoom(roomCode)).resolves.toBe(roomCode);
        expect(recovered).toEqual([[roomCode]]);

        // The timer of the first disconnection would have fired here
        secondConsole.disconnect();
        await vi.waitFor(() => expect(messages).toHaveLength(2));
        vi.advanceTimersByTime(15_000);
        vi.useRealTimers();

        await expect(newConsole().reconnectToRoom(roomCode)).resolves.toBe(roomCode);
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

// ---- Game flow: catalogue, start and stop, messages, roles ----

// Arguments of every call of a listener, in order
function collect<T extends unknown[]>(subscribe: (cb: (...args: T) => void) => () => void): T[] {
    const received: T[] = [];
    subscribe((...args) => received.push(args));
    return received;
}

// A room with a console and `playerCount` controllers, the first one being the host
async function lobby(playerCount: number) {
    const consoleSdk = newConsole();
    const roomCode = await consoleSdk.createRoom();
    const controllers: ControllerSDK[] = [];
    for (let i = 0; i < playerCount; i++) {
        const controller = newController();
        await controller.joinRoom(roomCode, `Player${i + 1}`);
        controllers.push(controller);
    }
    return { consoleSdk, roomCode, controllers };
}

// The host moves the selection from Duo to Party, which accepts any number of players
async function selectParty(host: ControllerSDK): Promise<void> {
    host.navigateCatalogue('down');
    await vi.waitFor(() => expect(host.selectedGame?.id).toBe('party'));
}

// Error code of a refused request, or 'RESOLVED' when it was accepted
async function codeOf(request: Promise<unknown>): Promise<string> {
    try {
        await request;
    } catch (error) {
        if (error instanceof PanicControlError) return error.code;
        throw error;
    }
    return 'RESOLVED';
}

// A client that is not the SDK, already joined as a player
async function joinRaw(
    roomCode: string,
    name: string,
): Promise<{ socket: RawSocket; playerId: string }> {
    const socket = rawIo(url);
    clients.push(socket);
    const joined = new Promise<{ playerId: string }>((resolve) =>
        socket.once(ClientEvents.PLAYER_JOINED, resolve),
    );
    socket.emit(ServerEvents.JOIN_ROOM, roomCode, name);
    return { socket, playerId: (await joined).playerId };
}

describe('catalogue', () => {
    it('the console receives the games sorted, with the first one selected', async () => {
        const consoleSdk = newConsole();
        await consoleSdk.createRoom();

        await vi.waitFor(() => {
            expect(consoleSdk.catalogue?.games.map((game) => game.id)).toEqual([
                'duo',
                'party',
                'zeta',
            ]);
            expect(consoleSdk.catalogue?.selectedGameId).toBe('duo');
        });
    });

    it('a console that comes back receives the catalogue again, with the current selection', async () => {
        const firstConsole = newConsole();
        const roomCode = await firstConsole.createRoom();
        const host = newController();
        await host.joinRoom(roomCode, 'Mario');
        await selectParty(host);
        let consoleGone = false;
        host.onConsoleDisconnected(() => (consoleGone = true));
        firstConsole.disconnect();
        await vi.waitFor(() => expect(consoleGone).toBe(true));

        const newConsoleSdk = newConsole();
        const catalogues = collect<[CatalogueState]>((cb) => newConsoleSdk.onCatalogue(cb));
        await newConsoleSdk.reconnectToRoom(roomCode);

        await vi.waitFor(() => {
            expect(catalogues).toHaveLength(1);
            expect(catalogues[0]?.[0].selectedGameId).toBe('party');
            expect(catalogues[0]?.[0].games).toHaveLength(3);
        });
    });

    it('a player who joins is told which game is selected', async () => {
        const { controllers } = await lobby(1);

        await vi.waitFor(() => expect(controllers[0]?.selectedGame?.id).toBe('duo'));
    });

    it('the host moves the selection, the console and every controller follow', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        const onConsole = collect<[GameManifest | null]>((cb) =>
            consoleSdk.onCatalogueSelection(cb),
        );
        const onOther = collect<[GameManifest | null]>((cb) => other.onCatalogueSelection(cb));

        host.navigateCatalogue('down');
        await vi.waitFor(() => expect(onConsole.map(([game]) => game?.id)).toEqual(['party']));
        host.navigateCatalogue('right');
        host.navigateCatalogue('left');

        await vi.waitFor(() => {
            expect(onConsole.map(([game]) => game?.id)).toEqual(['party', 'zeta', 'party']);
            expect(onOther.map(([game]) => game?.id)).toEqual(['party', 'zeta', 'party']);
            expect(consoleSdk.catalogue?.selectedGameId).toBe('party');
            expect(other.selectedGame?.id).toBe('party');
        });
    });

    it('the selection does not wrap around the ends of the list', async () => {
        const { consoleSdk, controllers } = await lobby(1);
        const host = controllers[0] as ControllerSDK;
        const onConsole = collect<[GameManifest | null]>((cb) =>
            consoleSdk.onCatalogueSelection(cb),
        );

        host.navigateCatalogue('up');
        host.navigateCatalogue('down');

        await vi.waitFor(() => expect(onConsole.map(([game]) => game?.id)).toEqual(['party']));
    });

    it('navigation from a player who is not the host is ignored', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        const onConsole = collect<[GameManifest | null]>((cb) =>
            consoleSdk.onCatalogueSelection(cb),
        );

        other.navigateCatalogue('down');
        // Same socket, same order: once this answer is back, the navigation has been handled
        await codeOf(other.startGame());
        host.navigateCatalogue('down');

        // If the first navigation had been accepted, the host would land on Zeta
        await vi.waitFor(() => expect(onConsole.map(([game]) => game?.id)).toEqual(['party']));
    });

    it('an invalid direction is ignored', async () => {
        const { consoleSdk, roomCode } = await lobby(0);
        const onConsole = collect<[GameManifest | null]>((cb) =>
            consoleSdk.onCatalogueSelection(cb),
        );
        const { socket } = await joinRaw(roomCode, 'Mario');

        socket.emit(ServerEvents.NAVIGATE_CATALOGUE, { direction: 'sideways' });
        socket.emit(ServerEvents.NAVIGATE_CATALOGUE, 'down');
        socket.emit(ServerEvents.NAVIGATE_CATALOGUE);
        socket.emit(ServerEvents.NAVIGATE_CATALOGUE, { direction: 'down' });

        await vi.waitFor(() => expect(onConsole.map(([game]) => game?.id)).toEqual(['party']));
    });

    it('navigation is ignored while a game is running', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const host = controllers[0] as ControllerSDK;
        const onConsole = collect<[GameManifest | null]>((cb) =>
            consoleSdk.onCatalogueSelection(cb),
        );

        await host.startGame();
        host.navigateCatalogue('down');
        await host.stopGame();
        host.navigateCatalogue('down');

        // Only the navigation made back in the lobby counts
        await vi.waitFor(() => expect(onConsole.map(([game]) => game?.id)).toEqual(['party']));
    });
});

describe('starting and stopping a game', () => {
    it('the host starts the game, the console and all controllers receive it', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        const onConsole = collect<[GameManifest]>((cb) => consoleSdk.onGameStarted(cb));
        const onHost = collect<[GameManifest]>((cb) => host.onGameStarted(cb));
        const onOther = collect<[GameManifest]>((cb) => other.onGameStarted(cb));

        await host.startGame();

        await vi.waitFor(() => {
            expect(onConsole).toEqual([[DUO]]);
            expect(onHost).toEqual([[DUO]]);
            expect(onOther).toEqual([[DUO]]);
            expect(consoleSdk.game).toEqual(DUO);
            expect(host.game).toEqual(DUO);
            expect(other.game).toEqual(DUO);
        });
    });

    it('a player who is not the host cannot start the game', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const other = controllers[1] as ControllerSDK;

        expect(await codeOf(other.startGame())).toBe('NOT_HOST');
        expect(consoleSdk.game).toBeNull();
        expect(other.game).toBeNull();
    });

    it('a game that needs more players refuses to start', async () => {
        const { consoleSdk, controllers } = await lobby(1);

        expect(await codeOf((controllers[0] as ControllerSDK).startGame())).toBe(
            'NOT_ENOUGH_PLAYERS',
        );
        expect(consoleSdk.game).toBeNull();
    });

    it('a game that accepts fewer players refuses to start', async () => {
        const { controllers } = await lobby(3);

        expect(await codeOf((controllers[0] as ControllerSDK).startGame())).toBe(
            'TOO_MANY_PLAYERS',
        );
    });

    it('starting without any game in the catalogue is refused', async () => {
        await stopServer();
        await startServer(new Catalogue([]));
        const { consoleSdk, controllers } = await lobby(1);

        expect(consoleSdk.catalogue?.games ?? []).toEqual([]);
        expect(await codeOf((controllers[0] as ControllerSDK).startGame())).toBe(
            'NO_GAME_SELECTED',
        );
    });

    it('starting a game while one is running is refused', async () => {
        const { controllers } = await lobby(2);
        const host = controllers[0] as ControllerSDK;
        await host.startGame();

        expect(await codeOf(host.startGame())).toBe('GAME_ALREADY_RUNNING');
    });

    it('the host stops the game, the console and all controllers go back to the lobby', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        await host.startGame();
        const onConsole = collect<[]>((cb) => consoleSdk.onGameStopped(cb));
        const onOther = collect<[]>((cb) => other.onGameStopped(cb));

        await host.stopGame();

        await vi.waitFor(() => {
            expect(onConsole).toHaveLength(1);
            expect(onOther).toHaveLength(1);
            expect(consoleSdk.game).toBeNull();
            expect(host.game).toBeNull();
            expect(other.game).toBeNull();
        });
    });

    it('a player who is not the host cannot stop the game', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        await host.startGame();

        expect(await codeOf(other.stopGame())).toBe('NOT_HOST');
        expect(await codeOf(host.stopGame())).toBe('RESOLVED');
        await vi.waitFor(() => expect(consoleSdk.game).toBeNull());
    });

    it('stopping in the lobby is refused', async () => {
        const { controllers } = await lobby(2);

        expect(await codeOf((controllers[0] as ControllerSDK).stopGame())).toBe('NO_GAME_RUNNING');
    });

    it('a player who joins during a game receives it', async () => {
        const { roomCode, controllers } = await lobby(1);
        const host = controllers[0] as ControllerSDK;
        await selectParty(host);
        await host.startGame();
        const late = newController();
        const received = collect<[GameManifest]>((cb) => late.onGameStarted(cb));

        await late.joinRoom(roomCode, 'Luigi');

        await vi.waitFor(() => {
            expect(received).toEqual([[PARTY]]);
            expect(late.game).toEqual(PARTY);
        });
    });

    it('the first player to join is the host, the next ones are not', async () => {
        const { controllers } = await lobby(2);

        expect(controllers.map((controller) => controller.isHost)).toEqual([true, false]);
    });

    it('a player who becomes host after the host left can start the game', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const [mario, luigi] = controllers as [ControllerSDK, ControllerSDK];
        const updates = watchPlayers(consoleSdk);
        mario.disconnect();
        vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
        await vi.waitFor(() => {
            expect(updates.at(-1)).toMatchObject([{ isConnected: false }, {}]);
        });
        vi.advanceTimersByTime(PLAYER_GRACE_TIME);
        vi.useRealTimers();
        await vi.waitFor(() => expect(luigi.isHost).toBe(true));

        // Duo needs two players, so the new host picks a game for one
        await selectParty(luigi);

        expect(await codeOf(luigi.startGame())).toBe('RESOLVED');
    });
});

describe('actions and messages', () => {
    it('an action reaches the console with the ID of the player who sent it', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        const moves = collect<[string, unknown]>((cb) => consoleSdk.onAction('move', cb));
        const jumps = collect<[string, unknown]>((cb) => consoleSdk.onAction('jump', cb));
        await host.startGame();

        other.sendAction('move', { x: 3 });
        host.sendAction('jump');

        await vi.waitFor(() => {
            expect(moves).toEqual([[other.playerId, { x: 3 }]]);
            expect(jumps).toHaveLength(1);
            expect(jumps[0]?.[0]).toBe(host.playerId);
        });
    });

    it('a player ID forged in the payload is ignored', async () => {
        const { consoleSdk, roomCode, controllers } = await lobby(1);
        const host = controllers[0] as ControllerSDK;
        await selectParty(host);
        const { socket, playerId } = await joinRaw(roomCode, 'Luigi');
        const actions = collect<[string, unknown]>((cb) => consoleSdk.onAction('hack', cb));
        await host.startGame();

        socket.emit(ServerEvents.SEND_ACTION, { type: 'hack', playerId: host.playerId });

        await vi.waitFor(() => expect(actions).toEqual([[playerId, undefined]]));
    });

    it('an action with an invalid payload is not relayed', async () => {
        const { consoleSdk, roomCode, controllers } = await lobby(1);
        const host = controllers[0] as ControllerSDK;
        await selectParty(host);
        const { socket } = await joinRaw(roomCode, 'Luigi');
        const received = collect<[string, unknown]>((cb) => consoleSdk.onAction('ok', cb));
        const strays: unknown[] = [];
        consoleSdk.onAction('bad type!', (...args) => strays.push(args));
        consoleSdk.onAction('', (...args) => strays.push(args));
        await host.startGame();

        socket.emit(ServerEvents.SEND_ACTION, { type: 'bad type!' });
        socket.emit(ServerEvents.SEND_ACTION, { type: '' });
        socket.emit(ServerEvents.SEND_ACTION, { type: 'x'.repeat(65) });
        socket.emit(ServerEvents.SEND_ACTION, { type: 'ok', data: 'a'.repeat(70_000) });
        socket.emit(ServerEvents.SEND_ACTION, 'nope');
        socket.emit(ServerEvents.SEND_ACTION, { type: 'ok', data: 1 });

        await vi.waitFor(() => expect(received).toHaveLength(1));
        expect(received[0]?.[1]).toBe(1);
        expect(strays).toEqual([]);
    });

    it('an action sent in the lobby is not relayed', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const host = controllers[0] as ControllerSDK;
        const received = collect<[string, unknown]>((cb) => consoleSdk.onAction('tap', cb));

        host.sendAction('tap', 'lobby');
        await host.startGame();
        host.sendAction('tap', 'game');

        await vi.waitFor(() => expect(received).toHaveLength(1));
        expect(received[0]?.[1]).toBe('game');
    });

    it('a broadcast reaches every controller', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        const onHost = collect<[unknown, MessageMeta]>((cb) => host.onMessage('score', cb));
        const onOther = collect<[unknown, MessageMeta]>((cb) => other.onMessage('score', cb));
        await host.startGame();

        consoleSdk.broadcast('score', { value: 10 });

        await vi.waitFor(() => {
            expect(onHost).toEqual([[{ value: 10 }, { isPrivate: false }]]);
            expect(onOther).toEqual([[{ value: 10 }, { isPrivate: false }]]);
        });
    });

    it('the console that broadcasts does not receive its own message', async () => {
        const consoleSocket = rawIo(url);
        clients.push(consoleSocket);
        const roomCreated = new Promise<{ roomCode: string }>((resolve) =>
            consoleSocket.once(ClientEvents.ROOM_CREATED, resolve),
        );
        consoleSocket.emit(ServerEvents.CREATE_ROOM);
        const { roomCode } = await roomCreated;
        const host = newController();
        await host.joinRoom(roomCode, 'Mario');
        await selectParty(host);
        const echoes: unknown[] = [];
        consoleSocket.on(ClientEvents.GAME_MESSAGE, (message) => echoes.push(message));
        const received = collect<[unknown, MessageMeta]>((cb) => host.onMessage('news', cb));
        await host.startGame();

        consoleSocket.emit(ServerEvents.BROADCAST_MESSAGE, { type: 'news', data: 1 });

        await vi.waitFor(() => expect(received).toHaveLength(1));
        expect(echoes).toEqual([]);
    });

    it('a broadcast sent in the lobby is not received', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const host = controllers[0] as ControllerSDK;
        const received = collect<[unknown, MessageMeta]>((cb) => host.onMessage('news', cb));

        consoleSdk.broadcast('news', 'lobby');
        await host.startGame();
        consoleSdk.broadcast('news', 'game');

        await vi.waitFor(() => expect(received).toHaveLength(1));
        expect(received[0]?.[0]).toBe('game');
    });

    it('a private message reaches only its target', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        const onHost = collect<[unknown, MessageMeta]>((cb) => host.onMessage('secret', cb));
        const onOther = collect<[unknown, MessageMeta]>((cb) => other.onMessage('secret', cb));
        await host.startGame();

        await consoleSdk.sendToPlayer(other.playerId as string, 'secret', 'psst');
        // Same console socket, same order: the broadcast arrives after the private message
        consoleSdk.broadcast('secret', 'everyone');

        await vi.waitFor(() => {
            expect(onOther).toEqual([
                ['psst', { isPrivate: true }],
                ['everyone', { isPrivate: false }],
            ]);
            expect(onHost).toEqual([['everyone', { isPrivate: false }]]);
        });
    });

    it('a private message to an unknown player is refused', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        await (controllers[0] as ControllerSDK).startGame();

        expect(await codeOf(consoleSdk.sendToPlayer('nobody', 'secret', 'psst'))).toBe(
            'PLAYER_NOT_FOUND',
        );
    });

    it('a private message to a player who is away is refused', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        const gone = collect<[string]>((cb) => consoleSdk.onDisconnectedUser(cb));
        await host.startGame();
        other.disconnect();
        await vi.waitFor(() => expect(gone).toHaveLength(1));

        expect(await codeOf(consoleSdk.sendToPlayer(other.playerId as string, 'secret', 'x'))).toBe(
            'PLAYER_DISCONNECTED',
        );
    });

    it('a private message in the lobby is refused', async () => {
        const { consoleSdk, controllers } = await lobby(1);

        expect(
            await codeOf(
                consoleSdk.sendToPlayer((controllers[0] as ControllerSDK).playerId as string, 'a'),
            ),
        ).toBe('NO_GAME_RUNNING');
    });

    it('a private message with an invalid type is refused', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const host = controllers[0] as ControllerSDK;
        await host.startGame();

        expect(await codeOf(consoleSdk.sendToPlayer(host.playerId as string, 'bad type!'))).toBe(
            'INVALID_PAYLOAD',
        );
    });

    it('a controller cannot send a private message or set a role', async () => {
        const { roomCode, controllers } = await lobby(1);
        const host = controllers[0] as ControllerSDK;
        await selectParty(host);
        const { socket, playerId } = await joinRaw(roomCode, 'Luigi');
        await host.startGame();

        const privateMessage = await socket.emitWithAck(ServerEvents.SEND_PRIVATE_MESSAGE, {
            playerId,
            type: 'x',
        });
        const role = await socket.emitWithAck(ServerEvents.SET_PLAYER_ROLE, {
            playerId,
            role: 'king',
        });

        expect(privateMessage).toMatchObject({ ok: false, error: { code: 'NOT_CONSOLE' } });
        expect(role).toMatchObject({ ok: false, error: { code: 'NOT_CONSOLE' } });
    });
});

describe('roles and statuses', () => {
    it('a role reaches only the player it is given to', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        const onHost = collect<[PlayerState]>((cb) => host.onPlayerStateChanged(cb));
        const onOther = collect<[PlayerState]>((cb) => other.onPlayerStateChanged(cb));
        await host.startGame();

        await consoleSdk.setPlayerRole(other.playerId as string, 'wolf');
        // The status is sent after the role: when it arrives, the role message was handled too
        await consoleSdk.setPlayerStatus(host.playerId as string, 'ready');

        await vi.waitFor(() => {
            expect(onOther).toEqual([[{ role: 'wolf', status: null }]]);
            expect(onHost).toEqual([[{ role: null, status: 'ready' }]]);
            expect(other.role).toBe('wolf');
            expect(host.role).toBeNull();
            expect(host.status).toBe('ready');
        });
    });

    it('the console sees roles and statuses in the player list', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        const updates = watchPlayers(consoleSdk);
        await host.startGame();

        await consoleSdk.setPlayerRole(other.playerId as string, 'wolf');
        await consoleSdk.setPlayerStatus(other.playerId as string, 'alive');

        await vi.waitFor(() => {
            expect(updates.at(-1)).toMatchObject([
                { role: null, status: null },
                { role: 'wolf', status: 'alive' },
            ]);
        });
    });

    it('a role can be removed with null', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        await host.startGame();
        await consoleSdk.setPlayerRole(other.playerId as string, 'wolf');
        await vi.waitFor(() => expect(other.role).toBe('wolf'));

        await consoleSdk.setPlayerRole(other.playerId as string, null);

        await vi.waitFor(() => expect(other.role).toBeNull());
    });

    it('a player who comes back with their player ID gets their role again', async () => {
        const { consoleSdk, roomCode, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        const gone = collect<[string]>((cb) => consoleSdk.onDisconnectedUser(cb));
        await host.startGame();
        await consoleSdk.setPlayerRole(other.playerId as string, 'wolf');
        await consoleSdk.setPlayerStatus(other.playerId as string, 'alive');
        other.disconnect();
        await vi.waitFor(() => expect(gone).toHaveLength(1));

        const back = newController();
        await back.reconnectToRoom(roomCode, 'Player2', other.playerId as string);

        await vi.waitFor(() => {
            expect(back.game).toEqual(DUO);
            expect(back.role).toBe('wolf');
            expect(back.status).toBe('alive');
        });
    });

    it('a role can be given to a player who is away, and is waiting when they come back', async () => {
        const { consoleSdk, roomCode, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        const gone = collect<[string]>((cb) => consoleSdk.onDisconnectedUser(cb));
        await host.startGame();
        other.disconnect();
        await vi.waitFor(() => expect(gone).toHaveLength(1));

        await consoleSdk.setPlayerRole(other.playerId as string, 'ghost');
        const back = newController();
        await back.reconnectToRoom(roomCode, 'Player2', other.playerId as string);

        await vi.waitFor(() => expect(back.role).toBe('ghost'));
    });

    it('roles are cleared when the game stops and when a new one starts', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        const updates = watchPlayers(consoleSdk);
        await host.startGame();
        await consoleSdk.setPlayerRole(other.playerId as string, 'wolf');
        await vi.waitFor(() => expect(other.role).toBe('wolf'));

        await host.stopGame();
        await host.startGame();

        await vi.waitFor(() => {
            expect(other.role).toBeNull();
            expect(updates.at(-1)).toMatchObject([{ role: null }, { role: null }]);
        });
    });

    it('an invalid role or status is refused', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        const [host, other] = controllers as [ControllerSDK, ControllerSDK];
        await host.startGame();
        const playerId = other.playerId as string;

        expect(await codeOf(consoleSdk.setPlayerRole(playerId, ''))).toBe('INVALID_PAYLOAD');
        expect(await codeOf(consoleSdk.setPlayerRole(playerId, 'x'.repeat(51)))).toBe(
            'INVALID_PAYLOAD',
        );
        expect(await codeOf(consoleSdk.setPlayerStatus(playerId, ''))).toBe('INVALID_PAYLOAD');
        expect(other.role).toBeNull();
    });

    it('a role for an unknown player is refused', async () => {
        const { consoleSdk, controllers } = await lobby(2);
        await (controllers[0] as ControllerSDK).startGame();

        expect(await codeOf(consoleSdk.setPlayerRole('nobody', 'wolf'))).toBe('PLAYER_NOT_FOUND');
    });

    it('a role or a status in the lobby is refused', async () => {
        const { consoleSdk, controllers } = await lobby(1);
        const playerId = (controllers[0] as ControllerSDK).playerId as string;

        expect(await codeOf(consoleSdk.setPlayerRole(playerId, 'wolf'))).toBe('NO_GAME_RUNNING');
        expect(await codeOf(consoleSdk.setPlayerStatus(playerId, 'ready'))).toBe('NO_GAME_RUNNING');
    });
});

describe('malformed requests and leaks', () => {
    // A room with a raw console, a raw host and a raw second player, the game (Duo) being started
    async function rawGame() {
        const consoleSocket = rawIo(url);
        clients.push(consoleSocket);
        const created = new Promise<{ roomCode: string }>((resolve) =>
            consoleSocket.once(ClientEvents.ROOM_CREATED, resolve),
        );
        consoleSocket.emit(ServerEvents.CREATE_ROOM);
        const { roomCode } = await created;
        const host = await joinRaw(roomCode, 'Host');
        const other = await joinRaw(roomCode, 'Other');
        return { consoleSocket, roomCode, host, other };
    }

    const noAckVariants: [string, unknown[]][] = [
        ['no argument', []],
        ['a null payload', [null]],
    ];

    it.each(noAckVariants)(
        'STOP_GAME sent with %s does not stop the server answering',
        async (_name, args) => {
            const { host } = await rawGame();

            host.socket.emit(ServerEvents.STOP_GAME, ...args);
            const refused = await host.socket.emitWithAck(ServerEvents.STOP_GAME, null);
            const started = await host.socket.emitWithAck(ServerEvents.START_GAME, {});

            expect(refused).toMatchObject({ ok: false, error: { code: 'NO_GAME_RUNNING' } });
            expect(started).toEqual({ ok: true });
        },
    );

    it.each(noAckVariants)(
        'START_GAME sent with %s does not stop the server answering',
        async (_name, args) => {
            const { host } = await rawGame();
            expect(await host.socket.emitWithAck(ServerEvents.START_GAME, {})).toEqual({
                ok: true,
            });

            host.socket.emit(ServerEvents.START_GAME, ...args);
            const refused = await host.socket.emitWithAck(ServerEvents.START_GAME, null);
            const stopped = await host.socket.emitWithAck(ServerEvents.STOP_GAME, {});

            expect(refused).toMatchObject({ ok: false, error: { code: 'GAME_ALREADY_RUNNING' } });
            expect(stopped).toEqual({ ok: true });
        },
    );

    it.each([ServerEvents.SET_PLAYER_ROLE, ServerEvents.SEND_PRIVATE_MESSAGE])(
        '%s sent with no argument or a null payload does not stop the server answering',
        async (event) => {
            const { consoleSocket, host, other } = await rawGame();
            await host.socket.emitWithAck(ServerEvents.START_GAME, {});

            consoleSocket.emit(event);
            consoleSocket.emit(event, null);
            const refused = await consoleSocket.emitWithAck(event, null);
            const valid = await consoleSocket.emitWithAck(event, {
                playerId: other.playerId,
                type: 'x',
                role: 'wolf',
            });

            expect(refused).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } });
            expect(valid).toEqual({ ok: true });
        },
    );

    it.each([ServerEvents.SET_PLAYER_ROLE, ServerEvents.SEND_PRIVATE_MESSAGE])(
        '%s with an array or a string payload is refused',
        async (event) => {
            const { consoleSocket, host } = await rawGame();
            await host.socket.emitWithAck(ServerEvents.START_GAME, {});

            const array = await consoleSocket.emitWithAck(event, [host.playerId, 'x']);
            const string = await consoleSocket.emitWithAck(event, 'nope');

            expect(array).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } });
            expect(string).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } });
        },
    );

    it('a controller never receives the player list nor the ID of a player who drops', async () => {
        const consoleSdk = newConsole();
        const roomCode = await consoleSdk.createRoom();
        const dropped: string[] = [];
        consoleSdk.onDisconnectedUser((playerId) => dropped.push(playerId));
        const host = await joinRaw(roomCode, 'Host');
        const other = await joinRaw(roomCode, 'Other');
        const leaks: string[] = [];
        host.socket.on(ClientEvents.UPDATE_PLAYERS, () => leaks.push('update_players'));
        host.socket.on(ClientEvents.DISCONNECTED_USER, () => leaks.push('disconnected_user'));
        const states = collect<[unknown]>((cb) => {
            host.socket.on(ClientEvents.PLAYER_STATE, cb);
            return () => host.socket.off(ClientEvents.PLAYER_STATE, cb);
        });
        await host.socket.emitWithAck(ServerEvents.START_GAME, {});

        await consoleSdk.setPlayerRole(other.playerId, 'wolf');
        other.socket.disconnect();
        await vi.waitFor(() => expect(dropped).toEqual([other.playerId]));
        // The console has seen the drop, so the server already sent whatever it sends for it.
        // This message follows on the host's socket: when it arrives, a leak would have too.
        await consoleSdk.setPlayerRole(host.playerId, 'king');

        await vi.waitFor(() => expect(states).toHaveLength(1));
        expect(leaks).toEqual([]);
    });

    it('reconnecting with the ID of a player who is still connected is refused', async () => {
        const consoleSdk = newConsole();
        const roomCode = await consoleSdk.createRoom();
        const updates = watchPlayers(consoleSdk);
        const host = await joinRaw(roomCode, 'Host');
        const victim = await joinRaw(roomCode, 'Victim');
        await host.socket.emitWithAck(ServerEvents.START_GAME, {});
        const states = collect<[unknown]>((cb) => {
            victim.socket.on(ClientEvents.PLAYER_STATE, cb);
            return () => victim.socket.off(ClientEvents.PLAYER_STATE, cb);
        });
        const intruder = rawIo(url);
        clients.push(intruder);
        const errors: unknown[] = [];
        const intruderEvents: string[] = [];
        intruder.on(ClientEvents.ERROR, (error) => errors.push(error));
        intruder.onAny((event: string) => intruderEvents.push(event));

        intruder.emit(ServerEvents.JOIN_ROOM, roomCode, 'Intruder', victim.playerId);
        await vi.waitFor(() =>
            expect(errors).toEqual([{ message: 'This player is already connected.' }]),
        );
        await consoleSdk.setPlayerRole(victim.playerId, 'wolf');
        // The intruder is not in the room: this answer arrives after anything sent to it before
        const answer = await intruder.emitWithAck(ServerEvents.START_GAME, {});

        expect(answer).toMatchObject({ ok: false, error: { code: 'NOT_IN_ROOM' } });
        expect(intruderEvents).toEqual([ClientEvents.ERROR]);
        await vi.waitFor(() => expect(states).toEqual([[{ role: 'wolf', status: null }]]));
        expect(updates.at(-1)).toMatchObject([
            { name: 'Host', isConnected: true },
            { name: 'Victim', playerId: victim.playerId, isConnected: true, role: 'wolf' },
        ]);
    });
});

describe('unsubscribing', () => {
    it('a callback is no longer called after its unsubscribe function ran', async () => {
        const { controllers } = await lobby(2);
        const host = controllers[0] as ControllerSDK;
        const removed: GameManifest[] = [];
        const kept: GameManifest[] = [];
        const unsubscribe = host.onGameStarted((game) => removed.push(game));
        host.onGameStarted((game) => kept.push(game));

        unsubscribe();
        await host.startGame();

        // Listeners run in registration order: the kept one ran after the removed one would have
        await vi.waitFor(() => expect(kept).toEqual([DUO]));
        expect(removed).toEqual([]);
    });

    it('unsubscribing one callback leaves the other ones of the same event', async () => {
        const consoleSdk = newConsole();
        const first = collect<[CatalogueState]>((cb) => consoleSdk.onCatalogue(cb));
        const second = collect<[CatalogueState]>((cb) => consoleSdk.onCatalogue(cb));
        const unsubscribe = consoleSdk.onCatalogue(() => {
            throw new Error('must not be called');
        });
        unsubscribe();

        await consoleSdk.createRoom();

        await vi.waitFor(() => {
            expect(first).toHaveLength(1);
            expect(second).toHaveLength(1);
        });
    });
});
