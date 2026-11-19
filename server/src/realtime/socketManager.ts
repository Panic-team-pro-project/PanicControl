import type { Server, Socket } from 'socket.io';
import { RoomManager } from './roomManager.js';
import { generatePlayerId } from '../core/utils.js';
import { Player } from './player.js';
import eventsCodes, { type ErrorCode } from 'common';
import { validatePlayerName } from '../core/pseudoFilter.js';
import type { Room } from './room.js';
import type { Catalogue } from '../games/catalogue.js';
import { DIRECTIONS, type Direction, type GameManifest } from 'common/gameManifest';
import {
    checkLabel,
    checkMessageData,
    checkMessageType,
    isPlainObject,
} from '../core/messagePayload.js';

const { ClientEvents, ServerEvents, ErrorCodes } = eventsCodes;

type Ack = (
    response: { ok: true } | { ok: false; error: { code: ErrorCode; message: string } },
) => void;

interface Sender {
    room: Room;
    roomCode: string;
    isConsole: boolean;
    player: Player | undefined;
}

export class SocketManager {
    private io: Server;
    private roomManager: RoomManager;
    private catalogue: Catalogue;

    constructor(io: Server, catalogue: Catalogue) {
        this.io = io;
        this.catalogue = catalogue;
        this.roomManager = new RoomManager(io);
        this.initListeners();
    }

    private initListeners(): void {
        this.io.on('connection', (socket: Socket) => {
            console.log(`🟢 Un client connecté : ${socket.id}`);

            this.handleCreateRoom(socket);
            this.handleReconnectToRoom(socket);
            this.handleJoinRoom(socket);
            this.handleDisconnect(socket);
            this.handleNavigateCatalogue(socket);
            this.handleStartGame(socket);
            this.handleStopGame(socket);
            this.handleSendAction(socket);
            this.handleBroadcastMessage(socket);
            this.handleSendPrivateMessage(socket);
            this.handleSetPlayerLabel(socket, ServerEvents.SET_PLAYER_ROLE, 'role');
            this.handleSetPlayerLabel(socket, ServerEvents.SET_PLAYER_STATUS, 'status');
        });
    }

    private handleCreateRoom(socket: Socket): void {
        socket.on(ServerEvents.CREATE_ROOM, () => {
            const roomCode = this.roomManager.generateUniqueRoomCode();
            const room = this.roomManager.createRoom(roomCode, socket.id);
            room.selectedGameId = this.catalogue.list()[0]?.id ?? null;

            socket.join(roomCode);
            socket.data.roomCode = roomCode;
            socket.data.isHost = false;

            console.log(`📺 Salon créé : ${roomCode} par l'hôte ${socket.id}`);
            socket.emit(ClientEvents.ROOM_CREATED, { roomCode });
            this.emitCatalogue(socket, room);
        });
    }

    private handleReconnectToRoom(socket: Socket): void {
        socket.on(ServerEvents.RECONNECT_TO_ROOM, (roomCode: string) => {
            const room = this.roomManager.getRoom(roomCode);
            if (!room) {
                console.log(`❌ Salon introuvable pour la reconnexion : ${roomCode}`);
                socket.emit(ClientEvents.ERROR, { message: 'Room not found for reconnection' });
                return;
            }

            if (!room.isConnected) {
                room.roomSocketId = socket.id;
                room.isConnected = true;

                socket.join(roomCode);
                socket.data.roomCode = roomCode;
                socket.data.isHost = true;

                console.log(
                    `✅ Console reconnectée avec succès sur le salon ${roomCode} (Nouveau socket: ${socket.id})`,
                );

                socket.emit(ClientEvents.RECONNECTED_TO_ROOM, { roomCode });
                socket.emit(ClientEvents.UPDATE_PLAYERS, room.getPlayersInfos());
                this.emitCatalogue(socket, room);
                if (room.phase === 'playing' && room.game) {
                    socket.emit(ClientEvents.GAME_STARTED, room.game);
                }
                this.io
                    .to(roomCode)
                    .emit(ClientEvents.CONSOLE_RECONNECTED, { message: 'Console is back online' });
            } else {
                console.log(
                    `⚠️ Tentative de reconnexion sur le salon ${roomCode}, mais l'hôte est déjà connecté.`,
                );
                socket.emit(ClientEvents.ERROR, { message: 'Room is already connected' });
            }
        });
    }

