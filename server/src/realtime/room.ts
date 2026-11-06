import { Player } from './player.js';

export class Room {
    roomCode: string;
    roomSocketId: string;
    players: Player[];
    lastActionTimestamp: number;
    isConnected: boolean = true;
    disconnectTimer?: NodeJS.Timeout | undefined;

    constructor(roomCode: string, roomSocketId: string) {
        this.roomCode = roomCode;
        this.roomSocketId = roomSocketId;
        this.players = [];
        this.lastActionTimestamp = Date.now();
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
        if (this.players.length >= 2) {
            // 8 players limit
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



    getPlayersInfos(): { name: string; playerId: string; isConnected: boolean, isHost: boolean }[] {
        let players: { name: string; playerId: string; isConnected: boolean, isHost: boolean }[] = this.players.map(player => ({
            name: player.name,
            playerId: player.socketId,
            isConnected: player.isConnected,
            isHost: player.isHost
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
