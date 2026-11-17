import { MAX_PLAYERS_PER_ROOM } from '../config.js';
import { Player } from './player.js';

export class Room {
    roomCode: string;
    roomSocketId: string;
    players: Player[];
    lastActionTimestamp: number;
    isConnected: boolean = true;
    disconnectTimer?: NodeJS.Timeout | undefined;
    readonly maxPlayers: number;

    constructor(roomCode: string, roomSocketId: string, maxPlayers: number = MAX_PLAYERS_PER_ROOM) {
        this.roomCode = roomCode;
        this.roomSocketId = roomSocketId;
        this.players = [];
        this.lastActionTimestamp = Date.now();
        this.maxPlayers = maxPlayers;
    }

    resetDisconnectTimer(): void {
        if (this.disconnectTimer) {
            clearTimeout(this.disconnectTimer);
            this.disconnectTimer = undefined;
        }
    }

    updateLastActionTimestamp(): void {
        this.lastActionTimestamp = Date.now();
    }

    addPlayer(player: Player): boolean {
        if (this.players.length >= this.maxPlayers) {
            return false;
        }
        this.players.push(player);
        this.updateLastActionTimestamp();
        return true;
    }

    removePlayer(socketId: string): void {
        this.players = this.players.filter((player) => player.socketId !== socketId);
        this.updateLastActionTimestamp();
    }

    getPlayersInfos(): { name: string; playerId: string; isConnected: boolean; isHost: boolean }[] {
        const players: { name: string; playerId: string; isConnected: boolean; isHost: boolean }[] =
            this.players.map((player) => ({
                name: player.name,
                playerId: player.playerId,
                isConnected: player.isConnected,
                isHost: player.isHost,
            }));

        return players;
    }

    migrateHost(): Player | undefined {
        const newHost = this.players[0];
        if (newHost) {
            newHost.isHost = true;

            return newHost;
        } else {
            console.log(`⚠️ Aucun joueur restant pour devenir l'hôte du salon ${this.roomCode}.`);
        }
    }
}
