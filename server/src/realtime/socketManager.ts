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
            socket.data.isHost = true;

            console.log(`📺 Salon créé : ${roomCode} par l'hôte ${socket.id}`);
            socket.emit(ClientEvents.ROOM_CREATED, { roomCode });
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

        return player;
    }

    private connectPlayer(socket: Socket, playerName: string, playerId: string, room: Room, roomCode: string): Player | undefined {
        const player = new Player(socket.id, playerId, playerName);

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
            } else {
                player = this.connectPlayer(socket, playerName, newPlayerId, room, roomCode);
            }

            if (!player) {
                return;
            }

            socket.join(roomCode);
            socket.data.roomCode = roomCode;
            socket.data.isHost = false;
            socket.data.playerId = player.playerId;

            console.log(`📱 Joueur ${playerName} (${socket.id}) a rejoint ${roomCode}`);
            socket.emit(ClientEvents.PLAYER_JOINED, { playerId: player.playerId });

            this.io.to(roomCode).emit(ClientEvents.UPDATE_PLAYERS, room.getPlayersNamesAndIds());
        });
    }

    private handleDisconnect(socket: Socket): void {
        socket.on('disconnect', () => {
            console.log(`🔴 Déconnexion : ${socket.id}`);

            const roomCode = socket.data.roomCode;
            if (!roomCode) return;

            const room = this.roomManager.getRoom(roomCode);
            if (!room) return;

            const player = room.players.find(p => p.socketId === socket.id);
            if (!player) return;

            player.isConnected = false;
            console.log(`⏳ Joueur ${player.name} (${socket.id}) est déconnecté. Attente de reconnexion...`);
            this.io.to(roomCode).emit(ClientEvents.DISCONNECTED_USER, { playerId: player.playerId });

            player.disconnectTimer = setTimeout(() => {
                if (player.isConnected) {
                    console.log(`✅ Joueur ${player.name} (${socket.id}) s'est reconnecté à temps.`);
                    return;
                }

                room.removePlayer(socket.id);
                console.log(`👋 Joueur ${socket.id} a quitté le salon ${roomCode}`);
                this.io.to(roomCode).emit(ClientEvents.UPDATE_PLAYERS, room.getPlayersNamesAndIds());
            }, 30000);
        });
    }
}