    // The player list carries roles and statuses: only the console receives it
    private emitPlayers(room: Room): void {
        this.io.to(room.roomSocketId).emit(ClientEvents.UPDATE_PLAYERS, room.getPlayersInfos());
    }

    private emitCatalogue(socket: Socket, room: Room): void {
        socket.emit(ClientEvents.CATALOGUE, {
            games: this.catalogue.list(),
            selectedGameId: room.selectedGameId,
        });
    }

    // What a player needs to know about the current phase when joining or reconnecting
    private emitPlayerView(socket: Socket, room: Room, player: Player): void {
        if (room.phase === 'playing' && room.game) {
            socket.emit(ClientEvents.GAME_STARTED, room.game);
            socket.emit(ClientEvents.PLAYER_STATE, { role: player.role, status: player.status });
        } else {
            socket.emit(ClientEvents.CATALOGUE_SELECTION, {
                selectedGame: this.selectedGame(room),
            });
        }
    }

    private selectedGame(room: Room): GameManifest | null {
        return room.selectedGameId === null
            ? null
            : (this.catalogue.get(room.selectedGameId) ?? null);
    }

    // Who is talking, from server state only. Undefined when the socket is not in a room.
    private identify(socket: Socket): Sender | undefined {
        const roomCode: unknown = socket.data.roomCode;
        if (typeof roomCode !== 'string') return undefined;

        const room = this.roomManager.getRoom(roomCode);
        if (!room) return undefined;

        const isConsole = room.roomSocketId === socket.id;
        const player = room.players.find((p) => p.socketId === socket.id);
        if (!isConsole && !player) return undefined;

        return { room, roomCode, isConsole, player };
    }

    private reply(ack: unknown, code?: ErrorCode, message?: string): void {
        if (typeof ack !== 'function') return;
        (ack as Ack)(
            code ? { ok: false, error: { code, message: message ?? code } } : { ok: true },
        );
    }

    private ignore(event: string, reason: string): void {
        console.warn(`⚠️ ${event} ignoré : ${reason}`);
    }

    private handleNavigateCatalogue(socket: Socket): void {
        socket.on(ServerEvents.NAVIGATE_CATALOGUE, (payload: unknown) => {
            const sender = this.identify(socket);
            if (!sender?.player?.isHost || sender.room.phase !== 'lobby') {
                this.ignore(ServerEvents.NAVIGATE_CATALOGUE, 'not allowed');
                return;
            }
            const direction = isPlainObject(payload) ? payload.direction : undefined;
            if (!DIRECTIONS.some((d) => d === direction)) {
                this.ignore(ServerEvents.NAVIGATE_CATALOGUE, 'invalid direction');
                return;
            }

            const { room, roomCode } = sender;
            const ids = this.catalogue.list().map((game) => game.id);
            if (room.moveSelection(direction as Direction, ids)) {
                this.io.to(roomCode).emit(ClientEvents.CATALOGUE_SELECTION, {
                    selectedGame: this.selectedGame(room),
                });
            }
        });
    }

    private handleStartGame(socket: Socket): void {
        socket.on(ServerEvents.START_GAME, (_payload: unknown, ack?: unknown) => {
            const sender = this.identify(socket);
            if (!sender) {
                return this.reply(ack, ErrorCodes.NOT_IN_ROOM, 'You are not in a room');
            }
            const { room, roomCode } = sender;
            if (!sender.player?.isHost) {
                return this.reply(ack, ErrorCodes.NOT_HOST, 'Only the host can start a game');
            }
            if (room.phase !== 'lobby') {
                return this.reply(
                    ack,
                    ErrorCodes.GAME_ALREADY_RUNNING,
                    'A game is already running',
                );
            }
            const manifest = room.selectedGameId
                ? this.catalogue.get(room.selectedGameId)
                : undefined;
            if (!manifest) {
                return this.reply(ack, ErrorCodes.NO_GAME_SELECTED, 'No game is selected');
            }
            if (room.players.length < manifest.minPlayers) {
                return this.reply(
                    ack,
                    ErrorCodes.NOT_ENOUGH_PLAYERS,
                    `This game needs at least ${manifest.minPlayers} players`,
                );
            }
            if (room.players.length > manifest.maxPlayers) {
                return this.reply(
                    ack,
                    ErrorCodes.TOO_MANY_PLAYERS,
                    `This game accepts at most ${manifest.maxPlayers} players`,
                );
            }

            room.startGame(manifest);
            console.log(`🎮 Partie ${manifest.id} lancée dans le salon ${roomCode}`);
            this.io.to(roomCode).emit(ClientEvents.GAME_STARTED, manifest);
            this.emitPlayers(room);
            this.reply(ack);
        });
    }

