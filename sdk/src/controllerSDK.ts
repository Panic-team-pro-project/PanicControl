import { io } from 'socket.io-client';
import eventsCodes from 'common';
import type { Direction, GameManifest } from 'common/gameManifest';
import { SocketChannel } from './channel.js';
import type { ControllerSDKOptions } from './Types/controllerTypes.js';
import type {
    DataArgs,
    EventKey,
    MessageMap,
    MessageMeta,
    PlayerState,
    TrafficEntry,
} from './Types/sharedTypes.js';

const { ClientEvents, ServerEvents } = eventsCodes;

/**
 * Phone side of a game: joins a room, sends the player's actions and receives what the screen
 * tells this player.
 *
 * @typeParam A Actions this controller sends, as `{ eventName: dataType }` (`void` for no data).
 * @typeParam M Messages the screen sends, same shape.
 */
export class ControllerSDK<A extends object = MessageMap, M extends object = MessageMap> {
    private readonly channel: SocketChannel;
    private readonly debug: boolean;
    private host = false;
    private currentGame: GameManifest | null = null;
    private currentSelectedGame: GameManifest | null = null;
    private currentRole: string | null = null;
    private currentStatus: string | null = null;

    /** Code of the joined room, `null` before joining. */
    public roomCode: string | null = null;
    /** Identity of this player, to keep to reconnect later. `null` before joining. */
    public playerId: string | null = null;

    constructor(options: ControllerSDKOptions) {
        this.debug = options.debug ?? false;
        this.channel = new SocketChannel(io(options.serverUrl));
        if (options.playerId) {
            this.playerId = options.playerId;
        }

        this.channel.on('connect', () => {
            this.log(`controller connected (id: ${this.channel.id})`);
        });
        this.channel.on('disconnect', (reason: string) => {
            this.warn(`controller disconnected: ${reason}`);
        });
        this.channel.on(ClientEvents.PLAYER_JOINED, (data: { isHost: boolean }) => {
            this.host = data.isHost;
        });
        this.channel.on(ClientEvents.PROMOTE_TO_HOST, () => {
            this.host = true;
        });
        this.channel.on(
            ClientEvents.CATALOGUE_SELECTION,
            (data: { selectedGame: GameManifest | null }) => {
                this.currentSelectedGame = data.selectedGame;
            },
        );
        this.channel.on(ClientEvents.GAME_STARTED, (game: GameManifest) => {
            this.currentGame = game;
            this.currentRole = null;
            this.currentStatus = null;
        });
        this.channel.on(ClientEvents.GAME_STOPPED, () => {
            this.currentGame = null;
            this.currentRole = null;
            this.currentStatus = null;
        });
        this.channel.on(ClientEvents.PLAYER_STATE, (state: PlayerState) => {
            this.currentRole = state.role;
            this.currentStatus = state.status;
        });
    }

    /** Whether this player is the host, who drives the catalogue and starts the game. */
    get isHost(): boolean {
        return this.host;
    }

    /** The game currently running, `null` in the lobby. */
    get game(): GameManifest | null {
        return this.currentGame;
    }

    /** The game highlighted in the catalogue, `null` when there is none. */
    get selectedGame(): GameManifest | null {
        return this.currentSelectedGame;
    }

    /** Secret role given by the game, `null` when there is none. */
    get role(): string | null {
        return this.currentRole;
    }

    /** Short status given by the game, `null` when there is none. */
    get status(): string | null {
        return this.currentStatus;
    }

    private log(message: string): void {
        if (this.debug) console.log(`[PanicControl] ${message}`);
    }

