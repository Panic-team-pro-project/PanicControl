import { io } from 'socket.io-client';
import eventsCodes from 'common';
import type { GameManifest } from 'common/gameManifest';
import { SocketChannel } from './channel.js';
import type { ConsoleSDKOptions, PlayerListInfo } from './Types/consoleTypes.js';
import type {
    CatalogueState,
    DataArgs,
    EventKey,
    MessageMap,
    TrafficEntry,
} from './Types/sharedTypes.js';

const { ClientEvents, ServerEvents } = eventsCodes;

/**
 * Screen side of a game: creates the room, sees the players, receives their actions and talks
 * back to their phones.
 *
 * @typeParam A Actions the controllers send, as `{ eventName: dataType }` (`void` for no data).
 * @typeParam M Messages the screen sends to the controllers, same shape.
 */
export class ConsoleSDK<A extends object = MessageMap, M extends object = MessageMap> {
    private readonly channel: SocketChannel;
    private readonly debug: boolean;
    private currentGame: GameManifest | null = null;
    private currentCatalogue: CatalogueState | null = null;

    public roomCode: string | null = null;

    constructor(options: ConsoleSDKOptions) {
        this.debug = options.debug ?? false;
        this.channel = new SocketChannel(io(options.serverUrl));

        this.channel.on('connect', () => {
            this.log(`console connected (id: ${this.channel.id})`);
        });
        this.channel.on('disconnect', (reason: string) => {
            this.warn(`console disconnected: ${reason}`);
        });
        this.channel.on(ClientEvents.CATALOGUE, (state: CatalogueState) => {
            this.currentCatalogue = state;
        });
        this.channel.on(
            ClientEvents.CATALOGUE_SELECTION,
            (data: { selectedGame: GameManifest | null }) => {
                if (this.currentCatalogue) {
                    this.currentCatalogue = {
                        ...this.currentCatalogue,
                        selectedGameId: data.selectedGame?.id ?? null,
                    };
                }
            },
        );
        this.channel.on(ClientEvents.GAME_STARTED, (game: GameManifest) => {
            this.currentGame = game;
        });
        this.channel.on(ClientEvents.GAME_STOPPED, () => {
            this.currentGame = null;
        });
    }

    /** The game currently running in the room, `null` in the lobby. */
    get game(): GameManifest | null {
        return this.currentGame;
    }

    /** The games available and the one selected, `null` until the server sent them. */
    get catalogue(): CatalogueState | null {
        return this.currentCatalogue;
    }

    private log(message: string): void {
        if (this.debug) {
            console.log(`[PanicControl] ${message}`);
        }
    }

    private warn(message: string): void {
        if (this.debug) {
            console.warn(`[PanicControl] ${message}`);
        }
    }

    /** Called when the connection to the server is established. Returns the unsubscribe function. */
    onConnect(callback: () => void): () => void {
        return this.channel.on('connect', () => callback());
    }

    /** Called when the connection to the server is lost. Returns the unsubscribe function. */
    onDisconnect(callback: (reason: string) => void): () => void {
        return this.channel.on('disconnect', (reason: string) => callback(reason));
    }

    /**
     * Called with every message this console sends and receives, and with connection changes.
     * For debugging tools, such as the developer mode message log: games should use the typed
     * methods. Returns the unsubscribe function.
     */
    onTraffic(callback: (entry: TrafficEntry) => void): () => void {
        return this.channel.onTraffic(callback);
    }

    /** Closes the connection to the server. */
    disconnect(): void {
        this.channel.disconnect();
    }

    /**
     * Creates a room and resolves with its code.
     * Rejects when the server answers with an error or does not answer within 5 seconds.
     */
    async createRoom(): Promise<string> {
        const data = await this.channel.waitFor<{ roomCode: string }>(
            ClientEvents.ROOM_CREATED,
            () => this.channel.emit(ServerEvents.CREATE_ROOM),
            'Timed out while creating the room.',
        );

        this.roomCode = data.roomCode;

        return data.roomCode;
    }

    /**
     * Takes back a room after the screen was reloaded, within the server grace time.
     * Rejects when the room is unknown, already has a console, or after 5 seconds.
     */
    async reconnectToRoom(roomCode: string): Promise<string> {
        const data = await this.channel.waitFor<{ roomCode: string }>(
            ClientEvents.RECONNECTED_TO_ROOM,
            () => this.channel.emit(ServerEvents.RECONNECT_TO_ROOM, roomCode),
            'Timed out while reconnecting to the room.',
        );

        this.roomCode = data.roomCode;

        return data.roomCode;
    }