    private handleStopGame(socket: Socket): void {
        socket.on(ServerEvents.STOP_GAME, (_payload: unknown, ack?: unknown) => {
            const sender = this.identify(socket);
            if (!sender) {
                return this.reply(ack, ErrorCodes.NOT_IN_ROOM, 'You are not in a room');
            }
            const { room, roomCode } = sender;
            if (!sender.player?.isHost) {
                return this.reply(ack, ErrorCodes.NOT_HOST, 'Only the host can stop the game');
            }
            if (room.phase !== 'playing') {
                return this.reply(ack, ErrorCodes.NO_GAME_RUNNING, 'No game is running');
            }

            room.stopGame();
            console.log(`🛑 Partie arrêtée dans le salon ${roomCode}`);
            this.io.to(roomCode).emit(ClientEvents.GAME_STOPPED);
            this.emitPlayers(room);
            this.reply(ack);
        });
    }

    private handleSendAction(socket: Socket): void {
        socket.on(ServerEvents.SEND_ACTION, (payload: unknown) => {
            const sender = this.identify(socket);
            const player = sender?.player;
            if (!sender || !player?.isConnected || sender.room.phase !== 'playing') {
                this.ignore(ServerEvents.SEND_ACTION, 'not allowed');
                return;
            }
            const message = this.readMessage(payload);
            if (!message || !sender.room.isConnected) {
                this.ignore(ServerEvents.SEND_ACTION, 'invalid payload or console offline');
                return;
            }

            this.io.to(sender.room.roomSocketId).emit(ClientEvents.PLAYER_ACTION, {
                playerId: player.playerId,
                type: message.type,
                data: message.data,
            });
        });
    }

    private handleBroadcastMessage(socket: Socket): void {
        socket.on(ServerEvents.BROADCAST_MESSAGE, (payload: unknown) => {
            const sender = this.identify(socket);
            if (!sender?.isConsole || sender.room.phase !== 'playing') {
                this.ignore(ServerEvents.BROADCAST_MESSAGE, 'not allowed');
                return;
            }
            const message = this.readMessage(payload);
            if (!message) {
                this.ignore(ServerEvents.BROADCAST_MESSAGE, 'invalid payload');
                return;
            }

            socket.to(sender.roomCode).emit(ClientEvents.GAME_MESSAGE, {
                type: message.type,
                data: message.data,
                isPrivate: false,
            });
        });
    }

    private handleSendPrivateMessage(socket: Socket): void {
        socket.on(ServerEvents.SEND_PRIVATE_MESSAGE, (payload: unknown, ack?: unknown) => {
            const sender = this.identify(socket);
            if (!sender) {
                return this.reply(ack, ErrorCodes.NOT_IN_ROOM, 'You are not in a room');
            }
            if (!sender.isConsole) {
                return this.reply(ack, ErrorCodes.NOT_CONSOLE, 'Only the console can do this');
            }
            if (sender.room.phase !== 'playing') {
                return this.reply(ack, ErrorCodes.NO_GAME_RUNNING, 'No game is running');
            }
            const message = this.readMessage(payload);
            const playerId = isPlainObject(payload) ? payload.playerId : undefined;
            if (!message || typeof playerId !== 'string') {
                return this.reply(ack, ErrorCodes.INVALID_PAYLOAD, 'Invalid message payload');
            }
            const player = sender.room.findPlayer(playerId);
            if (!player) {
                return this.reply(ack, ErrorCodes.PLAYER_NOT_FOUND, 'Player not found');
            }
            if (!player.isConnected) {
                return this.reply(ack, ErrorCodes.PLAYER_DISCONNECTED, 'Player is disconnected');
            }

            this.io.to(player.socketId).emit(ClientEvents.GAME_MESSAGE, {
                type: message.type,
                data: message.data,
                isPrivate: true,
            });
            this.reply(ack);
        });
    }

