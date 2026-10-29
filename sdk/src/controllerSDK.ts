import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import eventsCodes from 'common';

const { ClientEvents, ServerEvents } = eventsCodes;

export class ControllerSDK {
    private socket: Socket;
    public roomCode: string | null = null;
    public playerId: string | null = null;

    private backupRoomCode: string | null = null;
    private backupPlayerId: string | null = null;
    private backupPlayerName: string | null = null;

    constructor(serverUrl: string) {
        this.socket = io(serverUrl);
        this.initListeners();
    }

    private initListeners(): void {
        this.socket.on('connect', () => {
            console.log(`🟢 Manette connectée au serveur (ID: ${this.socket.id})`);

            if (this.backupRoomCode && this.backupPlayerName && this.backupPlayerId) {
                console.log("🔄 Tentative de reconnexion automatique au salon...");
                this.reconnectToRoom(this.backupRoomCode, this.backupPlayerName, this.backupPlayerId)
                    .then(() => console.log("✅ Reconnexion automatique réussie !"))
                    .catch((err) => console.error("❌ Échec de la reconnexion auto :", err.message));
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.warn(`🔴 Manette déconnectée du serveur. Raison : ${reason}`);
        });
    }

    joinRoom(roomCode: string, playerName: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.socket.off(ClientEvents.PLAYER_JOINED);
                this.socket.off(ClientEvents.ERROR);

                reject(new Error("Délai d'attente dépassé pour la connexion au salon."));
            }, 5000);

            this.socket.once(ClientEvents.PLAYER_JOINED, (playerId: string) => {
                clearTimeout(timer);
                this.socket.off(ClientEvents.ERROR);

                this.roomCode = roomCode;
                this.playerId = playerId;

                this.backupRoomCode = roomCode;
                this.backupPlayerId = playerId;
                this.backupPlayerName = playerName;

                resolve(playerId);
            });

            this.socket.once(ClientEvents.ERROR, (error: string) => {
                clearTimeout(timer);
                this.socket.off(ClientEvents.PLAYER_JOINED);

                reject(new Error(error));
            });

            this.socket.emit(ServerEvents.JOIN_ROOM, { roomCode, playerName });
        });
    }

    reconnectToRoom(roomCode: string, playerName: string, playerId: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.socket.off(ClientEvents.PLAYER_JOINED);
                this.socket.off(ClientEvents.ERROR);

                reject(new Error("Délai d'attente dépassé pour la reconnexion au salon."));
            }, 5000);

            this.socket.once(ClientEvents.PLAYER_JOINED, (playerId: string) => {
                clearTimeout(timer);
                this.socket.off(ClientEvents.ERROR);

                this.roomCode = roomCode;
                this.playerId = playerId;

                this.backupRoomCode = roomCode;
                this.backupPlayerId = playerId;
                this.backupPlayerName = playerName;

                resolve(playerId);
            });

            this.socket.once(ClientEvents.ERROR, (error: string) => {
                clearTimeout(timer);
                this.socket.off(ClientEvents.PLAYER_JOINED);

                reject(new Error(error));
            });

            this.socket.emit(ServerEvents.JOIN_ROOM, { roomCode, playerName, playerId });
        });
    }
}
