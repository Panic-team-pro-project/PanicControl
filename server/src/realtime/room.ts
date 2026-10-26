import { Player } from './player.js';

export class Room {
    roomCode: string;
    hostSocketId: string;
    players: Player[];
    lastActionTimestamp: number;

    constructor(roomCode: string, hostSocketId: string) {
        this.roomCode = roomCode;
        this.hostSocketId = hostSocketId;
        this.players = [];
        this.lastActionTimestamp = Date.now();
    }

    updateLastActionTimestamp(): void {
        this.lastActionTimestamp = Date.now();
    }

    addPlayer(player: Player): boolean {
        if (this.players.length >= 8) { // 8 players limit
            return false;
        }
        this.players.push(player);
        this.updateLastActionTimestamp();
        return true;
    }

    removePlayer(socketId: string): void {
        this.players = this.players.filter(player => player.socketId !== socketId);
        this.updateLastActionTimestamp();
    }
}
