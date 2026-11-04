import type { Server, Socket } from "socket.io";
import { RoomManager } from "./roomManager.js";
import { generatePlayerId, generateRoomCode } from "../core/utils.js";
import { Player } from "./player.js";
import eventsCodes from "common";
import { validatePlayerName } from "../core/pseudoFilter.js";
import type { Room } from "./room.js";

const { ClientEvents, ServerEvents } = eventsCodes;

export class SocketManager {
    private io: Server;
    private roomManager: RoomManager;

    constructor(io: Server) {
        this.io = io;
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
            this.handleGameInfo(socket);
        });
    }

    private handleCreateRoom(socket: Socket): void {
        socket.on(ServerEvents.CREATE_ROOM, () => {
            const roomCode = generateRoomCode();
            this.roomManager.createRoom(roomCode, socket.id);

            socket.join(roomCode);
            socket.data.roomCode = roomCode;
            socket.data.isHost = false;

            console.log(`📺 Salon créé : ${roomCode} par l'hôte ${socket.id}`);
            socket.emit(ClientEvents.ROOM_CREATED, { roomCode });
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

                console.log(`✅ Console reconnectée avec succès sur le salon ${roomCode} (Nouveau socket: ${socket.id})`);

                socket.emit(ClientEvents.RECONNECTED_TO_ROOM, { roomCode });
                socket.emit(ClientEvents.UPDATE_PLAYERS, room.getPlayersInfos());
                this.io.to(roomCode).emit(ClientEvents.CONSOLE_RECONNECTED, { message: 'Console is back online' });     
            } else {
                console.log(`⚠️ Tentative de reconnexion sur le salon ${roomCode}, mais l'hôte est déjà connecté.`);
                socket.emit(ClientEvents.ERROR, { message: 'Room is already connected' });
            }
        });
    }

    private handleGameInfo(socket: Socket): void {
        socket.on(ClientEvents.GAME_INFO, () => {
            const roomCode = socket.data.roomCode;
            console.log("AAAAAAAHHHHHHH");
            if (!roomCode) return;
            console.log("COUCOU Reçu 5 sur 5");
            this.io.to(roomCode).emit(ClientEvents.GAME_INFO);
        });
    }

    private isReconnection(playerId: string, players: Player[]): boolean {
        return players.some(player => player.playerId === playerId);
    }

    private reconnectPlayer(socket: Socket, playerId: string, players: Player[]): Player | undefined {
        const player = players.find(p => p.playerId === playerId);

        if (!player) {
            console.log(`❌ Joueur introuvable pour la reconnexion : ${playerId}`);
            socket.emit(ClientEvents.ERROR, { message: 'Player not found for reconnection' });
            return undefined;
        }
        console.log(`🔄 Joueur ${player.name} (${socket.id}) s'est reconnecté avec succès.`);
        player.socketId = socket.id;
        player.isConnected = true;
        player.resetDisconnectTimer();

        return player;
    }

    private connectPlayer(socket: Socket, playerName: string, playerId: string, room: Room, roomCode: string, isHost: boolean = false): Player | undefined {
        const player = new Player(socket.id, playerId, playerName, isHost);

        if (!room.addPlayer(player)) {
            console.log(`⚠️ Salon complet : ${roomCode}`);
            socket.emit(ClientEvents.ERROR, { message: 'Room is full' });
            return undefined;
        }

        return player;
    }

    private handleJoinRoom(socket: Socket): void {
        socket.on(ServerEvents.JOIN_ROOM, (roomCode: string, playerName: string, playerId?: string) => {
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
            console.log(`🔑 Tentative de connexion du joueur ${playerName} (${socket.id}) au salon ${roomCode} newPlayerId: ${newPlayerId}`);
            let player: Player | undefined;
            if (this.isReconnection(newPlayerId, room.players)) {
                player = this.reconnectPlayer(socket, newPlayerId, room.players);
                socket.data.isHost = player?.isHost || false;
            } else {
                if (room.players.length === 0) {
                    console.log(`⚠️ Le salon ${roomCode} est vide. Le joueur ${playerName} (${socket.id}) devient l'hôte.`);
                    socket.data.isHost = true;
                    player = this.connectPlayer(socket, playerName, newPlayerId, room, roomCode, true);
                } else {
                    socket.data.isHost = false;
                    player = this.connectPlayer(socket, playerName, newPlayerId, room, roomCode);
                }
            }

            if (!player) {
                return;
            }

            socket.join(roomCode);
            socket.data.roomCode = roomCode;
            socket.data.playerId = player.playerId;

            console.log(`📱 Joueur ${playerName} (${socket.id}) a rejoint ${roomCode}`);
            socket.emit(ClientEvents.PLAYER_JOINED, { playerId: player.playerId });

            this.io.to(roomCode).emit(ClientEvents.UPDATE_PLAYERS, room.getPlayersInfos());
        });
    }

    private consoleGraceTime(room: Room, roomCode: string, socketId: string): boolean {
        if (room.roomSocketId === socketId) {
            room.isConnected = false;
            console.log(`⚠️ L'hôte du salon ${roomCode} s'est déconnecté. Le salon est maintenant inactif.`);

            this.io.to(roomCode).emit(ClientEvents.CONSOLE_DISCONNECTED, { message: 'Console disconnected' });

            room.disconnectTimer = setTimeout(() => {
                if (room.isConnected) {
                    console.log(`✅ L'hôte du salon ${roomCode} s'est reconnecté à temps.`);
                    return;
                }

                this.roomManager.removeRoom(roomCode);
                console.log(`🚪 Le salon ${roomCode} a été supprimé après la déconnexion de l'hôte.`);

                this.io.to(roomCode).emit(ClientEvents.ROOM_CLOSED, { message: 'Room closed due to host disconnection' });
            }, 30000);

            return true;
        }

        return false;
    }

    private playerGraceTime(player: Player, socket: Socket, roomCode: string, room: Room): void {
        player.isConnected = false;
        console.log(`⏳ Joueur ${player.name} (${socket.id}) est déconnecté. Attente de reconnexion...`);
        this.io.to(roomCode).emit(ClientEvents.DISCONNECTED_USER, { playerId: player.playerId });
        this.io.to(roomCode).emit(ClientEvents.UPDATE_PLAYERS, room.getPlayersInfos());

        player.disconnectTimer = setTimeout(() => {
            if (player.isConnected) {
                console.log(`✅ Joueur ${player.name} (${socket.id}) s'est reconnecté à temps.`);
                return;
            }

            room.removePlayer(socket.id);
            console.log(`👋 Joueur ${socket.id} a quitté le salon ${roomCode}`);

            let newHost = room.migrateHost();
            if (newHost) {
                const newHostSocket = this.io.sockets.sockets.get(newHost.socketId);
                if (newHostSocket) {
                    newHostSocket.data.isHost = true;
                    newHostSocket.emit(ClientEvents.PROMOTE_TO_HOST, { message: 'You are now the host' });
                }
                console.log(`🔄 Le joueur ${newHost.name} (${newHost.socketId}) est maintenant l'hôte du salon ${roomCode}.`);
            }

            this.io.to(roomCode).emit(ClientEvents.UPDATE_PLAYERS, room.getPlayersInfos());
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

            const player = room.players.find(p => p.socketId === socket.id);
            if (!player) return;

            this.playerGraceTime(player, socket, roomCode, room);
        });
    }
}