    private handleSetPlayerLabel(socket: Socket, event: string, field: 'role' | 'status'): void {
        socket.on(event, (payload: unknown, ack?: unknown) => {
            const sender = this.identify(socket);
            if (!sender) {
                return this.reply(ack, ErrorCodes.NOT_IN_ROOM, 'You are not in a room');
            }
            if (!sender.isConsole) {
                return this.reply(ack, ErrorCodes.NOT_CONSOLE, 'Only the console can do this');
            }
            if (sender.room.phase !== 'playing') {
                return this.reply(ack, ErrorCodes.NO_GAME_RUNNING, 'No game is running');
            }
            const playerId = isPlainObject(payload) ? payload.playerId : undefined;
            const label = checkLabel(isPlainObject(payload) ? payload[field] : undefined);
            if (typeof playerId !== 'string' || !label.ok) {
                return this.reply(ack, ErrorCodes.INVALID_PAYLOAD, `Invalid ${field} payload`);
            }
            const player = sender.room.findPlayer(playerId);
            if (!player) {
                return this.reply(ack, ErrorCodes.PLAYER_NOT_FOUND, 'Player not found');
            }

            player[field] = label.value;
            if (player.isConnected) {
                this.io
                    .to(player.socketId)
                    .emit(ClientEvents.PLAYER_STATE, { role: player.role, status: player.status });
            }
            this.emitPlayers(sender.room);
            this.reply(ack);
        });
    }

    // Validated type and data of a game message, or undefined when the payload is invalid
    private readMessage(payload: unknown): { type: string; data: unknown } | undefined {
        if (!isPlainObject(payload)) return undefined;
        const type = checkMessageType(payload.type);
        const data = checkMessageData(payload.data);
        if (!type.ok || !data.ok) return undefined;
        return { type: type.value, data: data.value };
    }

    private isReconnection(playerId: string, players: Player[]): boolean {
        return players.some((player) => player.playerId === playerId);
    }

    private reconnectPlayer(
        socket: Socket,
        playerId: string,
        playerName: string,
        players: Player[],
    ): Player | undefined {
        const player = players.find((p) => p.playerId === playerId);

        if (!player) {
            console.log(`❌ Joueur introuvable pour la reconnexion : ${playerId}`);
            socket.emit(ClientEvents.ERROR, { message: 'Player not found for reconnection' });
            return undefined;
        }
        if (player.isConnected) {
            console.log(`❌ Reconnexion refusée, joueur déjà connecté : ${playerId}`);
            socket.emit(ClientEvents.ERROR, { message: 'This player is already connected.' });
            return undefined;
        }
        console.log(`🔄 Joueur ${player.name} (${socket.id}) s'est reconnecté avec succès.`);
        player.socketId = socket.id;
        player.isConnected = true;
        player.name = playerName;
        player.resetDisconnectTimer();

        return player;
    }

    private connectPlayer(
        socket: Socket,
        playerName: string,
        playerId: string,
        room: Room,
        roomCode: string,
        isHost: boolean = false,
    ): Player | undefined {
        const player = new Player(socket.id, playerId, playerName, isHost);

        if (!room.addPlayer(player)) {
            console.log(`⚠️ Salon complet : ${roomCode}`);
            socket.emit(ClientEvents.ERROR, { message: 'Room is full' });
            return undefined;
        }

        return player;
    }