    /**
     * Called with the room code when this console took its room back.
     * Returns the unsubscribe function.
     */
    onReconnectedToRoom(callback: (roomCode: string) => void): () => void {
        return this.channel.on(ClientEvents.RECONNECTED_TO_ROOM, (data: { roomCode: string }) =>
            callback(data.roomCode),
        );
    }

    /** Called with the full player list each time it changes. Returns the unsubscribe function. */
    onUpdatePlayers(callback: (players: PlayerListInfo[]) => void): () => void {
        return this.channel.on(ClientEvents.UPDATE_PLAYERS, (players: PlayerListInfo[]) =>
            callback(players),
        );
    }

    /** Called when a player loses the connection (they may still come back). */
    onDisconnectedUser(callback: (playerId: string) => void): () => void {
        return this.channel.on(ClientEvents.DISCONNECTED_USER, (data: { playerId: string }) =>
            callback(data.playerId),
        );
    }

    /** Called when the room is closed by the server. Returns the unsubscribe function. */
    onRoomClosed(callback: (message: string) => void): () => void {
        return this.channel.on(ClientEvents.ROOM_CLOSED, (data: { message: string }) =>
            callback(data.message),
        );
    }

    /** Called with the games list, when the room is created and when it is taken back. */
    onCatalogue(callback: (state: CatalogueState) => void): () => void {
        return this.channel.on(ClientEvents.CATALOGUE, (state: CatalogueState) => callback(state));
    }

    /** Called when the host moves the selection in the catalogue. */
    onCatalogueSelection(callback: (selectedGame: GameManifest | null) => void): () => void {
        return this.channel.on(
            ClientEvents.CATALOGUE_SELECTION,
            (data: { selectedGame: GameManifest | null }) => callback(data.selectedGame),
        );
    }

    /** Called when the host starts the selected game. */
    onGameStarted(callback: (game: GameManifest) => void): () => void {
        return this.channel.on(ClientEvents.GAME_STARTED, (game: GameManifest) => callback(game));
    }

    /** Called when the host stops the game and the room goes back to the lobby. */
    onGameStopped(callback: () => void): () => void {
        return this.channel.on(ClientEvents.GAME_STOPPED, () => callback());
    }

    /**
     * Called each time a player sends an action of this type.
     * The player identity comes from the server, a controller cannot pretend to be another one.
     */
    onAction<K extends EventKey<A>>(
        type: K,
        callback: (playerId: string, data: A[K]) => void,
    ): () => void {
        return this.channel.on(
            ClientEvents.PLAYER_ACTION,
            (action: { playerId: string; type: string; data: A[K] }) => {
                if (action.type === type) {
                    callback(action.playerId, action.data);
                }
            },
        );
    }

    /** Sends a message to every controller. Only accepted while a game is running. */
    broadcast<K extends EventKey<M>>(type: K, ...data: DataArgs<M[K]>): void {
        this.channel.emit(ServerEvents.BROADCAST_MESSAGE, messagePayload(type, data));
    }

    /**
     * Sends a message to one controller.
     * Rejects with a `PanicControlError` (`NO_GAME_RUNNING`, `PLAYER_NOT_FOUND`,
     * `PLAYER_DISCONNECTED`, `INVALID_PAYLOAD`).
     */
    sendToPlayer<K extends EventKey<M>>(
        playerId: string,
        type: K,
        ...data: DataArgs<M[K]>
    ): Promise<void> {
        return this.channel.request(ServerEvents.SEND_PRIVATE_MESSAGE, {
            playerId,
            ...messagePayload(type, data),
        });
    }

    /**
     * Gives a player a secret role (or `null` to remove it), 1 to 50 characters.
     * The role is sent to that player only: never display it to everyone.
     * Rejects with a `PanicControlError`. Roles are cleared when a game starts or stops.
     */
    setPlayerRole(playerId: string, role: string | null): Promise<void> {
        return this.channel.request(ServerEvents.SET_PLAYER_ROLE, { playerId, role });
    }

    /**
     * Sets the short status of a player (or `null`), 1 to 50 characters.
     * Rejects with a `PanicControlError`. Statuses are cleared when a game starts or stops.
     */
    setPlayerStatus(playerId: string, status: string | null): Promise<void> {
        return this.channel.request(ServerEvents.SET_PLAYER_STATUS, { playerId, status });
    }
}

function messagePayload(type: string, data: unknown[]): { type: string; data?: unknown } {
    return data[0] === undefined ? { type } : { type, data: data[0] };
}