    private warn(message: string): void {
        if (this.debug) console.warn(`[PanicControl] ${message}`);
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
     * Called with every message this controller sends and receives, and with connection changes.
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
     * Joins a room and resolves with the player ID.
     * Rejects when the room is unknown or full, the name is refused, or after 5 seconds.
     */
    async joinRoom(roomCode: string, playerName: string): Promise<string> {
        const data = await this.channel.waitFor<{ playerId: string }>(
            ClientEvents.PLAYER_JOINED,
            () => this.channel.emit(ServerEvents.JOIN_ROOM, roomCode, playerName),
            'Timed out while joining the room.',
        );
        this.roomCode = roomCode;
        this.playerId = data.playerId;
        return data.playerId;
    }

    /** Takes back one's place in a room with the ID received earlier, within the grace time. */
    async reconnectToRoom(roomCode: string, playerName: string, playerId: string): Promise<string> {
        const data = await this.channel.waitFor<{ playerId: string }>(
            ClientEvents.PLAYER_JOINED,
            () => this.channel.emit(ServerEvents.JOIN_ROOM, roomCode, playerName, playerId),
            'Timed out while reconnecting to the room.',
        );
        this.roomCode = roomCode;
        this.playerId = data.playerId;
        return data.playerId;
    }

    /** Called when this player becomes host after the previous host left. */
    onPromoteToHost(callback: () => void): () => void {
        return this.channel.on(ClientEvents.PROMOTE_TO_HOST, () => callback());
    }

    /** Called when the console loses its connection. Returns the unsubscribe function. */
    onConsoleDisconnected(callback: (message: string) => void): () => void {
        return this.channel.on(ClientEvents.CONSOLE_DISCONNECTED, (data: { message: string }) =>
            callback(data.message),
        );
    }

    /** Called when the console is back. Returns the unsubscribe function. */
    onConsoleReconnected(callback: (message: string) => void): () => void {
        return this.channel.on(ClientEvents.CONSOLE_RECONNECTED, (data: { message: string }) =>
            callback(data.message),
        );
    }

    /**
     * Moves the catalogue selection. Host only: the server ignores it from anyone else,
     * and outside the lobby.
     */
    navigateCatalogue(direction: Direction): void {
        this.channel.emit(ServerEvents.NAVIGATE_CATALOGUE, { direction });
    }

    /**
     * Starts the selected game. Host only.
     * Rejects with a `PanicControlError`: `NOT_HOST`, `NO_GAME_SELECTED`, `GAME_ALREADY_RUNNING`,
     * `NOT_ENOUGH_PLAYERS` or `TOO_MANY_PLAYERS`.
     */
    startGame(): Promise<void> {
        return this.channel.request(ServerEvents.START_GAME);
    }

    /** Stops the running game. Host only. Rejects with `NOT_HOST` or `NO_GAME_RUNNING`. */
    stopGame(): Promise<void> {
        return this.channel.request(ServerEvents.STOP_GAME);
    }

    /** Called when the highlighted game changes (also right after joining). */
    onCatalogueSelection(callback: (selectedGame: GameManifest | null) => void): () => void {
        return this.channel.on(
            ClientEvents.CATALOGUE_SELECTION,
            (data: { selectedGame: GameManifest | null }) => callback(data.selectedGame),
        );
    }

    /** Called when a game starts (also when joining or coming back while one is running). */
    onGameStarted(callback: (game: GameManifest) => void): () => void {
        return this.channel.on(ClientEvents.GAME_STARTED, (game: GameManifest) => callback(game));
    }

    /** Called when the game is stopped and the room goes back to the lobby. */
    onGameStopped(callback: () => void): () => void {
        return this.channel.on(ClientEvents.GAME_STOPPED, () => callback());
    }

    /** Called when the screen changes this player's role or status, and on (re)joining. */
    onPlayerStateChanged(callback: (state: PlayerState) => void): () => void {
        return this.channel.on(ClientEvents.PLAYER_STATE, (state: PlayerState) =>
            callback({ role: state.role, status: state.status }),
        );
    }

    /** Sends an action to the screen. Only relayed while a game is running. */
    sendAction<K extends EventKey<A>>(type: K, ...data: DataArgs<A[K]>): void {
        const [payload] = data as unknown[];
        this.channel.emit(
            ServerEvents.SEND_ACTION,
            payload === undefined ? { type } : { type, data: payload },
        );
    }

    /** Called with each message of this type, broadcast or sent to this player only. */
    onMessage<K extends EventKey<M>>(
        type: K,
        callback: (data: M[K], meta: MessageMeta) => void,
    ): () => void {
        return this.channel.on(
            ClientEvents.GAME_MESSAGE,
            (message: { type: string; data: M[K]; isPrivate: boolean }) => {
                if (message.type === type) {
                    callback(message.data, { isPrivate: message.isPrivate });
                }
            },
        );
    }
}