    private handleJoinRoom(socket: Socket): void {
        socket.on(
            ServerEvents.JOIN_ROOM,
            (roomCode: string, playerName: string, playerId?: string) => {
                const room = this.roomManager.getRoom(roomCode);
                if (!room) {
                    console.log(`❌ Salon introuvable : ${roomCode}`);
                    socket.emit(ClientEvents.ERROR, { message: 'Room not found' });
                    return;
                }

                if (!validatePlayerName(playerName)) {
                    console.log(`❌ Nom de joueur invalide : ${playerName}`);
                    socket.emit(ClientEvents.ERROR, { message: 'Invalid player name' });
                    return;
                }

                const newPlayerId = playerId || generatePlayerId();
                console.log(
                    `🔑 Tentative de connexion du joueur ${playerName} (${socket.id}) au salon ${roomCode} newPlayerId: ${newPlayerId}`,
                );
                let player: Player | undefined;
                if (this.isReconnection(newPlayerId, room.players)) {
                    player = this.reconnectPlayer(socket, newPlayerId, playerName, room.players);
                    socket.data.isHost = player?.isHost || false;
                } else {
                    if (room.players.length === 0) {
                        console.log(
                            `⚠️ Le salon ${roomCode} est vide. Le joueur ${playerName} (${socket.id}) devient l'hôte.`,
                        );
                        socket.data.isHost = true;
                        player = this.connectPlayer(
                            socket,
                            playerName,
                            newPlayerId,
                            room,
                            roomCode,
                            true,
                        );
                    } else {
                        socket.data.isHost = false;
                        player = this.connectPlayer(
                            socket,
                            playerName,
                            newPlayerId,
                            room,
                            roomCode,
                        );
                    }
                }

                if (!player) {
                    return;
                }

                socket.join(roomCode);
                socket.data.roomCode = roomCode;
                socket.data.playerId = player.playerId;

                console.log(`📱 Joueur ${playerName} (${socket.id}) a rejoint ${roomCode}`);
                socket.emit(ClientEvents.PLAYER_JOINED, {
                    playerId: player.playerId,
                    isHost: player.isHost,
                });
                this.emitPlayerView(socket, room, player);

                this.emitPlayers(room);
            },
        );
    }

    private consoleGraceTime(room: Room, roomCode: string, socketId: string): boolean {
        if (room.roomSocketId === socketId) {
            room.isConnected = false;
            console.log(
                `⚠️ L'hôte du salon ${roomCode} s'est déconnecté. Le salon est maintenant inactif.`,
            );

            this.io
                .to(roomCode)
                .emit(ClientEvents.CONSOLE_DISCONNECTED, { message: 'Console disconnected' });

            room.disconnectTimer = setTimeout(() => {
                if (room.isConnected) {
                    console.log(`✅ L'hôte du salon ${roomCode} s'est reconnecté à temps.`);
                    return;
                }

                this.roomManager.removeRoom(roomCode);
                console.log(
                    `🚪 Le salon ${roomCode} a été supprimé après la déconnexion de l'hôte.`,
                );

                this.io.to(roomCode).emit(ClientEvents.ROOM_CLOSED, {
                    message: 'Room closed due to host disconnection',
                });
            }, 30000);

            return true;
        }

        return false;
    }

    private playerGraceTime(player: Player, socket: Socket, roomCode: string, room: Room): void {
        player.isConnected = false;
        console.log(
            `⏳ Joueur ${player.name} (${socket.id}) est déconnecté. Attente de reconnexion...`,
        );
        this.io.to(room.roomSocketId).emit(ClientEvents.DISCONNECTED_USER, {
            playerId: player.playerId,
        });
        this.emitPlayers(room);

        player.disconnectTimer = setTimeout(() => {
            if (player.isConnected) {
                console.log(`✅ Joueur ${player.name} (${socket.id}) s'est reconnecté à temps.`);
                return;
            }

            room.removePlayer(socket.id);
            console.log(`👋 Joueur ${socket.id} a quitté le salon ${roomCode}`);

            const newHost = room.migrateHost();
            if (newHost) {
                const newHostSocket = this.io.sockets.sockets.get(newHost.socketId);
                if (newHostSocket) {
                    newHostSocket.data.isHost = true;
                    newHostSocket.emit(ClientEvents.PROMOTE_TO_HOST, {
                        message: 'You are now the host',
                    });
                }
                console.log(
                    `🔄 Le joueur ${newHost.name} (${newHost.socketId}) est maintenant l'hôte du salon ${roomCode}.`,
                );
            }

            this.emitPlayers(room);
        }, 30000);
    }

    private handleDisconnect(socket: Socket): void {
        socket.on('disconnect', () => {
            console.log(`🔴 Déconnexion : ${socket.id}`);

            const roomCode = socket.data.roomCode;
            if (!roomCode) return;

            const room = this.roomManager.getRoom(roomCode);
            if (!room) return;

            if (this.consoleGraceTime(room, roomCode, socket.id)) {
                return;
            }

            const player = room.players.find((p) => p.socketId === socket.id);
            if (!player) return;

            this.playerGraceTime(player, socket, roomCode, room);
        });
    }
}
