import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import eventsCodes from 'common';
import type { PlayerListInfo } from "./Types/consoleTypes.js";

const { ClientEvents, ServerEvents } = eventsCodes;

export class ConsoleSDK {
    private socket: Socket;
    public roomCode: string | null = null;

    constructor(serverUrl: string) {
        this.socket = io(serverUrl);
        this.initListeners();
    }

    private initListeners(): void {
        this.socket.on('connect', () => {
            console.log(`🟢 Console connectée au serveur (ID: ${this.socket.id})`);
        });

        this.socket.on('disconnect', (reason) => {
            console.warn(`🔴 Console déconnectée du serveur. Raison : ${reason}`);
        });
    }

    onConnect(callback: () => void): void {
        this.socket.on('connect', () => {
            callback();
        });
    }

    onDisconnect(callback: (reason: string) => void): void {
        this.socket.on('disconnect', (reason) => {
            callback(reason);
        });
    }

    disconnect(): void {
        this.socket.disconnect();
    }

    createRoom(): Promise<string> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.socket.off(ClientEvents.ROOM_CREATED);
                this.socket.off(ClientEvents.ERROR);

                reject(new Error("Délai d'attente dépassé pour la création du salon."));
            }, 5000);

            this.socket.once(ClientEvents.ROOM_CREATED, (data: { roomCode: string }) => {
                clearTimeout(timer);
                this.socket.off(ClientEvents.ERROR);

                this.roomCode = data.roomCode;
                resolve(data.roomCode);
            });

            this.socket.once(ClientEvents.ERROR, (error: string) => {
                clearTimeout(timer);
                this.socket.off(ClientEvents.ROOM_CREATED);

                reject(new Error(error));
            });

            this.socket.emit(ServerEvents.CREATE_ROOM);
        });
    }

    reconnectToRoom(roomCode: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.socket.off(ClientEvents.RECONNECTED_TO_ROOM);
                this.socket.off(ClientEvents.ERROR);

                reject(new Error("Délai d'attente dépassé pour la reconnexion au salon."));
            }, 5000);

            this.socket.once(ClientEvents.RECONNECTED_TO_ROOM, (data: { roomCode: string }) => {
                clearTimeout(timer);
                this.socket.off(ClientEvents.ERROR);

                this.roomCode = data.roomCode;
                resolve(data.roomCode);
            });

            this.socket.once(ClientEvents.ERROR, (error: string) => {
                clearTimeout(timer);
                this.socket.off(ClientEvents.RECONNECTED_TO_ROOM);

                reject(new Error(error));
            });

            this.socket.emit(ServerEvents.RECONNECT_TO_ROOM, roomCode);
        });
    }

    onReconnectedToRoom(callback: (message: string) => void): void {
        this.socket.on(ClientEvents.RECONNECTED_TO_ROOM, (data: { message: string }) => {
            callback(data.message);
        });
    }

    onUpdatePlayers(callback: (players: PlayerListInfo[]) => void): void {
        this.socket.on(ClientEvents.UPDATE_PLAYERS, (players: PlayerListInfo[]) => {
            callback(players);
        });
    }

    onDisconnectedUser(callback: (playerId: string) => void): void {
        this.socket.on(ClientEvents.DISCONNECTED_USER, (playerId: string) => {
            callback(playerId);
        });
    }

    onGameInfo(callback: () => void): void {
        this.socket.on(ClientEvents.GAME_INFO, () => {
            callback();
        });
    }

    onRoomClosed(callback: (message: string) => void): void {
        this.socket.on(ClientEvents.ROOM_CLOSED, (data: { message: string }) => {
            callback(data.message);
        });
    }
}
